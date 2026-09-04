import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Gavel,
  Loader2,
  MessageSquare,
  Repeat,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CLASSE_ESTADO,
  CLASSE_GRAVIDADE,
  LABEL_ESTADO,
  LABEL_GRAVIDADE,
  corSetor,
  dataCurta,
  dataHora,
  formatarPrazo,
  useEGestor,
  useMeuFuncionario,
  useMeusSetores,
  type EstadoReporte,
} from "@/lib/qualidade";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reportes/$id")({
  component: DetalheReporte,
  head: () => ({
    meta: [
      { title: "Reporte · UP Flow" },
      { name: "description", content: "Detalhe, histórico e tratamento de um reporte de erro de processo." },
      { property: "og:title", content: "Reporte · UP Flow" },
      { property: "og:description", content: "Detalhe, histórico e tratamento de um reporte de erro de processo." },
    ],
  }),
});

type Reporte = {
  id: string;
  numero: string | null;
  titulo: string;
  descricao: string;
  estado: string;
  gravidade: string;
  anexos: string[];
  criado_em: string;
  respondido_em: string | null;
  prazo_resposta: string | null;
  prazo_resolucao: string | null;
  data_prevista: string | null;
  contestado_em: string | null;
  setor_origem_id: string | null;
  setor_destino_id: string;
  reportado_por: string;
  assumido_por: string | null;
  setor_origem: { nome: string; cor: string | null } | null;
  setor_destino: { nome: string; cor: string | null } | null;
  reportou: { nome: string } | null;
  assumiu: { nome: string } | null;
};

type Evento = {
  id: string;
  tipo: string;
  texto: string | null;
  estado_anterior: string | null;
  estado_novo: string | null;
  criado_em: string;
  anexos: string[];
  autor: { nome: string } | null;
};

type AcaoTipo = "assumir" | "corrigido" | "nao_procede" | "validar" | "contestar" | "decisao" | "reclassificar";

