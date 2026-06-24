import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/routes/_authenticated/auth-context";
import { QuestaoConversa, type QuestaoBase } from "@/components/QuestaoConversa";

export const Route = createFileRoute("/_authenticated/questoes/")({
  component: QuestoesPage,
});

type Q = QuestaoBase & {
  funcionario: { id: string; nome: string; cor: string | null } | null;
  atividade: { id: string; nome: string } | null;
  unread: number;
};

type Estado = "aberta" | "respondida" | "fechada" | "todas";

function QuestoesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthUser();
  const [estado, setEstado] = useState<Estado>("aberta");
  const [funcionarioFiltro, setFuncionarioFiltro] = useState<string>("");
  const [aberta, setAberta] = useState<QuestaoBase | null>(null);

  const isGestorQ = useQuery({
    queryKey: ["is-gestor", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "gestor").maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  // Gestor's own funcionario row (needed to author replies)
  const meQ = useQuery({
    queryKey: ["meu-funcionario", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios").select("id").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const listQ = useQuery({
    queryKey: ["questoes-list", estado, funcionarioFiltro],
    queryFn: async (): Promise<Q[]> => {
      let q = supabase
        .from("questoes")
        .select("*, funcionario:funcionarios(id,nome,cor), atividade:atividades(id,nome)")
        .order("updated_at", { ascending: false });
      if (estado !== "todas") q = q.eq("estado", estado);
      if (funcionarioFiltro) q = q.eq("funcionario_id", funcionarioFiltro);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Q[];
      // unread count per questao
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return rows;
      const { data: msgs, error: e2 } = await supabase
        .from("questao_mensagens")
        .select("questao_id")
        .in("questao_id", ids)
        .eq("autor_papel", "operador")
        .eq("lida_pelo_gestor", false);
      if (e2) throw e2;
      const cnt = new Map<string, number>();
      (msgs ?? []).forEach((m: { questao_id: string }) => cnt.set(m.questao_id, (cnt.get(m.questao_id) ?? 0) + 1));
      return rows.map((r) => ({ ...r, unread: cnt.get(r.id) ?? 0 }));
    },
    enabled: !!isGestorQ.data,
  });

  // Realtime
  useEffect(() => {
    if (!isGestorQ.data) return;
    const ch = supabase
      .channel("questoes-gestor-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "questoes" }, () => qc.invalidateQueries({ queryKey: ["questoes-list"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "questao_mensagens" }, () => qc.invalidateQueries({ queryKey: ["questoes-list"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isGestorQ.data, qc]);

  const funcionariosQ = useQuery({
    queryKey: ["funcionarios-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("id,nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!isGestorQ.data,
  });

  const rows = listQ.data ?? [];
  const fmtAgo = useMemo(() => new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" }), []);
  function ago(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return fmtAgo.format(-Math.round(diff), "second");
    if (diff < 3600) return fmtAgo.format(-Math.round(diff / 60), "minute");
    if (diff < 86400) return fmtAgo.format(-Math.round(diff / 3600), "hour");
    return fmtAgo.format(-Math.round(diff / 86400), "day");
  }

  if (isGestorQ.isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (!isGestorQ.data) return <Navigate to="/hoje" />;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground">{t("questoes.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("questoes.subtitle")}</p>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <select value={estado} onChange={(e) => setEstado(e.target.value as Estado)} className="rounded border border-input bg-background px-2 py-1.5 text-sm">
          <option value="aberta">{t("questoes.estado.aberta")}</option>
          <option value="respondida">{t("questoes.estado.respondida")}</option>
          <option value="fechada">{t("questoes.estado.fechada")}</option>
          <option value="todas">{t("questoes.todas")}</option>
        </select>
        <select value={funcionarioFiltro} onChange={(e) => setFuncionarioFiltro(e.target.value)} className="rounded border border-input bg-background px-2 py-1.5 text-sm">
          <option value="">{t("questoes.todosFuncionarios")}</option>
          {(funcionariosQ.data ?? []).map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
      </div>

      <ul className="mt-4 space-y-2">
        {rows.length === 0 && (
          <li className="text-sm text-muted-foreground">{t("questoes.semQuestoes")}</li>
        )}
        {rows.map((q) => (
          <li
            key={q.id}
            className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent/40 transition"
            style={q.funcionario?.cor ? { borderLeft: `4px solid ${q.funcionario.cor}` } : undefined}
            onClick={() => setAberta(q)}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{q.funcionario?.nome ?? "—"}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{t(`questoes.tipo.${q.tipo}`)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t(`questoes.estado.${q.estado}`)}</span>
                  {q.unread > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground font-bold">{q.unread}</span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground truncate">{q.assunto}</p>
                {q.atividade && (
                  <p className="text-xs text-muted-foreground truncate">{t("questoes.ligadaA")}: {q.atividade.nome}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{ago(q.updated_at ?? q.created_at)}</span>
            </div>
          </li>
        ))}
      </ul>

      {aberta && meQ.data && (
        <QuestaoConversa
          questao={aberta}
          meuFuncionarioId={meQ.data.id}
          papel="gestor"
          onClose={() => setAberta(null)}
        />
      )}
    </div>
  );
}
