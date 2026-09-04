import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Briefcase, Plus, Pencil, Trash2, Save, X, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Setor = { id: string; nome: string; prefixo: string | null; cor: string | null; ativo: boolean };

type FormState = { nome: string; prefixo: string; cor: string; ativo: boolean };

const EMPTY_FORM: FormState = { nome: "", prefixo: "", cor: "#64748B", ativo: true };

export function SetoresManager() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<Setor | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [erro, setErro] = useState<string | null>(null);

  const setoresQ = useQuery({
    queryKey: ["funcoes"],
    queryFn: async (): Promise<Setor[]> => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("id, nome, prefixo, cor, ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["funcoes"] });
    qc.invalidateQueries({ queryKey: ["funcionarios-all"] });
    qc.invalidateQueries({ queryKey: ["qualidade"] });
  };

  const createMut = useMutation({
    mutationFn: async (f: FormState) => {
      const { error } = await supabase.from("funcoes").insert({
        nome: f.nome,
        prefixo: f.prefixo.trim() || null,
        cor: f.cor.trim() || null,
        ativo: f.ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovo(EMPTY_FORM);
      setAdding(false);
      setErro(null);
      invalidate();
    },
    onError: (e: Error) => setErro(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (args: { id: string } & FormState) => {
      const { error } = await supabase
        .from("funcoes")
        .update({
          nome: args.nome,
          prefixo: args.prefixo.trim() || null,
          cor: args.cor.trim() || null,
          ativo: args.ativo,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      setErro(null);
      invalidate();
    },
    onError: (e: Error) => setErro(e.message),
  });

  const toggleAtivoMut = useMutation({
    mutationFn: async (s: Setor) => {
      const { error } = await supabase.from("funcoes").update({ ativo: !s.ativo }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => setErro(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setErro(null);
      invalidate();
    },
    onError: () =>
      setErro(t("setores.deleteErr", { defaultValue: "Não foi possível apagar. Há funcionários ou atividades ligados a este setor." })),
  });

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const nome = novo.nome.trim();
    if (!nome) {
      setErro(t("setores.fillRequired", { defaultValue: "Indica um nome." }));
      return;
    }
    createMut.mutate({ ...novo, nome });
  }

  function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const nome = editForm.nome.trim();
    if (!nome) {
      setErro(t("setores.fillRequired", { defaultValue: "Indica um nome." }));
      return;
    }
    updateMut.mutate({ id: editing.id, ...editForm, nome });
  }

  function handleDelete(s: Setor) {
    if (!confirm(t("setores.confirmDelete", { defaultValue: "Apagar o setor “{{nome}}”? Esta ação não pode ser desfeita.", nome: s.nome }))) return;
    deleteMut.mutate(s.id);
  }

  const setores = setoresQ.data ?? [];

  return (
    <section className="mt-8 surface-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground shrink-0">
            <Briefcase className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
              {t("setores.title", { defaultValue: "Setores" })}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("setores.subtitle", { defaultValue: "Cria e gere os setores aos quais os funcionários podem pertencer." })}
            </p>
          </div>
        </div>
        {!adding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => { setAdding(true); setEditing(null); setErro(null); setNovo(EMPTY_FORM); }}
          >
            <Plus className="h-4 w-4" />
            {t("setores.add", { defaultValue: "Novo setor" })}
          </Button>
        )}
      </div>

      {erro && (
        <p className="mt-3 text-sm text-destructive" role="alert">{erro}</p>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-center gap-2">
          <input
            autoFocus
            type="text"
            value={novo.nome}
            onChange={(e) => setNovo((f) => ({ ...f, nome: e.target.value }))}
            placeholder={t("setores.namePlaceholder", { defaultValue: "Ex.: Apoio/Vendas/Compras" })}
            className="flex-1 min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="text"
            value={novo.prefixo}
            onChange={(e) => setNovo((f) => ({ ...f, prefixo: e.target.value.toUpperCase() }))}
            placeholder="Prefixo"
            maxLength={6}
            className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="color"
            value={novo.cor || "#64748B"}
            onChange={(e) => setNovo((f) => ({ ...f, cor: e.target.value }))}
            className="h-9 w-10 rounded-md border border-input bg-background p-0.5"
            title="Cor"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={novo.ativo}
              onChange={(e) => setNovo((f) => ({ ...f, ativo: e.target.checked }))}
            />
            {t("common.active", { defaultValue: "Ativo" })}
          </label>
          <Button type="submit" size="sm" className="gap-2 rounded-full" disabled={createMut.isPending}>
            <Save className="h-4 w-4" />
            {createMut.isPending ? t("common.saving") : t("common.save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => { setAdding(false); setNovo(EMPTY_FORM); setErro(null); }}
          >
            <X className="h-4 w-4" />
            {t("common.cancel")}
          </Button>
        </form>
      )}

      <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
        {setores.length === 0 && (
          <li className="px-4 py-4 text-sm text-muted-foreground">
            {t("setores.empty", { defaultValue: "Ainda não há setores. Cria o primeiro." })}
          </li>
        )}
        {setores.map((s) =>
          editing?.id === s.id ? (
            <li key={s.id} className="px-3 py-2">
              <form onSubmit={handleUpdate} className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={editForm.nome}
                  onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                  className="flex-1 min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  value={editForm.prefixo}
                  onChange={(e) => setEditForm((f) => ({ ...f, prefixo: e.target.value.toUpperCase() }))}
                  placeholder="Prefixo"
                  maxLength={6}
                  className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="color"
                  value={editForm.cor || "#64748B"}
                  onChange={(e) => setEditForm((f) => ({ ...f, cor: e.target.value }))}
                  className="h-9 w-10 rounded-md border border-input bg-background p-0.5"
                  title="Cor"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={editForm.ativo}
                    onChange={(e) => setEditForm((f) => ({ ...f, ativo: e.target.checked }))}
                  />
                  {t("common.active", { defaultValue: "Ativo" })}
                </label>
                <Button type="submit" size="sm" className="gap-2 rounded-full" disabled={updateMut.isPending}>
                  <Save className="h-4 w-4" />
                  {updateMut.isPending ? t("common.saving") : t("common.save")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 rounded-full"
                  onClick={() => { setEditing(null); setErro(null); }}
                >
                  <X className="h-4 w-4" />
                  {t("common.cancel")}
                </Button>
              </form>
            </li>
          ) : (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm font-medium text-foreground truncate inline-flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: s.cor ?? "#64748B" }}
                  aria-hidden
                />
                {s.nome}
                {s.prefixo && (
                  <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {s.prefixo}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    s.ativo ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.ativo ? t("equipa.active", { defaultValue: "Ativo" }) : t("equipa.inactive", { defaultValue: "Inativo" })}
                </span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={s.ativo ? "Desativar" : "Ativar"}
                  title={s.ativo ? "Desativar" : "Ativar"}
                  onClick={() => toggleAtivoMut.mutate(s)}
                >
                  <Power className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={t("common.edit")}
                  title={t("common.edit")}
                  onClick={() => {
                    setEditing(s);
                    setEditForm({ nome: s.nome, prefixo: s.prefixo ?? "", cor: s.cor ?? "#64748B", ativo: s.ativo });
                    setErro(null);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-destructive hover:text-destructive"
                  aria-label={t("common.delete")}
                  title={t("common.delete")}
                  onClick={() => handleDelete(s)}
                  disabled={deleteMut.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          )
        )}
      </ul>
    </section>
  );
}
