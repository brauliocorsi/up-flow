import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  enviarCentral,
  useCentralLista,
  useCentralPessoas,
  type ReporteCentral,
} from "@/lib/central";
import { type DadosCentral, type Fase } from "@/lib/central-regras";
import { dataHora, LABEL_ESTADO, useMeuFuncionario, type EstadoReporte } from "@/lib/qualidade";
import { CampoCentral, EscolhaCentral, PessoasCentral } from "./NovoReporteDialog";
import { FicheirosCentral, SelecionarFicheiros } from "./FicheirosCentral";

type Acao =
  | "comentar"
  | "responder"
  | "envolvidos"
  | "atribuir"
  | "apurar"
  | "assumir"
  | "corrigir"
  | "validar"
  | "rejeitar"
  | "arquivar";
const labels: Record<Acao, string> = {
  comentar: "Comentar",
  responder: "Responder à minha participação",
  envolvidos: "Atualizar envolvidos",
  atribuir: "Atribuir correção / prazo",
  apurar: "Apurar causa e responsabilidade",
  assumir: "Iniciar tratamento",
  corrigir: "Registar correção",
  validar: "Validar",
  rejeitar: "Rejeitar / reabrir",
  arquivar: "Não procede · arquivar",
};
export function DetalheCentral({ id }: { id: string }) {
  const qc = useQueryClient();
  const lista = useCentralLista();
  const pessoas = useCentralPessoas();
  const me = useMeuFuncionario();
  const [acao, setAcao] = useState<Acao | null>(null);
  const r = lista.data?.find((r) => r.id === id);
  useEffect(() => {
    const channel = supabase
      .channel(`central-detail-${id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reportes", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["reportes"] }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reporte_eventos",
          filter: `reporte_id=eq.${id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["reportes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);
  const perms = useQuery({
    queryKey: ["central", "permissoes", id],
    queryFn: async () => {
      const [g, m] = await Promise.all([
        supabase.rpc("central_gestor"),
        supabase.rpc("central_gerir", { p_id: id }),
      ]);
      if (g.error || m.error) throw new Error("Não foi possível verificar as permissões.");
      return { gestor: !!g.data, gerir: !!m.data };
    },
  });
  const eventos = useQuery({
    queryKey: ["reportes", "eventos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reporte_eventos")
        .select("id,autor_id,tipo,texto,criado_em,estado_anterior,estado_novo,anexos")
        .eq("reporte_id", id)
        .order("criado_em");
      if (error) throw error;
      return data;
    },
  });
  const respostas = useQuery({
    queryKey: ["reportes", "respostas", id],
    queryFn: async () => {
      const { data: parts, error: pError } = await supabase
        .from("reporte_envolvidos")
        .select("id")
        .eq("reporte_id", id);
      if (pError) throw pError;
      if (!parts.length) return [];
      const { data, error } = await supabase
        .from("reporte_respostas_individuais")
        .select("*")
        .in(
          "envolvido_id",
          parts.map((p) => p.id),
        )
        .order("criado_em");
      if (error) throw error;
      return data;
    },
  });
  const legacy = useQuery({
    queryKey: ["reportes", "legacy-anexos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reportes")
        .select("anexos")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data.anexos;
    },
  });
  const nome = (pid: string | null) =>
    pessoas.data?.find((p) => p.id === pid)?.nome ?? "Não indicado";
  if (lista.isPending)
    return (
      <p role="status" className="p-6">
        A carregar reporte…
      </p>
    );
  if (!r)
    return (
      <div className="p-6">
        <p role="alert">Reporte inexistente ou sem permissão de acesso.</p>
        <Link to="/reportes/kanban" className="text-primary underline">
          Voltar à central
        </Link>
      </div>
    );
  const involved = r.envolvidos.some((p) => p.id === me.data?.id);
  const gestor = perms.data?.gestor;
  const gerir = perms.data?.gerir;
  const actions: Acao[] = [
    "comentar",
    ...(involved ? ["responder" as const] : []),
    ...(gerir ? ["envolvidos" as const, "atribuir" as const] : []),
    ...(gestor ? ["apurar" as const] : []),
  ];
  if (r.estado === "pendente" && gerir) actions.push("assumir");
  if (r.estado === "a_tratar" && (gerir || r.assumido_por === me.data?.id))
    actions.push("corrigir");
  if (r.estado === "corrigido" && gestor && r.corrigido_por !== me.data?.id)
    actions.push("validar");
  if (
    ["corrigido", "nao_procede"].includes(r.estado) &&
    (gestor || r.reportado_por === me.data?.id)
  )
    actions.push("rejeitar");
  if (["pendente", "a_tratar"].includes(r.estado) && gerir) actions.push("arquivar");
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <Link to="/reportes/kanban" className="inline-flex items-center gap-2 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" />
        Central de Erros e Reportes
      </Link>
      <header className="space-y-3 border-b border-border pb-5">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="font-mono">{r.numero}</span>
          <span>{LABEL_ESTADO[r.estado as EstadoReporte]}</span>
          <span>Gravidade: {r.gravidade}</span>
          {r.contestado_em && <span className="text-destructive">Contestado</span>}
        </div>
        <h1 className="break-words font-display text-2xl font-semibold">{r.titulo}</h1>
        <p className="whitespace-pre-wrap break-words text-sm">{r.descricao}</p>
        <FicheirosCentral reporteId={id} />
        {(legacy.data ?? []).length > 0 && <AnexosLegados urls={legacy.data ?? []} />}
      </header>
      <section aria-label="Contexto do reporte">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Info label="Quem reportou" value={r.criador} />
          <Info label="Executor da correção" value={r.executor ?? "Por atribuir"} />
          <Info label="Setor onde ocorreu" value={r.origem ?? "Não indicado"} />
          <Info label="Setor afetado / destino" value={r.destino} />
          <Info label="Ocorrência" value={dataHora(r.ocorrido_em)} />
          <Info label="Detetado" value={dataHora(r.detetado_em)} />
          <Info label="Reportado" value={dataHora(r.criado_em)} />
          <Info label="Prazo de resolução" value={dataHora(r.prazo_resolucao)} />
          <Info
            label="Referência externa"
            value={`${r.referencia_tipo ?? ""} ${r.referencia_externa ?? "—"}`}
          />
          <Info label="UP Care" value={r.up_care_referencia ?? "—"} />
          <Info label="Causa alegada (por apurar)" value={r.causa_alegada ?? "Não indicada"} />
          <Info
            label="Participação — hipótese, sem presunção de culpa"
            value={r.envolvidos.map((p) => p.nome).join(", ") || "Desconhecida / não indicada"}
          />
        </dl>
      </section>
      <section className="space-y-3 border-y border-border py-5">
        <h2 className="font-display text-lg font-semibold">Apuração, correção e validação</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Info
            label="Apuração"
            value={
              r.apurado_em
                ? `${r.erro_confirmado ? "Erro confirmado" : "Não confirmado"} · ${r.tipo_causa}`
                : "Por apurar"
            }
          />
          <Info label="Decisão de" value={nome(r.apurado_por)} />
          <Info label="Conclusão fundamentada" value={r.conclusao ?? "Sem conclusão"} />
          <Info label="Evidência da apuração" value={r.evidencia_apuracao ?? "Não registada"} />
          {gestor && (
            <Info
              label="Responsáveis após apuração (não confundir com envolvidos)"
              value={r.responsaveis_apurados.map(nome).join(", ") || "Sem atribuição individual"}
            />
          )}
          <Info label="Correção executada por" value={nome(r.corrigido_por)} />
          <Info label="Resultado da correção" value={r.correcao_resultado ?? "Por registar"} />
          <Info label="Validação por" value={nome(r.validado_por)} />
          <Info label="Evidência da validação" value={r.validacao_evidencia ?? "Por registar"} />
        </dl>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a}
              variant={a === "comentar" ? "default" : "outline"}
              onClick={() => setAcao(a)}
            >
              {labels[a]}
            </Button>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">
          Respostas individuais · acesso restrito
        </h2>
        {respostas.isError && (
          <p role="alert" className="text-destructive">
            Não foi possível carregar respostas.
          </p>
        )}
        {(respostas.data ?? []).map((resp) => (
          <article key={resp.id} className="border-l-2 border-primary pl-4 text-sm">
            <p className="text-xs text-muted-foreground">
              {nome(resp.autor_id)} · {dataHora(resp.criado_em)} ·{" "}
              {
                {
                  reconheco: "Reconheço",
                  contesto: "Contesto",
                  esclarecimentos: "Preciso de esclarecimentos",
                }[resp.resposta]
              }
            </p>
            <p className="mt-2 whitespace-pre-wrap">{resp.texto}</p>
          </article>
        ))}
        {!respostas.data?.length && (
          <p className="text-sm text-muted-foreground">Sem respostas individuais visíveis.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Histórico auditado</h2>
        {eventos.isError && (
          <p role="alert" className="text-destructive">
            Não foi possível carregar o histórico.
          </p>
        )}
        <ol className="space-y-4">
          {(eventos.data ?? []).map((e) => (
            <li key={e.id} className="border-l border-border pl-4">
              <p className="text-xs text-muted-foreground">
                {nome(e.autor_id)} · {dataHora(e.criado_em)} ·{" "}
                {e.tipo === "decisao"
                  ? "Decisão fundamentada"
                  : e.tipo === "mudanca_estado"
                    ? `${LABEL_ESTADO[e.estado_anterior as EstadoReporte]} → ${LABEL_ESTADO[e.estado_novo as EstadoReporte]}`
                    : "Interação"}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{e.texto}</p>
              <FicheirosCentral reporteId={id} eventoId={e.id} />
              {e.anexos.length > 0 && <AnexosLegados urls={e.anexos} />}
            </li>
          ))}
        </ol>
      </section>
      {acao && (
        <AcaoCentral
          acao={acao}
          r={r}
          pessoas={pessoas.data ?? []}
          onClose={() => setAcao(null)}
          onDone={() => {
            setAcao(null);
            qc.invalidateQueries({ queryKey: ["reportes"] });
            qc.invalidateQueries({ queryKey: ["central", "notificacoes"] });
          }}
        />
      )}
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words">{value}</dd>
    </div>
  );
}
function AnexosLegados({ urls }: { urls: string[] }) {
  const [erro, setErro] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <Button
          key={url}
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const parsed = new URL(url);
              const prefix = "/storage/v1/object/sign/qualidade/";
              const at = parsed.pathname.indexOf(prefix);
              if (at < 0) throw new Error("Anexo antigo requer verificação manual do vínculo.");
              const path = decodeURIComponent(parsed.pathname.slice(at + prefix.length));
              const { data, error } = await supabase.storage
                .from("qualidade")
                .createSignedUrl(path, 300);
              if (error || !data) throw new Error("Sem acesso ao anexo antigo.");
              window.open(data.signedUrl, "_blank", "noopener,noreferrer");
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Sem acesso");
            }
          }}
        >
          Anexo anterior {i + 1}
        </Button>
      ))}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