function DetalheReporte() {
  const { id } = useParams({ from: "/_authenticated/reportes/$id" });
  const qc = useQueryClient();
  const meQ = useMeuFuncionario();
  const gestorQ = useEGestor();
  const meusSetoresQ = useMeusSetores();
  const [acao, setAcao] = useState<AcaoTipo | null>(null);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const reporteQ = useQuery({
    queryKey: ["reportes", "detalhe", id],
    queryFn: async (): Promise<Reporte> => {
      const { data, error } = await supabase
        .from("reportes")
        .select(
          "*, setor_origem:funcoes!reportes_setor_origem_id_fkey(nome,cor), setor_destino:funcoes!reportes_setor_destino_id_fkey(nome,cor), reportou:funcionarios!reportes_reportado_por_fkey(nome), assumiu:funcionarios!reportes_assumido_por_fkey(nome)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as Reporte;
    },
  });

  const eventosQ = useQuery({
    queryKey: ["reportes", "eventos", id],
    queryFn: async (): Promise<Evento[]> => {
      const { data, error } = await supabase
        .from("reporte_eventos")
        .select("*, autor:funcionarios(nome)")
        .eq("reporte_id", id)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Evento[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`reporte-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reporte_eventos", filter: `reporte_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["reportes", "eventos", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reportes", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["reportes", "detalhe", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const comentar = useMutation({
    mutationFn: async () => {
      const me = meQ.data;
      if (!me) throw new Error("Sem colaborador associado à conta.");
      if (comentario.trim().length < 3) throw new Error("Escreve um comentário.");
      const { error } = await supabase.from("reporte_eventos").insert({
        reporte_id: id,
        autor_id: me.id,
        tipo: "comentario",
        texto: comentario.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setComentario("");
      setErro(null);
      qc.invalidateQueries({ queryKey: ["reportes", "eventos", id] });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const r = reporteQ.data;

  const pertenceDestino = useMemo(
    () => !!r && (meusSetoresQ.data ?? []).some((s) => s.id === r.setor_destino_id),
    [r, meusSetoresQ.data],
  );
  const souAutor = !!r && !!meQ.data && r.reportado_por === meQ.data.id;
  const eGestor = !!gestorQ.data;

  if (reporteQ.isLoading) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">A carregar…</p>;
  }
  if (!r) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Reporte não encontrado.</p>
        <Link to="/reportes" className="mt-3 inline-block text-sm underline">
          Voltar ao mural
        </Link>
      </div>
    );
  }

  const prazoResposta = formatarPrazo(r.prazo_resposta, agora);
  const prazoResolucao = formatarPrazo(r.prazo_resolucao, agora);

  const acoes: { tipo: AcaoTipo; label: string; visivel: boolean; variante?: "outline" | "destructive" }[] = [
    { tipo: "assumir", label: "Assumir", visivel: r.estado === "pendente" && (pertenceDestino || eGestor) },
    { tipo: "corrigido", label: "Marcar corrigido", visivel: r.estado === "a_tratar" && (pertenceDestino || eGestor) },
    { tipo: "nao_procede", label: "Não procede", visivel: r.estado === "a_tratar" && (pertenceDestino || eGestor), variante: "outline" },
    { tipo: "validar", label: "Validar", visivel: r.estado === "corrigido" && eGestor },
    {
      tipo: "contestar",
      label: "Contestar",
      visivel: ["corrigido", "nao_procede"].includes(r.estado) && (souAutor || eGestor) && (!r.contestado_em || eGestor),
      variante: "destructive",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to="/reportes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mural de reportes
      </Link>

      <header className="mt-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{r.numero ?? "—"}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", CLASSE_ESTADO[r.estado as EstadoReporte])}>
            {LABEL_ESTADO[r.estado as EstadoReporte] ?? r.estado}
          </span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", CLASSE_GRAVIDADE[r.gravidade as keyof typeof CLASSE_GRAVIDADE])}>
            {LABEL_GRAVIDADE[r.gravidade as keyof typeof LABEL_GRAVIDADE] ?? r.gravidade}
          </span>
          {r.contestado_em && (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-destructive">
              Contestado
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">{r.titulo}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.descricao}</p>

        {r.anexos?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {r.anexos.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-md border border-border px-2 py-1 text-[11px] underline">
                Anexo {i + 1}
              </a>
            ))}
          </div>
        )}

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Campo label="Setor destino">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corSetor(r.setor_destino?.cor) }} />
              {r.setor_destino?.nome ?? "—"}
            </span>
          </Campo>
          <Campo label="Setor origem">{r.setor_origem?.nome ?? "—"}</Campo>
          <Campo label="Reportado por">{r.reportou?.nome ?? "—"}</Campo>
          <Campo label="Assumido por">{r.assumiu?.nome ?? "—"}</Campo>
          <Campo label="Prazo de resposta">
            <span className={prazoResposta?.classe}>{prazoResposta?.texto ?? "—"}</span>
          </Campo>
          <Campo label="Prazo de resolução">
            <span className={prazoResolucao?.classe}>{prazoResolucao?.texto ?? "—"}</span>
          </Campo>
          <Campo label="Data prevista">{dataCurta(r.data_prevista)}</Campo>
          <Campo label="Criado em">{dataHora(r.criado_em)}</Campo>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {acoes.filter((a) => a.visivel).map((a) => (
            <Button key={a.tipo} size="sm" variant={a.variante} className="h-10" onClick={() => setAcao(a.tipo)}>
              {a.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-10 gap-1.5" onClick={() => setAcao("decisao")}>
            <Gavel className="h-4 w-4" /> Registar decisão
          </Button>
          {(pertenceDestino || eGestor) && (
            <Button size="sm" variant="outline" className="h-10 gap-1.5" onClick={() => setAcao("reclassificar")}>
              <Repeat className="h-4 w-4" /> Reclassificar
            </Button>
          )}
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Histórico</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {(eventosQ.data ?? []).map((ev) => (
            <li key={ev.id}>
              <EventoLinha ev={ev} />
            </li>
          ))}
          {(eventosQ.data ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">Ainda sem registos.</li>
          )}
        </ol>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <Label htmlFor="comentario" className="inline-flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" /> Comentar
        </Label>
        <Textarea
          id="comentario"
          rows={3}
          className="mt-2"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Acrescenta informação útil ao tratamento."
        />
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
        <div className="mt-2 flex justify-end">
          <Button size="sm" className="h-10" onClick={() => comentar.mutate()} disabled={comentar.isPending}>
            {comentar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Comentar
          </Button>
        </div>
      </section>

      <AcaoDialog
        acao={acao}
        reporteId={id}
        gravidadeAtual={r.gravidade}
        onClose={() => setAcao(null)}
        onDone={() => {
          setAcao(null);
          qc.invalidateQueries({ queryKey: ["reportes"] });
        }}
      />
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function EventoLinha({ ev }: { ev: Evento }) {
  const autor = ev.autor?.nome ?? "—";
  const quando = dataHora(ev.criado_em);

  if (ev.tipo === "decisao") {
    return (
      <div className="rounded-lg border border-foreground/20 bg-foreground/5 p-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
          <Gavel className="h-3.5 w-3.5" /> Decisão · {autor} · {quando}
        </p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{ev.texto}</p>
      </div>
    );
  }

  if (ev.tipo === "mudanca_estado") {
    return (
      <div className="rounded-md border border-border bg-card p-3">
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">
            {LABEL_ESTADO[ev.estado_anterior as EstadoReporte] ?? ev.estado_anterior ?? "—"} →{" "}
            {LABEL_ESTADO[ev.estado_novo as EstadoReporte] ?? ev.estado_novo ?? "—"}
          </span>
          · {autor} · {quando}
        </p>
        {ev.texto && <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{ev.texto}</p>}
      </div>
    );
  }

  if (ev.tipo === "reclassificacao" || ev.tipo === "contestacao") {
    return (
      <p className="flex flex-wrap items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Undo2 className="h-3.5 w-3.5" />
        {ev.texto} · {autor} · {quando}
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3">
      <p className="text-[11px] text-muted-foreground">{autor} · {quando}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{ev.texto}</p>
    </div>
  );
}

const CONFIG: Record<AcaoTipo, { titulo: string; descricao: string; min: number }> = {
  assumir: { titulo: "Assumir reporte", descricao: "Explica como vais tratar e indica a data prevista de resolução.", min: 15 },
  corrigido: { titulo: "Marcar como corrigido", descricao: "Descreve a correção aplicada.", min: 15 },
  nao_procede: { titulo: "Marcar como não procede", descricao: "Justifica porque o reporte não procede.", min: 15 },
  validar: { titulo: "Validar reporte", descricao: "Confirma a validação com uma nota.", min: 15 },
  contestar: { titulo: "Contestar", descricao: "Explica porque a resolução não te satisfaz.", min: 15 },
  decisao: { titulo: "Registar decisão", descricao: "Regista formalmente o que ficou combinado entre setores.", min: 20 },
  reclassificar: { titulo: "Reclassificar gravidade", descricao: "Justifica a alteração de gravidade.", min: 10 },
};

const NOVO_ESTADO: Partial<Record<AcaoTipo, string>> = {
  assumir: "a_tratar",
  corrigido: "corrigido",
  nao_procede: "nao_procede",
  validar: "validado",
  contestar: "a_tratar",
};

function AcaoDialog({
  acao,
  reporteId,
  gravidadeAtual,
  onClose,
  onDone,
}: {
  acao: AcaoTipo | null;
  reporteId: string;
  gravidadeAtual: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [gravidade, setGravidade] = useState(gravidadeAtual);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setTexto("");
    setDataPrevista("");
    setGravidade(gravidadeAtual);
    setErro(null);
  }, [acao, gravidadeAtual]);

  const cfg = acao ? CONFIG[acao] : null;

  const executar = useMutation({
    mutationFn: async () => {
      if (!acao || !cfg) return;
      if (texto.trim().length < cfg.min)
        throw new Error(`Escreve pelo menos ${cfg.min} caracteres.`);
      if (acao === "assumir" && !dataPrevista) throw new Error("Indica a data prevista de resolução.");

      if (acao === "decisao") {
        const { error } = await supabase.rpc("rc_registar_decisao", {
          p_reporte: reporteId,
          p_texto: texto.trim(),
        });
        if (error) throw new Error(error.message);
        return;
      }
      if (acao === "reclassificar") {
        const { error } = await supabase.rpc("rc_reclassificar", {
          p_reporte: reporteId,
          p_nova: gravidade,
          p_motivo: texto.trim(),
        });
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase.rpc("rc_mudar_estado", {
        p_reporte: reporteId,
        p_novo_estado: NOVO_ESTADO[acao]!,
        p_texto: texto.trim(),
        p_data_prevista: dataPrevista || undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: onDone,
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <Dialog open={!!acao} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cfg?.titulo}</DialogTitle>
          <DialogDescription>{cfg?.descricao}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {acao === "reclassificar" && (
            <div className="flex flex-col gap-1.5">
              <Label>Nova gravidade</Label>
              <div className="flex gap-2">
                {(["baixa", "media", "alta"] as const).map((g) => (
                  <Button
                    key={g}
                    type="button"
                    size="sm"
                    variant={gravidade === g ? "default" : "outline"}
                    className="h-10 flex-1"
                    onClick={() => setGravidade(g)}
                  >
                    {LABEL_GRAVIDADE[g]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="texto-acao">Justificação</Label>
            <Textarea
              id="texto-acao"
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Mínimo ${cfg?.min ?? 15} caracteres.`}
            />
            <p className="text-[11px] text-muted-foreground">{texto.trim().length} caracteres</p>
          </div>

          {acao === "assumir" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data-prevista">Data prevista de resolução</Label>
              <Input
                id="data-prevista"
                type="date"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
              />
            </div>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => executar.mutate()} disabled={executar.isPending}>
            {executar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
