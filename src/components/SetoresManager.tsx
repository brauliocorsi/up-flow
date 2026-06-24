import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Briefcase, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Setor = { id: string; nome: string };

export function SetoresManager() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [editing, setEditing] = useState<Setor | null>(null);
  const [editNome, setEditNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const setoresQ = useQuery({
    queryKey: ["funcoes"],
    queryFn: async (): Promise<Setor[]> => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["funcoes"] });
    qc.invalidateQueries({ queryKey: ["funcionarios-all"] });
  };

  const createMut = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("funcoes").insert({ nome });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoNome("");
      setAdding(false);
      setErro(null);
      invalidate();
    },
    onError: (e: Error) => setErro(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (args: { id: string; nome: string }) => {
      const { error } = await supabase
        .from("funcoes")
        .update({ nome: args.nome })
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

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setErro(null);
      invalidate();
    },
    onError: (e: Error) =>
      setErro(t("setores.deleteErr", { defaultValue: "Não foi possível apagar. Há funcionários ou atividades ligados a este setor." })),
  });

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) {
      setErro(t("setores.fillRequired", { defaultValue: "Indica um nome." }));
      return;
    }
    createMut.mutate(nome);
  }

  function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const nome = editNome.trim();
    if (!nome) {
      setErro(t("setores.fillRequired", { defaultValue: "Indica um nome." }));
      return;
    }
    updateMut.mutate({ id: editing.id, nome });
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
            onClick={() => { setAdding(true); setEditing(null); setErro(null); }}
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
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder={t("setores.namePlaceholder", { defaultValue: "Ex.: Apoio/Vendas/Compras" })}
            className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" size="sm" className="gap-2 rounded-full" disabled={createMut.isPending}>
            <Save className="h-4 w-4" />
            {createMut.isPending ? t("common.saving") : t("common.save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => { setAdding(false); setNovoNome(""); setErro(null); }}
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
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
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
              <span className="text-sm font-medium text-foreground truncate">{s.nome}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={t("common.edit")}
                  title={t("common.edit")}
                  onClick={() => { setEditing(s); setEditNome(s.nome); setErro(null); }}
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
