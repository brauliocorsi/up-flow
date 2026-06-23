import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/routes/_authenticated/auth-context";

export type Macro = {
  id: string;
  titulo: string;
  conteudo: string;
  atividade_id: string | null;
  funcao_id: string | null;
  ordem: number;
  ativo: boolean;
};

type Funcao = { id: string; nome: string };

type Props = {
  /** Manager mode allows create/edit/delete. */
  canManage: boolean;
  /** Scope filter. */
  scope:
    | { kind: "atividade"; atividadeId: string }
    | { kind: "geral"; funcoes?: Funcao[]; funcaoFilterIds?: string[] | null };
  /** Read-only override. */
  readOnly?: boolean;
};

export function MacrosSection({ canManage, scope, readOnly }: Props) {
  const { t } = useTranslation();
  const user = useAuthUser();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Macro | null>(null);
  const [adding, setAdding] = useState(false);
  const editable = canManage && !readOnly;

  const queryKey =
    scope.kind === "atividade"
      ? ["macros", "atividade", scope.atividadeId]
      : ["macros", "geral", (scope.funcaoFilterIds ?? []).join(",")];

  const { data: macros = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Macro[]> => {
      let q = supabase
        .from("macros")
        .select("id, titulo, conteudo, atividade_id, funcao_id, ordem, ativo")
        .eq("ativo", true)
        .order("ordem")
        .order("titulo");
      if (scope.kind === "atividade") {
        q = q.eq("atividade_id", scope.atividadeId);
      } else {
        q = q.is("atividade_id", null);
        if (scope.funcaoFilterIds && scope.funcaoFilterIds.length > 0) {
          // include global (funcao_id null) + within sectors
          const ids = scope.funcaoFilterIds.join(",");
          q = q.or(`funcao_id.is.null,funcao_id.in.(${ids})`);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Macro[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("macros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  function startAdd() {
    setAdding(true);
    setEditing(null);
  }

  return (
    <div className="space-y-3">
      {editable && !adding && !editing && (
        <button
          onClick={startAdd}
          className="rounded-md border border-dashed border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          + {t("macros.add")}
        </button>
      )}
      {(adding || editing) && editable && (
        <MacroForm
          initial={editing}
          scope={scope}
          createdBy={user.id}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            invalidate();
          }}
        />
      )}
      {isLoading && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
      {!isLoading && macros.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("macros.empty")}</p>
      )}
      <ul className="space-y-2">
        {macros.map((m) => (
          <li key={m.id} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">{m.titulo}</h4>
              {editable && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => {
                      setEditing(m);
                      setAdding(false);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t("macros.confirmDelete"))) remove.mutate(m.id);
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              )}
            </div>
            {m.conteudo && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {m.conteudo}
              </p>
            )}
            {scope.kind === "geral" && m.funcao_id && scope.funcoes && (
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {scope.funcoes.find((f) => f.id === m.funcao_id)?.nome ?? "—"}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MacroForm({
  initial,
  scope,
  createdBy,
  onSaved,
  onCancel,
}: {
  initial: Macro | null;
  scope: Props["scope"];
  createdBy: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [conteudo, setConteudo] = useState(initial?.conteudo ?? "");
  const [ordem, setOrdem] = useState<number>(initial?.ordem ?? 0);
  const [funcaoId, setFuncaoId] = useState<string>(
    initial?.funcao_id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const cleanTitle = titulo.trim();
      if (!cleanTitle) throw new Error(t("macros.fillRequired"));
      const payload: {
        titulo: string;
        conteudo: string;
        ordem: number;
        atividade_id: string | null;
        funcao_id: string | null;
        created_by?: string;
      } = {
        titulo: cleanTitle,
        conteudo: conteudo,
        ordem: Number.isFinite(ordem) ? Math.round(ordem) : 0,
        atividade_id: scope.kind === "atividade" ? scope.atividadeId : null,
        funcao_id:
          scope.kind === "geral"
            ? funcaoId
              ? funcaoId
              : null
            : null,
      };
      if (initial) {
        const { error } = await supabase
          .from("macros")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        payload.created_by = createdBy;
        const { error } = await supabase.from("macros").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  const funcoes = scope.kind === "geral" ? scope.funcoes ?? [] : [];

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t("macros.titulo")}</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={200}
          className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t("macros.conteudo")}</span>
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          rows={5}
          className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t("macros.ordem")}</span>
          <input
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(Number(e.target.value))}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        {scope.kind === "geral" && (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t("macros.setor")}</span>
            <select
              value={funcaoId}
              onChange={(e) => setFuncaoId(e.target.value)}
              className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">{t("macros.setorAll")}</option>
              {funcoes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {save.isPending ? t("common.saving") : t("common.save")}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
