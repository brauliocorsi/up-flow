import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

type Mensagem = {
  id: string;
  questao_id: string;
  autor_funcionario_id: string;
  autor_papel: "operador" | "gestor";
  texto: string;
  lida_pelo_gestor: boolean;
  lida_pelo_operador: boolean;
  created_at: string;
};

export type QuestaoBase = {
  id: string;
  funcionario_id: string;
  atividade_id: string | null;
  tarefa_dia_id: string | null;
  assunto: string;
  tipo: "duvida" | "autorizacao";
  estado: "aberta" | "respondida" | "fechada";
  created_at: string;
  updated_at?: string;
};

/**
 * Conversation modal for a single questão.
 * - `meuFuncionarioId`: id of the current user's funcionario row (author of replies).
 * - `papel`: 'gestor' or 'operador'. Determines who can close + which read flags to mark.
 */
export function QuestaoConversa({
  questao,
  meuFuncionarioId,
  papel,
  onClose,
}: {
  questao: QuestaoBase;
  meuFuncionarioId: string;
  papel: "operador" | "gestor";
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [reply, setReply] = useStateLocal("");

  const msgsQ = useQuery({
    queryKey: ["questao-msgs", questao.id],
    queryFn: async (): Promise<Mensagem[]> => {
      const { data, error } = await supabase
        .from("questao_mensagens")
        .select("*")
        .eq("questao_id", questao.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  // Realtime updates for this conversation
  useEffect(() => {
    const ch = supabase
      .channel(`questao-${questao.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questao_mensagens", filter: `questao_id=eq.${questao.id}` },
        () => qc.invalidateQueries({ queryKey: ["questao-msgs", questao.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [questao.id, qc]);

  // Mark as read on open
  useEffect(() => {
    const msgs = msgsQ.data;
    if (!msgs || msgs.length === 0) return;
    const idsToMark = msgs
      .filter((m) =>
        papel === "gestor"
          ? m.autor_papel === "operador" && !m.lida_pelo_gestor
          : m.autor_papel === "gestor" && !m.lida_pelo_operador,
      )
      .map((m) => m.id);
    if (idsToMark.length === 0) return;
    const patch = papel === "gestor" ? { lida_pelo_gestor: true } : { lida_pelo_operador: true };
    supabase
      .from("questao_mensagens")
      .update(patch)
      .in("id", idsToMark)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["questoes-list"] });
        qc.invalidateQueries({ queryKey: ["questoes-minhas"] });
        qc.invalidateQueries({ queryKey: ["questoes-unread-gestor"] });
      });
  }, [msgsQ.data, papel, qc]);

  const enviar = useMutation({
    mutationFn: async () => {
      const texto = reply.trim();
      if (!texto) throw new Error(t("questoes.fillRequired"));
      const { error: eMsg } = await supabase.from("questao_mensagens").insert({
        questao_id: questao.id,
        autor_funcionario_id: meuFuncionarioId,
        autor_papel: papel,
        texto,
        lida_pelo_gestor: papel === "gestor",
        lida_pelo_operador: papel === "operador",
      });
      if (eMsg) throw eMsg;
      // Update questao.estado on reply
      if (papel === "gestor" && questao.estado !== "fechada") {
        await supabase.from("questoes").update({ estado: "respondida" }).eq("id", questao.id);
      } else if (papel === "operador" && questao.estado === "respondida") {
        await supabase.from("questoes").update({ estado: "aberta" }).eq("id", questao.id);
      }
    },
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["questao-msgs", questao.id] });
      qc.invalidateQueries({ queryKey: ["questoes-list"] });
      qc.invalidateQueries({ queryKey: ["questoes-minhas"] });
    },
  });

  const fechar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("questoes")
        .update({ estado: "fechada" })
        .eq("id", questao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questoes-list"] });
      qc.invalidateQueries({ queryKey: ["questoes-minhas"] });
      onClose();
    },
  });

  const fmtT = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "pt" ? "pt-PT" : "en-GB", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-3" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-card border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t(`questoes.tipo.${questao.tipo}`)} · {t(`questoes.estado.${questao.estado}`)}
            </p>
            <h3 className="text-lg font-semibold text-foreground truncate">{questao.assunto}</h3>
          </div>
          <button onClick={onClose} className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent">
            {t("common.close")}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {(msgsQ.data ?? []).map((m) => {
            const mine = m.autor_papel === papel;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <p className="text-[10px] opacity-70 mb-1">
                    {m.autor_papel === "gestor" ? t("questoes.papel.gestor") : t("questoes.papel.operador")} · {fmtT(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{m.texto}</p>
                </div>
              </div>
            );
          })}
          {(msgsQ.data ?? []).length === 0 && !msgsQ.isLoading && (
            <p className="text-sm text-muted-foreground">{t("questoes.semMensagens")}</p>
          )}
        </div>
        {questao.estado !== "fechada" ? (
          <div className="border-t border-border p-3 space-y-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder={t("questoes.placeholderResposta")}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              {papel === "gestor" ? (
                <button
                  onClick={() => fechar.mutate()}
                  disabled={fechar.isPending}
                  className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                >
                  {t("questoes.marcarFechada")}
                </button>
              ) : <span />}
              <button
                onClick={() => enviar.mutate()}
                disabled={enviar.isPending || !reply.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {enviar.isPending ? t("questoes.aEnviar") : t("questoes.enviar")}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-border p-3 text-xs text-muted-foreground">{t("questoes.questaoFechada")}</div>
        )}
      </div>
    </div>
  );
}

// tiny inline useState to keep this file self-contained
import { useState } from "react";
function useStateLocal<T>(v: T) {
  return useState<T>(v);
}
