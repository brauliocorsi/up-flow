import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/routes/_authenticated/route";
import { MacrosSection } from "@/components/MacrosSection";

export const Route = createFileRoute("/_authenticated/atividades/")({
  component: AtividadesPage,
});

type Funcao = { id: string; nome: string };
type Atividade = {
  id: string;
  funcao_id: string;
  nome: string;
  descricao: string;
  duracao_padrao_min: number;
  cor: string | null;
  ativo: boolean;
};

function AtividadesPage() {
  const { t } = useTranslation();
  const user = useAuthUser();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: isGestor, isLoading: loadingRole } = useQuery({
    queryKey: ["is-gestor", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "gestor")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const funcoesQuery = useQuery({
    enabled: !!isGestor,
    queryKey: ["funcoes"],
    queryFn: async (): Promise<Funcao[]> => {
      const { data, error } = await supabase.from("funcoes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const atividadesQuery = useQuery({
    enabled: !!isGestor,
    queryKey: ["atividades-all"],
    queryFn: async (): Promise<Atividade[]> => {
      const { data, error } = await supabase
        .from("atividades")
        .select("id, funcao_id, nome, descricao, duracao_padrao_min, cor, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["atividades-all"] });

  const toggleAtivo = useMutation({
    mutationFn: async (a: Atividade) => {
      const { error } = await supabase
        .from("atividades")
        .update({ ativo: !a.ativo })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedback(t("atividades.stateChanged"));
      invalidate();
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const funcoes = funcoesQuery.data ?? [];
  const atividades = atividadesQuery.data ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, Atividade[]>();
    funcoes.forEach((f) => map.set(f.id, []));
    atividades.forEach((a) => {
      if (!map.has(a.funcao_id)) map.set(a.funcao_id, []);
      map.get(a.funcao_id)!.push(a);
    });
    return map;
  }, [funcoes, atividades]);

  if (loadingRole) return <Shell><p className="text-muted-foreground">{t("common.loading")}</p></Shell>;
  if (!isGestor) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t("atividades.forbidden")}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{t("atividades.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("atividades.subtitle")}</p>
        </div>
        <button
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("atividades.add")}
        </button>
      </div>

      {feedback && (
        <div className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          {feedback}
          <button onClick={() => setFeedback(null)} className="ml-2 text-xs text-muted-foreground hover:underline">
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {adding && (
        <AtividadeForm
          funcoes={funcoes}
          initial={null}
          onCancel={() => { setAdding(false); }}
          onSaved={() => {
            setAdding(false);
            setFeedback(t("atividades.saved"));
            invalidate();
          }}
        />
      )}

      {atividades.length === 0 && !adding && (
        <p className="mt-8 text-sm text-muted-foreground">{t("atividades.emptyAll")}</p>
      )}

      <div className="mt-8 space-y-8">
        {funcoes.map((setor) => {
          const lista = grouped.get(setor.id) ?? [];
          return (
            <section key={setor.id} className="rounded-lg border border-border">
              <header className="border-b border-border px-4 py-3 bg-muted/30">
                <h2 className="text-base font-semibold text-foreground">{setor.nome}</h2>
                <p className="text-xs text-muted-foreground">{lista.length}</p>
              </header>
              {lista.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{t("atividades.empty")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">{t("atividades.col.nome")}</th>
                      <th className="px-3 py-2">{t("atividades.col.descricao")}</th>
                      <th className="px-3 py-2 text-right">{t("atividades.col.duracao")}</th>
                      <th className="px-3 py-2">{t("atividades.col.cor")}</th>
                      <th className="px-3 py-2">{t("atividades.col.estado")}</th>
                      <th className="px-3 py-2 text-right">{t("atividades.col.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lista.map((a) => (
                      <Fragment key={a.id}>
                      <tr className={a.ativo ? "text-foreground" : "text-muted-foreground"}>
                        <td className="px-3 py-2 font-medium">{a.nome}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.descricao || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.duracao_padrao_min}</td>
                        <td className="px-3 py-2">
                          {a.cor ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block h-3 w-3 rounded-full ring-1 ring-border" style={{ backgroundColor: a.cor }} />
                              <span className="text-xs">{a.cor}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("atividades.corNone")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {a.ativo ? t("atividades.ativa") : t("atividades.inativa")}
                        </td>
                        <td className="px-3 py-2 text-right space-x-2">
                          <button onClick={() => { setEditing(a); setAdding(false); }} className="text-xs text-primary hover:underline">
                            {t("atividades.edit")}
                          </button>
                          <button onClick={() => toggleAtivo.mutate(a)} className="text-xs text-muted-foreground hover:underline">
                            {a.ativo ? t("atividades.deactivate") : t("atividades.activate")}
                          </button>
                        </td>
                      </tr>
                      <tr key={a.id + "-macros"}>
                        <td colSpan={6} className="px-3 pb-3 pt-0">
                          <details className="rounded border border-border bg-muted/20 p-2">
                            <summary className="cursor-pointer text-xs font-medium text-foreground select-none">
                              {t("macros.sectionTitle")}
                            </summary>
                            <div className="mt-3">
                              <MacrosSection
                                canManage
                                scope={{ kind: "atividade", atividadeId: a.id }}
                              />
                            </div>
                          </details>
                        </td>
                      </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </Shell>
  );
}

function AtividadeForm({
  funcoes,
  initial,
  onSaved,
  onCancel,
}: {
  funcoes: Funcao[];
  initial: Atividade | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [funcaoId, setFuncaoId] = useState(initial?.funcao_id ?? funcoes[0]?.id ?? "");
  const [duracao, setDuracao] = useState<number>(initial?.duracao_padrao_min ?? 30);
  const [cor, setCor] = useState(initial?.cor ?? "");
  const [ativo, setAtivo] = useState<boolean>(initial?.ativo ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const cleanNome = nome.trim();
      if (!cleanNome || !funcaoId || !Number.isFinite(duracao) || duracao < 0) {
        throw new Error(t("atividades.fillRequired"));
      }
      const payload = {
        nome: cleanNome,
        descricao: descricao.trim(),
        funcao_id: funcaoId,
        duracao_padrao_min: Math.round(duracao),
        cor: cor.trim() ? cor.trim() : null,
        ativo,
      };
      if (initial) {
        const { error } = await supabase.from("atividades").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("atividades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-medium text-foreground">
        {initial ? t("atividades.editTitle") : t("atividades.addTitle")}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("atividades.col.nome")}</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={200}
            className="rounded border border-input bg-background px-3 py-2 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("atividades.col.setor")}</span>
          <select
            value={funcaoId}
            onChange={(e) => setFuncaoId(e.target.value)}
            className="rounded border border-input bg-background px-3 py-2 text-foreground"
          >
            {funcoes.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">{t("atividades.col.descricao")}</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="rounded border border-input bg-background px-3 py-2 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("atividades.col.duracao")}</span>
          <input
            type="number"
            min={0}
            value={duracao}
            onChange={(e) => setDuracao(Number(e.target.value))}
            className="rounded border border-input bg-background px-3 py-2 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("atividades.col.cor")}</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={cor || "#64748B"}
              onChange={(e) => setCor(e.target.value)}
              className="h-9 w-12 rounded border border-input bg-background"
            />
            <input
              type="text"
              value={cor}
              placeholder="#RRGGBB"
              onChange={(e) => setCor(e.target.value)}
              className="flex-1 rounded border border-input bg-background px-3 py-2 text-foreground font-mono text-xs"
            />
            {cor && (
              <button
                type="button"
                onClick={() => setCor("")}
                className="text-xs text-muted-foreground hover:underline"
              >
                {t("atividades.corNone")}
              </button>
            )}
          </div>
        </label>
        {initial && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            {t("atividades.ativa")}
          </label>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {save.isPending ? t("common.saving") : t("common.save")}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="px-4 sm:px-6 py-6 sm:py-10 max-w-5xl w-full mx-auto">{children}</main>
  );
}
