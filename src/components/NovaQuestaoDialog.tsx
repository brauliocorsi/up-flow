import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export function NovaQuestaoDialog({
  funcionarioId,
  atividadeId,
  tarefaDiaId,
  contextoTitulo,
  onClose,
  onCreated,
}: {
  funcionarioId: string;
  atividadeId?: string | null;
  tarefaDiaId?: string | null;
  contextoTitulo?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [assunto, setAssunto] = useState(contextoTitulo ?? "");
  const [tipo, setTipo] = useState<"duvida" | "autorizacao">("duvida");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: async () => {
      if (!assunto.trim() || !texto.trim()) throw new Error(t("questoes.fillRequired"));
      const { data: q, error: eQ } = await supabase
        .from("questoes")
        .insert({
          funcionario_id: funcionarioId,
          atividade_id: atividadeId ?? null,
          tarefa_dia_id: tarefaDiaId ?? null,
          assunto: assunto.trim(),
          tipo,
          estado: "aberta",
        })
        .select("id")
        .single();
      if (eQ) throw eQ;
      const { error: eM } = await supabase.from("questao_mensagens").insert({
        questao_id: q.id,
        autor_funcionario_id: funcionarioId,
        autor_papel: "operador",
        texto: texto.trim(),
        lida_pelo_operador: true,
      });
      if (eM) throw eM;
      return q.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["questoes-minhas"] });
      qc.invalidateQueries({ queryKey: ["questoes-list"] });
      onCreated?.(id);
      onClose();
    },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t("questoes.novaQuestao")}</h3>
          {contextoTitulo && <p className="text-xs text-muted-foreground">{t("questoes.contexto")}: {contextoTitulo}</p>}
        </div>
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground mb-1">{t("questoes.tipoLabel")}</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "duvida" | "autorizacao")} className="w-full rounded border border-input bg-background px-2 py-1.5">
            <option value="duvida">{t("questoes.tipo.duvida")}</option>
            <option value="autorizacao">{t("questoes.tipo.autorizacao")}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground mb-1">{t("questoes.assunto")}</span>
          <input value={assunto} onChange={(e) => setAssunto(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5" />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground mb-1">{t("questoes.descreveQuestao")}</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className="w-full rounded border border-input bg-background px-2 py-1.5" />
        </label>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:underline">{t("common.cancel")}</button>
          <button
            onClick={() => criar.mutate()}
            disabled={criar.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {criar.isPending ? t("questoes.aEnviar") : t("questoes.enviar")}
          </button>
        </div>
      </div>
    </div>
  );
}
