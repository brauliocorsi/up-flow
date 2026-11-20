import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMeuFuncionario, dataHora, dataCurta, LABEL_PERIODICIDADE } from "@/lib/qualidade";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checklists/$execucaoId")({
  component: ExecucaoPage,
  head: () => ({
    meta: [
      { title: "Execução de checklist · UP Flow" },
      { name: "description", content: "Responde aos itens da verificação do setor a partir do telemóvel." },
      { property: "og:title", content: "Execução de checklist · UP Flow" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Responde aos itens da verificação do setor a partir do telemóvel." },
    ],
  }),
});


type Execucao = {
  id: string;
  estado: string;
  data_referencia: string;
  template_id: string;
  alvo_id: string | null;
};

type Item = {
  id: string;
  template_id: string;
  texto: string;
  tipo: string;
  ordem: number;
  obrigatorio: boolean;
  exige_foto_se_nok: boolean;
  instrucao: string | null;
  instrucao_media: string[];
};

type Resposta = {
  id: string;
  execucao_id: string;
  item_id: string;
  valor: string;
  observacao: string | null;
  foto_url: string | null;
  reporte_id: string | null;
  respondido_por: string;
  respondido_em: string;
  autor: { id: string; nome: string } | null;
};

function ExecucaoPage() {
  const { execucaoId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meuQ = useMeuFuncionario();
  const iniciouRef = useRef(false);
  const [reporteAviso, setReporteAviso] = useState<{ numero: string | null; setor: string; id: string } | null>(null);

  const execQ = useQuery({
    queryKey: ["checklist-execucao", execucaoId],
    queryFn: async (): Promise<Execucao> => {
      const { data, error } = await supabase
        .from("checklist_execucoes")
        .select("id, estado, data_referencia, template_id, alvo_id")
        .eq("id", execucaoId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const templateQ = useQuery({
    queryKey: ["checklist-template", execQ.data?.template_id],
    enabled: !!execQ.data?.template_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, nome, periodicidade")
        .eq("id", execQ.data!.template_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const alvoQ = useQuery({
    queryKey: ["checklist-alvo", execQ.data?.alvo_id],
    enabled: !!execQ.data?.alvo_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("alvos").select("id, nome").eq("id", execQ.data!.alvo_id!).single();
      if (error) throw error;
      return data;
    },
  });

  const iniciar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("checklist_execucoes")
        .update({ estado: "em_curso", iniciada_em: new Date().toISOString() })
        .eq("id", execucaoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-execucao", execucaoId] }),
  });

  useEffect(() => {
    if (iniciouRef.current) return;
    if (execQ.data && execQ.data.estado === "pendente") {
      iniciouRef.current = true;
      iniciar.mutate();
    }
  }, [execQ.data]);

  const itensQ = useQuery({
    queryKey: ["checklist-itens", execQ.data?.template_id],
    enabled: !!execQ.data?.template_id,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("checklist_itens")
        .select("*")
        .eq("template_id", execQ.data!.template_id)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const respostasQ = useQuery({
    queryKey: ["checklist-respostas", execucaoId],
    queryFn: async (): Promise<Resposta[]> => {
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select("*, autor:funcionarios!checklist_respostas_respondido_por_fkey(id, nome)")
        .eq("execucao_id", execucaoId);
      if (error) throw error;
      return (data ?? []) as unknown as Resposta[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`checklist-respostas-${execucaoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_respostas", filter: `execucao_id=eq.${execucaoId}` },
        () => qc.invalidateQueries({ queryKey: ["checklist-respostas", execucaoId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [execucaoId, qc]);

  const respostasPorItem = useMemo(() => {
    const map = new Map<string, Resposta>();
    (respostasQ.data ?? []).forEach((r) => map.set(r.item_id, r));
    return map;
  }, [respostasQ.data]);

  const itens = itensQ.data ?? [];
  const total = itens.length;
  const respondidos = itens.filter((i) => respostasPorItem.has(i.id)).length;
  const obrigatoriosPendentes = itens.filter((i) => i.obrigatorio && !respostasPorItem.has(i.id));
  const podeConcluir = total > 0 && obrigatoriosPendentes.length === 0;

  const concluir = useMutation({
    mutationFn: async () => {
      if (!meuQ.data) throw new Error("Sem utilizador");
      const { error } = await supabase
        .from("checklist_execucoes")
        .update({ estado: "concluida", concluida_em: new Date().toISOString(), concluida_por: meuQ.data.id })
        .eq("id", execucaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checklist concluído.");
      navigate({ to: "/checklists" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function salvarResposta(item: Item, params: { valor: string; observacao: string; fotoUrl?: string | null }) {
    if (!meuQ.data) return;
    if (item.tipo === "ok_nok" && params.valor === "nok" && item.exige_foto_se_nok && !params.fotoUrl) {
      toast.error("É obrigatório anexar uma foto para uma resposta NOK.");
      return;
    }
    const existente = respostasPorItem.get(item.id);
    const payload = {
      execucao_id: execucaoId,
      item_id: item.id,
      valor: params.valor,
      observacao: params.observacao || null,
      foto_url: params.fotoUrl ?? existente?.foto_url ?? null,
      respondido_por: meuQ.data.id,
    };
    if (existente) {
      const { error } = await supabase.from("checklist_respostas").update(payload).eq("id", existente.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("checklist_respostas").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    await qc.invalidateQueries({ queryKey: ["checklist-respostas", execucaoId] });
    if (params.valor === "nok") {
      const { data: nova } = await supabase
        .from("checklist_respostas")
        .select("reporte_id")
        .eq("execucao_id", execucaoId)
        .eq("item_id", item.id)
        .maybeSingle();
      if (nova?.reporte_id) {
        const { data: rep } = await supabase
          .from("reportes")
          .select("id, numero, setor_destino:funcoes!reportes_setor_destino_id_fkey(nome)")
          .eq("id", nova.reporte_id)
          .maybeSingle();
        if (rep) {
          setReporteAviso({ numero: rep.numero, id: rep.id, setor: (rep as unknown as { setor_destino: { nome: string } | null }).setor_destino?.nome ?? "—" });
        }
      }
    }
  }

  if (execQ.isLoading || itensQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">A carregar…</div>;
  }
  if (execQ.isError || !execQ.data) {
    return <div className="p-6 text-sm text-destructive">Não foi possível carregar este checklist.</div>;
  }

  return (
    <div className="px-4 py-6 max-w-xl mx-auto pb-28">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">{templateQ.data?.nome ?? "Checklist"}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {alvoQ.data && <span>{alvoQ.data.nome}</span>}
          <span>• {dataCurta(execQ.data.data_referencia)}</span>
          {templateQ.data?.periodicidade && (
            <span>• {LABEL_PERIODICIDADE[templateQ.data.periodicidade] ?? templateQ.data.periodicidade}</span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Progress value={total > 0 ? (respondidos / total) * 100 : 0} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums">{respondidos}/{total}</span>
        </div>
      </div>

      {reporteAviso && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          Foi aberto o reporte {reporteAviso.numero ?? ""} para o setor {reporteAviso.setor}.{" "}
          <Link to="/reportes/$id" params={{ id: reporteAviso.id }} className="underline font-medium">
            Ver reporte
          </Link>
        </div>
      )}

      {total === 0 && <p className="text-sm text-muted-foreground">Este checklist não tem itens.</p>}

      <div className="space-y-3">
        {itens.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            resposta={respostasPorItem.get(item.id) ?? null}
            meuFuncionarioId={meuQ.data?.id ?? null}
            execucaoId={execucaoId}
            onSalvar={(p) => salvarResposta(item, p)}
          />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-xl mx-auto">
          <Button className="w-full" size="lg" disabled={!podeConcluir || concluir.isPending} onClick={() => concluir.mutate()}>
            {concluir.isPending ? "A concluir…" : "Concluir checklist"}
          </Button>
          {!podeConcluir && total > 0 && (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Faltam {obrigatoriosPendentes.length} item(ns) obrigatório(s) por responder.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  resposta,
  meuFuncionarioId,
  execucaoId,
  onSalvar,
}: {
  item: Item;
  resposta: Resposta | null;
  meuFuncionarioId: string | null;
  execucaoId: string;
  onSalvar: (p: { valor: string; observacao: string; fotoUrl?: string | null }) => void | Promise<void>;
}) {
  const [valor, setValor] = useState(resposta?.valor ?? "");
  const [observacao, setObservacao] = useState(resposta?.observacao ?? "");
  const [uploading, setUploading] = useState(false);
  const [confirmar, setConfirmar] = useState<{ valor: string; fotoUrl?: string | null } | null>(null);

  useEffect(() => {
    setValor(resposta?.valor ?? "");
    setObservacao(resposta?.observacao ?? "");
  }, [resposta?.valor, resposta?.observacao]);

  function precisaConfirmar(novoValor: string, fotoUrl?: string | null): boolean {
    if (resposta && resposta.respondido_por !== meuFuncionarioId) {
      setConfirmar({ valor: novoValor, fotoUrl });
      return true;
    }
    return false;
  }

  async function guardar(v: string, fotoUrl?: string | null) {
    if (precisaConfirmar(v, fotoUrl)) return;
    setValor(v);
    await onSalvar({ valor: v, observacao, fotoUrl });
  }

  async function guardarObservacao() {
    if (!resposta && !valor) return;
    if (precisaConfirmar(valor)) return;
    await onSalvar({ valor: valor || resposta?.valor || "", observacao });
  }

  async function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const { uploadAnexos } = await import("@/lib/qualidade");
      const urls = await uploadAnexos(files, `checklists/${execucaoId}`);
      const url = urls[0];
      if (item.tipo === "foto") {
        await guardar(url, url);
      } else {
        // anexo de foto de suporte a um NOK
        await guardar(valor || resposta?.valor || "nok", url);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const temInstrucao = !!item.instrucao || (item.instrucao_media?.length ?? 0) > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-foreground">
          {item.texto}
          {item.obrigatorio && <span className="text-destructive"> *</span>}
        </p>
        {resposta && (
          <Badge variant="outline" className="shrink-0 text-xs">
            {resposta.autor?.nome ?? "—"}
          </Badge>
        )}
      </div>
      {resposta && (
        <p className="text-[11px] text-muted-foreground mt-0.5">Respondido em {dataHora(resposta.respondido_em)}</p>
      )}

      {temInstrucao && (
        <Collapsible className="mt-2">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
            Ver instrução <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {item.instrucao && <p className="text-sm text-muted-foreground">{item.instrucao}</p>}
            {(item.instrucao_media ?? []).map((url) => (
              <img key={url} src={url} alt="Instrução" className="rounded-md border border-border max-h-56" />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="mt-3">
        {item.tipo === "ok_nok" && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={valor === "ok" ? "default" : "outline"}
              className="flex-1"
              onClick={() => guardar("ok")}
            >
              OK
            </Button>
            <Button
              type="button"
              variant={valor === "nok" ? "destructive" : "outline"}
              className="flex-1"
              onClick={() => guardar("nok")}
            >
              NOK
            </Button>
          </div>
        )}

        {(item.tipo === "texto" || item.tipo === "numero") && (
          <Input
            type={item.tipo === "numero" ? "number" : "text"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => valor && guardar(valor)}
            placeholder="Resposta"
          />
        )}

        {item.tipo === "foto" && (
          <div>
            <input type="file" accept="image/*" capture="environment" onChange={onFoto} disabled={uploading} className="text-sm" />
            {resposta?.foto_url && <img src={resposta.foto_url} alt="Foto" className="mt-2 rounded-md border border-border max-h-56" />}
          </div>
        )}

        {item.tipo === "ok_nok" && valor === "nok" && item.exige_foto_se_nok && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">Foto obrigatória para resposta NOK</p>
            <input type="file" accept="image/*" capture="environment" onChange={onFoto} disabled={uploading} className="text-sm" />
            {resposta?.foto_url && <img src={resposta.foto_url} alt="Foto" className="mt-2 rounded-md border border-border max-h-56" />}
          </div>
        )}
      </div>

      <div className="mt-3">
        <Textarea
          placeholder="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          onBlur={guardarObservacao}
          rows={2}
        />
      </div>

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar resposta de outra pessoa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta resposta foi dada por {resposta?.autor?.nome ?? "outra pessoa"}. Queres alterá-la?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmar(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmar) return;
                setValor(confirmar.valor);
                await onSalvar({ valor: confirmar.valor, observacao, fotoUrl: confirmar.fotoUrl });
                setConfirmar(null);
              }}
            >
              Alterar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
