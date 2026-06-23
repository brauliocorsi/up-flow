import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuthUser } from "@/routes/_authenticated/route";
import { criarFuncionario } from "@/lib/criar-funcionario.functions";

export const Route = createFileRoute("/_authenticated/equipa/")({
  component: EquipaPage,
});

type Papel = "gestor" | "funcionario";
type Funcao = { id: string; nome: string };
type Funcionario = {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  user_id: string | null;
  funcao_id: string;
  funcao: { nome: string } | null;
};
type AuthUser = { id: string; email: string };

function EquipaPage() {
  const { t } = useTranslation();
  const user = useAuthUser();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [adding, setAdding] = useState(false);
  const [creatingWithAccess, setCreatingWithAccess] = useState(false);
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

  const funcionariosQuery = useQuery({
    enabled: !!isGestor,
    queryKey: ["funcionarios-all"],
    queryFn: async (): Promise<Funcionario[]> => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, papel, ativo, user_id, funcao_id, funcao:funcoes(nome)")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Funcionario[];
    },
  });

  const unlinkedUsersQuery = useQuery({
    enabled: !!isGestor,
    queryKey: ["unlinked-users"],
    queryFn: async (): Promise<AuthUser[]> => {
      const { data, error } = await supabase.rpc("listar_users_nao_associados");
      if (error) throw error;
      return (data ?? []) as AuthUser[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["funcionarios-all"] });
    qc.invalidateQueries({ queryKey: ["unlinked-users"] });
  };

  const associate = useMutation({
    mutationFn: async (args: { funcionario_id: string; user_id: string }) => {
      const { error } = await supabase.rpc("associar_user_a_funcionario", {
        _funcionario_id: args.funcionario_id,
        _user_id: args.user_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedback(t("equipa.linkOk"));
      invalidateAll();
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const disassociate = useMutation({
    mutationFn: async (funcionario_id: string) => {
      const { error } = await supabase.rpc("desassociar_user_de_funcionario", {
        _funcionario_id: funcionario_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedback(t("equipa.unlinkOk"));
      invalidateAll();
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const remove = useMutation({
    mutationFn: async (f: Funcionario) => {
      const { data: hasHist, error: e1 } = await supabase.rpc("funcionario_tem_historico", {
        _funcionario_id: f.id,
      });
      if (e1) throw e1;
      if (hasHist) throw new Error(t("equipa.cannotDelete"));
      const { error } = await supabase.from("funcionarios").delete().eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedback(t("equipa.deleted"));
      invalidateAll();
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (f: Funcionario) => {
      const { error } = await supabase
        .from("funcionarios")
        .update({ ativo: !f.ativo })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
    onError: (e: Error) => setFeedback(e.message),
  });

  if (loadingRole) return <Shell><p className="text-muted-foreground">{t("common.loading")}</p></Shell>;
  if (!isGestor) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t("equipa.forbidden")}</p>
        <Link to="/app" className="text-sm text-primary underline mt-2 inline-block">
          {t("common.back")}
        </Link>
      </Shell>
    );
  }

  const funcoes = funcoesQuery.data ?? [];
  const funcionarios = funcionariosQuery.data ?? [];
  const unlinkedUsers = unlinkedUsersQuery.data ?? [];

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{t("equipa.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("equipa.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setCreatingWithAccess(true); setAdding(false); setEditing(null); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("equipa.criar.openButton")}
          </button>
          <button
            onClick={() => { setAdding(true); setEditing(null); setCreatingWithAccess(false); }}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {t("equipa.add")}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold text-foreground">{t("equipa.helpTitle")}</h3>
        <ol className="mt-2 list-decimal pl-5 text-sm text-muted-foreground space-y-1">
          <li>{t("equipa.helpStep1")}</li>
          <li>{t("equipa.helpStep2")}</li>
        </ol>
      </div>

      {feedback && (
        <div className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          {feedback}
          <button onClick={() => setFeedback(null)} className="ml-2 text-xs text-muted-foreground hover:underline">
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {(adding || editing) && (
        <FuncionarioForm
          funcoes={funcoes}
          initial={editing}
          onCancel={() => { setAdding(false); setEditing(null); }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            invalidateAll();
          }}
        />
      )}

      {creatingWithAccess && (
        <CriarFuncionarioForm
          funcoes={funcoes}
          onCancel={() => setCreatingWithAccess(false)}
          onCreated={(msg) => {
            setCreatingWithAccess(false);
            setFeedback(msg);
            invalidateAll();
          }}
        />
      )}

      <div className="mt-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("equipa.col.nome")}</th>
              <th className="px-3 py-2">{t("equipa.col.funcao")}</th>
              <th className="px-3 py-2">{t("equipa.col.papel")}</th>
              <th className="px-3 py-2">{t("equipa.col.estado")}</th>
              <th className="px-3 py-2">{t("equipa.col.login")}</th>
              <th className="px-3 py-2 text-right">{t("equipa.col.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {funcionarios.map((f) => (
              <tr key={f.id} className="text-foreground">
                <td className="px-3 py-2 font-medium">{f.nome}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.funcao?.nome ?? "—"}</td>
                <td className="px-3 py-2">{t(`roles.${f.papel}`)}</td>
                <td className="px-3 py-2">
                  <span className={f.ativo ? "text-foreground" : "text-muted-foreground"}>
                    {f.ativo ? t("equipa.active") : t("equipa.inactive")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {f.user_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs rounded bg-primary/10 px-2 py-0.5 text-primary">
                        {t("equipa.linked")}
                      </span>
                      <button
                        onClick={() => disassociate.mutate(f.id)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {t("equipa.unlink")}
                      </button>
                    </div>
                  ) : (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const uid = e.target.value;
                        if (uid) associate.mutate({ funcionario_id: f.id, user_id: uid });
                      }}
                      className="rounded border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="">{t("equipa.pickUser")}</option>
                      {unlinkedUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.email}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    onClick={() => { setEditing(f); setAdding(false); }}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("equipa.edit")}
                  </button>
                  <button
                    onClick={() => toggleActive.mutate(f)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {f.ativo ? t("equipa.deactivate") : t("equipa.activate")}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t("equipa.confirmDelete", { name: f.nome }))) remove.mutate(f);
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    {t("equipa.delete")}
                  </button>
                </td>
              </tr>
            ))}
            {funcionarios.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{t("equipa.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function FuncionarioForm({
  funcoes,
  initial,
  onSaved,
  onCancel,
}: {
  funcoes: Funcao[];
  initial: Funcionario | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [funcaoId, setFuncaoId] = useState(initial?.funcao_id ?? funcoes[0]?.id ?? "");
  const [papel, setPapel] = useState<Papel>(initial?.papel ?? "funcionario");
  const [ativo, setAtivo] = useState<boolean>(initial?.ativo ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const cleanNome = nome.trim();
      if (!cleanNome || !funcaoId) throw new Error(t("equipa.fillRequired"));
      if (initial) {
        const { error } = await supabase
          .from("funcionarios")
          .update({ nome: cleanNome, funcao_id: funcaoId, papel, ativo })
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("funcionarios")
          .insert({ nome: cleanNome, funcao_id: funcaoId, papel, ativo: true });
        if (error) throw error;
      }
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-medium text-foreground">
        {initial ? t("equipa.editTitle") : t("equipa.addTitle")}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("equipa.col.nome")}</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
            className="rounded border border-input bg-background px-3 py-2 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("equipa.col.funcao")}</span>
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("equipa.col.papel")}</span>
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            className="rounded border border-input bg-background px-3 py-2 text-foreground"
          >
            <option value="funcionario">{t("roles.funcionario")}</option>
            <option value="gestor">{t("roles.gestor")}</option>
          </select>
        </label>
        {initial && (
          <label className="flex items-center gap-2 text-sm text-foreground mt-6">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            {t("equipa.active")}
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
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <p className="font-semibold text-foreground tracking-tight">{t("app.name")}</p>
          <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">
            {t("common.back")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-1 px-6 py-10 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  );
}