function AcaoCentral({
  acao,
  r,
  pessoas,
  onClose,
  onDone,
}: {
  acao: Acao;
  r: ReporteCentral;
  pessoas: { id: string; nome: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [d, setD] = useState<DadosCentral>({
    id: r.id,
    envolvidos: r.envolvidos.map((p) => p.id),
    tipo_causa: "desconhecida",
    responsaveis: [],
    confirmado: false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [erro, setErro] = useState("");
  function field<K extends keyof DadosCentral>(k: K, v: DadosCentral[K]) {
    setD((x) => ({ ...x, [k]: v }));
  }
  const state: Partial<Record<Acao, DadosCentral["estado"]>> = {
    assumir: "a_tratar",
    corrigir: "corrigido",
    validar: "validado",
    rejeitar: "a_tratar",
    arquivar: "nao_procede",
  };
  const phase: Record<Acao, Fase> = {
    comentar: "comentario",
    responder: "resposta",
    envolvidos: "atribuicao",
    atribuir: "atribuicao",
    apurar: "apuracao",
    assumir: "comentario",
    corrigir: "correcao",
    validar: "validacao",
    rejeitar: r.corrigido_por ? "validacao" : "comentario",
    arquivar: "comentario",
  };
  const enviar = useMutation({
    mutationFn: () =>
      enviarCentral(
        state[acao] ? "estado" : acao,
        phase[acao],
        { ...d, estado: state[acao] },
        files,
      ),
    onSuccess: onDone,
    onError: (e) => setErro(e.message),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && !enviar.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{labels[acao]}</DialogTitle>
          <DialogDescription>
            {acao === "responder"
              ? "A tua resposta fica registada individualmente, com autor e data. Reconhecer participação não constitui decisão de culpa."
              : "Registo com autor, data e evidência escrita; anexos privados complementam a informação."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {acao === "responder" && (
            <EscolhaCentral
              label="A minha resposta"
              value={d.resposta ?? ""}
              onChange={(v) => field("resposta", v as DadosCentral["resposta"])}
              options={[
                { id: "reconheco", nome: "Reconheço" },
                { id: "contesto", nome: "Contesto" },
                { id: "esclarecimentos", nome: "Preciso de esclarecimentos" },
              ]}
            />
          )}
          {acao === "envolvidos" && (
            <PessoasCentral
              value={d.envolvidos ?? []}
              onChange={(v) => field("envolvidos", v)}
              pessoas={pessoas}
            />
          )}
          {acao === "atribuir" && (
            <>
              <EscolhaCentral
                label="Executor da correção"
                value={d.assumido_por ?? ""}
                onChange={(v) => field("assumido_por", v)}
                options={pessoas}
              />
              <CampoCentral label="Prazo de resolução">
                <Input
                  type="datetime-local"
                  value={d.prazo ?? ""}
                  onChange={(e) => field("prazo", e.target.value)}
                />
              </CampoCentral>
            </>
          )}
          {(acao === "assumir" || acao === "atribuir") && (
            <CampoCentral label="Data prevista de resolução">
              <Input
                type="date"
                value={d.data_prevista ?? ""}
                onChange={(e) => field("data_prevista", e.target.value)}
              />
            </CampoCentral>
          )}
          {acao === "apurar" && (
            <>
              <EscolhaCentral
                label="Causa apurada"
                value={d.tipo_causa ?? "desconhecida"}
                onChange={(v) => {
                  field("tipo_causa", v as DadosCentral["tipo_causa"]);
                  if (v !== "pessoa") field("responsaveis", []);
                }}
                options={[
                  { id: "desconhecida", nome: "Desconhecida" },
                  { id: "processo", nome: "Processo" },
                  { id: "sistema", nome: "Sistema" },
                  { id: "fornecedor", nome: "Fornecedor" },
                  { id: "pessoa", nome: "Individual (após apuração)" },
                ]}
              />
              <label className="flex gap-2 text-sm">
                <Checkbox
                  checked={d.confirmado}
                  onCheckedChange={(v) => field("confirmado", v === true)}
                />
                Erro confirmado após análise de evidência
              </label>
              {d.tipo_causa === "pessoa" && (
                <PessoasCentral
                  label="Responsabilidade apurada com evidência"
                  value={d.responsaveis ?? []}
                  onChange={(v) => field("responsaveis", v)}
                  pessoas={pessoas}
                />
              )}
              <CampoCentral label="Evidência fundamentada">
                <Textarea
                  maxLength={10000}
                  value={d.evidencia ?? ""}
                  onChange={(e) => field("evidencia", e.target.value)}
                />
              </CampoCentral>
            </>
          )}
          <CampoCentral
            label={
              acao === "corrigir"
                ? "Ação realizada e notas"
                : acao === "validar"
                  ? "Evidência da validação"
                  : acao === "arquivar" || acao === "rejeitar"
                    ? "Justificação obrigatória"
                    : acao === "apurar"
                      ? "Conclusão fundamentada"
                      : "Texto / fundamentação"
            }
          >
            <Textarea
              rows={4}
              maxLength={10000}
              value={d.texto ?? ""}
              onChange={(e) => field("texto", e.target.value)}
            />
          </CampoCentral>
          {acao === "corrigir" && (
            <CampoCentral label="Resultado verificado da correção">
              <Textarea
                maxLength={10000}
                value={d.resultado ?? ""}
                onChange={(e) => field("resultado", e.target.value)}
              />
            </CampoCentral>
          )}
          <SelecionarFicheiros files={files} onChange={setFiles} />
          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={enviar.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={enviar.isPending} onClick={() => enviar.mutate()}>
            {enviar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
