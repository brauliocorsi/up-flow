import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import {
  UserPlus, UserCog, Pencil, Power, Trash2, Link2, Link2Off,
  Users, X, Save, Info, ChevronDown, KeyRound, Mail, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HorarioEditor } from "@/components/HorarioEditor";
import { useAuthUser } from "@/routes/_authenticated/route";
import { criarFuncionario } from "@/lib/criar-funcionario.functions";
import { CORES_FUNCIONARIO, corFuncionario } from "@/lib/cores";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SetoresManager } from "@/components/SetoresManager";

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
  funcao_id: string | null;
  cor: string | null;
  funcao: { nome: string } | null;
  setores: { funcao_id: string }[];
  email: string | null;
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
      const { data, error } = await supabase.rpc("listar_funcionarios_com_email");
      if (error) throw error;
      return (data ?? []).map((f: any) => ({
        ...f,
        funcao: null,
        papel: f.papel as Papel,
        setores: Array.isArray(f.setores) ? f.setores : [],
        email: f.email ?? null,
      })) as Funcionario[];
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
      if (f.user_id) {
        const { error: eDis } = await supabase.rpc("desassociar_user_de_funcionario", {
          _funcionario_id: f.id,
        });
        if (eDis) throw eDis;
      }
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

  const updateCor = useMutation({
    mutationFn: async (args: { id: string; cor: string }) => {
      const { error } = await supabase
        .from("funcionarios")
        .update({ cor: args.cor })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedback(t("equipa.corChanged"));
      invalidateAll();
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  if (loadingRole) return <Shell><p className="text-muted-foreground">{t("common.loading")}</p></Shell>;
  if (!isGestor) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t("equipa.forbidden")}</p>
      </Shell>
    );
  }

  const funcoes = funcoesQuery.data ?? [];
  const funcionarios = funcionariosQuery.data ?? [];
  const unlinkedUsers = unlinkedUsersQuery.data ?? [];

  return (
    <Shell>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="hidden sm:grid h-12 w-12 place-items-center rounded-lg bg-foreground text-background"
          >
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("equipa.title")}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t("equipa.title")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-prose">{t("equipa.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => { setAdding(true); setEditing(null); setCreatingWithAccess(false); }}
            variant="outline"
            className="gap-2 rounded-full"
          >
            <UserPlus className="h-4 w-4" />
            {t("equipa.add")}
          </Button>
          <Button
            onClick={() => { setCreatingWithAccess(true); setAdding(false); setEditing(null); }}
            className="gap-2 rounded-full"
          >
            <KeyRound className="h-4 w-4" />
            {t("equipa.criar.openButton")}
          </Button>
        </div>
      </div>

      <div className="mt-8 surface-card p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-foreground shrink-0">
            <Info className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
              {t("equipa.helpTitle")}
            </h3>
            <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><span className="font-semibold text-foreground/70">1.</span>{t("equipa.helpStep1")}</li>
              <li className="flex gap-2"><span className="font-semibold text-foreground/70">2.</span>{t("equipa.helpStep2")}</li>
            </ol>
          </div>
        </div>
      </div>

      <SetoresManager />



      {feedback && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-soft animate-fade-in">
          <span>{feedback}</span>
          <button
            onClick={() => setFeedback(null)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("common.dismiss")}
          >
            <X className="h-4 w-4" />
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

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("equipa.col.nome")}</th>
                <th className="px-4 py-3 font-medium">{t("equipa.col.email")}</th>
                <th className="px-4 py-3 font-medium">{t("equipa.col.cor")}</th>
                <th className="px-4 py-3 font-medium">{t("equipa.col.setores")}</th>
                <th className="px-4 py-3 font-medium">{t("equipa.col.papel")}</th>
                <th className="px-4 py-3 font-medium">{t("equipa.col.estado")}</th>
                <th className="px-4 py-3 font-medium">{t("equipa.col.login")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("equipa.col.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {funcionarios.map((f) => (
                <tr key={f.id} className="text-foreground transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: corFuncionario(f.cor), boxShadow: `0 0 0 1px ${corFuncionario(f.cor)}33` }}
                        aria-hidden
                      />
                      {f.nome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.email ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[180px]" title={f.email}>{f.email}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CorPicker
                      value={f.cor}
                      onChange={(cor) => updateCor.mutate({ id: f.id, cor })}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex flex-wrap gap-1">
                      {(f.setores ?? []).length === 0 ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        (f.setores ?? []).map((s) => {
                          const nome = funcoes.find((fc) => fc.id === s.funcao_id)?.nome ?? "—";
                          return (
                            <span key={s.funcao_id} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                              {nome}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
                      {t(`roles.${f.papel}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      f.ativo
                        ? "bg-primary-soft text-primary"
                        : "bg-muted text-muted-foreground",
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", f.ativo ? "bg-primary" : "bg-muted-foreground/50")} />
                      {f.ativo ? t("equipa.active") : t("equipa.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {f.user_id ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary">
                          <Link2 className="h-3 w-3" />
                          {t("equipa.linked")}
                        </span>
                        <button
                          onClick={() => disassociate.mutate(f.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-ring"
                          title={t("equipa.unlink")}
                          aria-label={t("equipa.unlink")}
                        >
                          <Link2Off className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <SelectField
                        defaultValue=""
                        onChange={(uid) => { if (uid) associate.mutate({ funcionario_id: f.id, user_id: uid }); }}
                        compact
                      >
                        <option value="">{t("equipa.pickUser")}</option>
                        {unlinkedUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.email}</option>
                        ))}
                      </SelectField>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction
                        onClick={() => { setEditing(f); setAdding(false); }}
                        title={t("equipa.edit")}
                        tone="primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </IconAction>
                      <IconAction
                        onClick={() => toggleActive.mutate(f)}
                        title={f.ativo ? t("equipa.deactivate") : t("equipa.activate")}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </IconAction>
                      <IconAction
                        onClick={async () => {
                          const { data: hasHist } = await supabase.rpc("funcionario_tem_historico", {
                            _funcionario_id: f.id,
                          });
                          const msg = hasHist
                            ? t("equipa.confirmDeleteWithHistory", { name: f.nome })
                            : t("equipa.confirmDelete", { name: f.nome });
                          if (confirm(msg)) remove.mutate(f);
                        }}
                        title={t("equipa.delete")}
                        tone="destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              ))}
              {funcionarios.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t("equipa.empty")}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-border md:hidden">
          {funcionarios.map((f) => (
            <div key={f.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2.5 font-medium text-foreground">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: corFuncionario(f.cor) }}
                    aria-hidden
                  />
                  {f.nome}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  f.ativo ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
                )}>
                  {f.ativo ? t("equipa.active") : t("equipa.inactive")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(f.setores ?? []).map((s) => {
                  const nome = funcoes.find((fc) => fc.id === s.funcao_id)?.nome ?? "—";
                  return (
                    <span key={s.funcao_id} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium">
                      {nome}
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-1">
                <IconAction onClick={() => { setEditing(f); setAdding(false); }} title={t("equipa.edit")} tone="primary">
                  <Pencil className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction onClick={() => toggleActive.mutate(f)} title={f.ativo ? t("equipa.deactivate") : t("equipa.activate")}>
                  <Power className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction
                  onClick={async () => {
                    const { data: hasHist } = await supabase.rpc("funcionario_tem_historico", { _funcionario_id: f.id });
                    const msg = hasHist
                      ? t("equipa.confirmDeleteWithHistory", { name: f.nome })
                      : t("equipa.confirmDelete", { name: f.nome });
                    if (confirm(msg)) remove.mutate(f);
                  }}
                  title={t("equipa.delete")}
                  tone="destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconAction>
              </div>
            </div>
          ))}
          {funcionarios.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("equipa.empty")}</div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function IconAction({
  children,
  onClick,
  title,
  tone = "neutral",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: "neutral" | "primary" | "destructive";
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground focus-ring hover:scale-105",
        tone === "primary" && "hover:border-primary/30 hover:bg-primary-soft hover:text-primary",
        tone === "destructive" && "hover:border-destructive/30 hover:bg-destructive-soft hover:text-destructive",
        tone === "neutral" && "hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SelectField({
  children,
  value,
  defaultValue,
  onChange,
  compact,
}: {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="relative inline-flex w-full max-w-xs">
      <select
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none rounded-md border border-input bg-card pr-8 text-foreground focus-ring",
          compact ? "h-8 pl-2.5 text-xs" : "h-10 pl-3 text-sm",
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
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
  const initialSetores = initial?.setores?.map((s) => s.funcao_id)
    ?? (initial?.funcao_id ? [initial.funcao_id] : []);
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [setorIds, setSetorIds] = useState<string[]>(
    initialSetores.length ? initialSetores : (funcoes[0] ? [funcoes[0].id] : []),
  );
  const [papel, setPapel] = useState<Papel>(initial?.papel ?? "funcionario");
  const [ativo, setAtivo] = useState<boolean>(initial?.ativo ?? true);
  const [error, setError] = useState<string | null>(null);

  function toggleSetor(id: string) {
    setSetorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function syncSetores(funcionarioId: string) {
    const { data: existing, error: e1 } = await supabase
      .from("funcionario_setores")
      .select("funcao_id")
      .eq("funcionario_id", funcionarioId);
    if (e1) throw e1;
    const existingIds = new Set((existing ?? []).map((r) => r.funcao_id));
    const desired = new Set(setorIds);
    const toAdd = [...desired].filter((id) => !existingIds.has(id));
    const toRemove = [...existingIds].filter((id) => !desired.has(id));
    if (toAdd.length) {
      const { error } = await supabase
        .from("funcionario_setores")
        .insert(toAdd.map((funcao_id) => ({ funcionario_id: funcionarioId, funcao_id })));
      if (error) throw error;
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from("funcionario_setores")
        .delete()
        .eq("funcionario_id", funcionarioId)
        .in("funcao_id", toRemove);
      if (error) throw error;
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const cleanNome = nome.trim();
      if (!cleanNome || setorIds.length === 0) throw new Error(t("equipa.fillRequired"));
      const principal = setorIds[0];
      let funcionarioId: string;
      if (initial) {
        const { error } = await supabase
          .from("funcionarios")
          .update({ nome: cleanNome, funcao_id: principal, ativo })
          .eq("id", initial.id);
        if (error) throw error;
        funcionarioId = initial.id;
        if (papel !== initial.papel) {
          const { error: e2 } = await supabase.rpc("definir_papel_funcionario", {
            _funcionario_id: initial.id,
            _papel: papel,
          });
          if (e2) throw e2;
        }
      } else {
        const { data, error } = await supabase
          .from("funcionarios")
          .insert({ nome: cleanNome, funcao_id: principal, papel, ativo: true })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("insert_failed");
        funcionarioId = data.id;
      }
      await syncSetores(funcionarioId);
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="mt-6 surface-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
          {initial ? <UserCog className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
          {initial ? t("equipa.editTitle") : t("equipa.addTitle")}
        </h2>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={t("equipa.col.nome")}>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-ring"
          />
        </Field>
        <Field label={t("equipa.col.papel")}>
          <SelectField value={papel} onChange={(v) => setPapel(v as Papel)}>
            <option value="funcionario">{t("roles.funcionario")}</option>
            <option value="gestor">{t("roles.gestor")}</option>
          </SelectField>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("equipa.setoresLabel")} hint={t("equipa.setoresHint")}>
            <div className="flex flex-wrap gap-2 rounded-md border border-input bg-card p-3">
              {funcoes.map((f) => {
                const checked = setorIds.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      checked
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleSetor(f.id)}
                    />
                    {f.nome}
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
        {initial && (
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-[var(--primary)]"
            />
            {t("equipa.active")}
          </label>
        )}
      </div>
      {error && (
        <p className="mt-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {initial && (
        <div className="mt-6 border-t border-border pt-6">
          <HorarioEditor funcionarioId={initial.id} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2 rounded-full">
          <Save className="h-4 w-4" />
          {save.isPending ? t("common.saving") : t("common.save")}
        </Button>
        <Button onClick={onCancel} variant="outline" className="gap-2 rounded-full">
          <X className="h-4 w-4" />
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>
  );
}

function CriarFuncionarioForm({
  funcoes,
  onCreated,
  onCancel,
}: {
  funcoes: Funcao[];
  onCreated: (msg: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const callCriar = useServerFn(criarFuncionario);
  const [nome, setNome] = useState("");
  const [setorIds, setSetorIds] = useState<string[]>(funcoes[0] ? [funcoes[0].id] : []);
  const [papel, setPapel] = useState<Papel>("funcionario");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function translateError(raw: string): string {
    const key = `equipa.criar.errors.${raw}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return t("equipa.criar.errors.generic");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nome.trim() || setorIds.length === 0 || !email.trim() || password.length < 8) {
      setError(t("equipa.criar.errors.generic"));
      return;
    }
    setLoading(true);
    try {
      await callCriar({
        data: {
          nome: nome.trim(),
          funcao_id: setorIds[0],
          setor_ids: setorIds,
          papel,
          email: email.trim(),
          password,
          must_change_password: mustChange,
        },
      });
      onCreated(t("equipa.criar.success"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "generic";
      setError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 surface-card border-primary/30 p-6 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
          <KeyRound className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">{t("equipa.criar.title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("equipa.criar.subtitle")}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={t("equipa.col.nome")}>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-ring"
          />
        </Field>
        <Field label={t("equipa.col.papel")}>
          <SelectField value={papel} onChange={(v) => setPapel(v as Papel)}>
            <option value="funcionario">{t("roles.funcionario")}</option>
            <option value="gestor">{t("roles.gestor")}</option>
          </SelectField>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("equipa.setoresLabel")} hint={t("equipa.setoresHint")}>
            <div className="flex flex-wrap gap-2 rounded-md border border-input bg-card p-3">
              {funcoes.map((f) => {
                const checked = setorIds.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      checked
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setSetorIds((prev) =>
                          prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id],
                        )
                      }
                    />
                    {f.nome}
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
        <Field label={t("equipa.criar.emailLabel")}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground focus-ring"
            />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("equipa.criar.passwordLabel")} hint={t("equipa.criar.passwordHint")}>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 font-mono text-sm text-foreground focus-ring"
              />
            </div>
          </Field>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input
            type="checkbox"
            checked={mustChange}
            onChange={(e) => setMustChange(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-[var(--primary)]"
          />
          {t("equipa.criar.mustChange")}
        </label>
      </div>
      {error && (
        <p className="mt-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="submit" disabled={loading} className="gap-2 rounded-full">
          <UserPlus className="h-4 w-4" />
          {loading ? t("equipa.criar.submitting") : t("equipa.criar.submit")}
        </Button>
        <Button type="button" onClick={onCancel} variant="outline" className="gap-2 rounded-full">
          <X className="h-4 w-4" />
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

function CorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (cor: string) => void;
}) {
  const { t } = useTranslation();
  const current = corFuncionario(value);
  return (
    <div className="inline-flex items-center gap-2" title={t("equipa.corLabel")}>
      <span
        className="inline-block h-5 w-5 rounded-full ring-2 ring-background shrink-0"
        style={{ backgroundColor: current, boxShadow: `0 0 0 1px ${current}55` }}
        aria-hidden
      />
      <SelectField
        value={CORES_FUNCIONARIO.some((c) => c.value === value) ? (value ?? "") : ""}
        onChange={(v) => { if (v) onChange(v); }}
        compact
      >
        {!CORES_FUNCIONARIO.some((c) => c.value === value) && (
          <option value="">—</option>
        )}
        {CORES_FUNCIONARIO.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </SelectField>
    </div>
  );
}
