import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LayoutGrid, List, Plus, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NovoReporteDialog } from "@/components/qualidade/NovoReporteDialog";
import {
  CLASSE_ESTADO,
  CLASSE_GRAVIDADE,
  ESTADOS_REPORTE,
  GRAVIDADES,
  LABEL_ESTADO,
  LABEL_GRAVIDADE,
  corSetor,
  dataCurta,
  formatarPrazo,
  useSetores,
  type EstadoReporte,
} from "@/lib/qualidade";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reportes/")({
  component: MuralReportes,
  head: () => ({
    meta: [
      { title: "Mural de Reportes · UP Flow" },
      {
        name: "description",
        content:
          "Acompanha os reportes de erro de processo por setor, prazos de resposta e resolução.",
      },
      { property: "og:title", content: "Mural de Reportes · UP Flow" },
      {
        property: "og:description",
        content: "Reportes de erro de processo por setor, com prazos e estado de tratamento.",
      },
    ],
  }),
});

type Reporte = {
  id: string;
  numero: string | null;
  titulo: string;
  estado: string;
  gravidade: string;
  criado_em: string | null;
  prazo_resposta: string | null;
  prazo_resolucao: string | null;
  respondido_em: string | null;
  setor_origem: string | null;
  setor_origem_id: string | null;
  setor_destino: string | null;
  setor_destino_id: string | null;
  reportado_por: string | null;
  reportado_por_nome: string | null;
  assumido_por: string | null;
  assumido_por_nome: string | null;
  foi_contestado: boolean | null;
  resposta_em_atraso: boolean | null;
  resolucao_em_atraso: boolean | null;
};

function MuralReportes() {
  const qc = useQueryClient();
  const setoresQ = useSetores(false);
  const [vista, setVista] = useState<"quadro" | "lista">("quadro");
  const [novo, setNovo] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const [fEstado, setFEstado] = useState("todos");
  const [fGravidade, setFGravidade] = useState("todas");
  const [fDestino, setFDestino] = useState("todos");
  const [fOrigem, setFOrigem] = useState("todos");
  const [fReportadoPor, setFReportadoPor] = useState("todos");
  const [fAssumidoPor, setFAssumidoPor] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [soAtraso, setSoAtraso] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const listaQ = useQuery({
    queryKey: ["reportes", "mural"],
    queryFn: async (): Promise<Reporte[]> => {
      const { data, error } = await supabase
        .from("vw_reportes_painel")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Reporte[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("mural-reportes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reportes" }, () =>
        qc.invalidateQueries({ queryKey: ["reportes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const pessoas = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of listaQ.data ?? []) {
      if (r.reportado_por && r.reportado_por_nome) m.set(r.reportado_por, r.reportado_por_nome);
      if (r.assumido_por && r.assumido_por_nome) m.set(r.assumido_por, r.assumido_por_nome);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [listaQ.data]);

  const filtrados = useMemo(() => {
    const src = listaQ.data ?? [];
    const deTs = de ? new Date(`${de}T00:00:00`).getTime() : null;
    const ateTs = ate ? new Date(`${ate}T23:59:59`).getTime() : null;
    return src
      .filter((r) => {
        if (fEstado !== "todos" && r.estado !== fEstado) return false;
        if (fGravidade !== "todas" && r.gravidade !== fGravidade) return false;
        if (fDestino !== "todos" && r.setor_destino_id !== fDestino) return false;
        if (fOrigem !== "todos" && r.setor_origem_id !== fOrigem) return false;
        if (fReportadoPor !== "todos" && r.reportado_por !== fReportadoPor) return false;
        if (fAssumidoPor !== "todos" && r.assumido_por !== fAssumidoPor) return false;
        const criado = r.criado_em ? new Date(r.criado_em).getTime() : 0;
        if (deTs && criado < deTs) return false;
        if (ateTs && criado > ateTs) return false;
        if (soAtraso && !(r.resposta_em_atraso || r.resolucao_em_atraso)) return false;
        return true;
      })
      .sort((a, b) => {
        const aa = a.resposta_em_atraso || a.resolucao_em_atraso ? 0 : 1;
        const bb = b.resposta_em_atraso || b.resolucao_em_atraso ? 0 : 1;
        if (aa !== bb) return aa - bb;
        return (b.criado_em ?? "").localeCompare(a.criado_em ?? "");
      });
  }, [listaQ.data, fEstado, fGravidade, fDestino, fOrigem, fReportadoPor, fAssumidoPor, de, ate, soAtraso]);

  const emAtraso = filtrados.filter((r) => r.resposta_em_atraso || r.resolucao_em_atraso).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Mural de Reportes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtrados.length} reporte{filtrados.length === 1 ? "" : "s"}
            {emAtraso > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> {emAtraso} em atraso
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5"
            onClick={() => setMostrarFiltros((v) => !v)}
          >
            <Filter className="h-4 w-4" /> Filtros
          </Button>
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setVista("quadro")}
              aria-label="Vista em quadro"
              className={cn(
                "flex h-10 w-10 items-center justify-center",
                vista === "quadro" ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setVista("lista")}
              aria-label="Vista em lista"
              className={cn(
                "flex h-10 w-10 items-center justify-center",
                vista === "lista" ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {mostrarFiltros && (
        <section className="mt-4 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <FiltroSelect label="Estado" value={fEstado} onChange={setFEstado} opcoes={[{ v: "todos", l: "Todos" }, ...ESTADOS_REPORTE.map((e) => ({ v: e, l: LABEL_ESTADO[e] }))]} />
          <FiltroSelect label="Gravidade" value={fGravidade} onChange={setFGravidade} opcoes={[{ v: "todas", l: "Todas" }, ...GRAVIDADES.map((g) => ({ v: g, l: LABEL_GRAVIDADE[g] }))]} />
          <FiltroSelect label="Setor destino" value={fDestino} onChange={setFDestino} opcoes={[{ v: "todos", l: "Todos" }, ...(setoresQ.data ?? []).map((s) => ({ v: s.id, l: s.nome }))]} />
          <FiltroSelect label="Setor origem" value={fOrigem} onChange={setFOrigem} opcoes={[{ v: "todos", l: "Todos" }, ...(setoresQ.data ?? []).map((s) => ({ v: s.id, l: s.nome }))]} />
          <FiltroSelect label="Reportado por" value={fReportadoPor} onChange={setFReportadoPor} opcoes={[{ v: "todos", l: "Todos" }, ...pessoas.map(([id, n]) => ({ v: id, l: n }))]} />
          <FiltroSelect label="Assumido por" value={fAssumidoPor} onChange={setFAssumidoPor} opcoes={[{ v: "todos", l: "Todos" }, ...pessoas.map(([id, n]) => ({ v: id, l: n }))]} />
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch id="so-atraso" checked={soAtraso} onCheckedChange={setSoAtraso} />
            <Label htmlFor="so-atraso" className="text-sm">Só em atraso</Label>
          </div>
        </section>
      )}

      {listaQ.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">A carregar reportes…</p>
      ) : filtrados.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Sem reportes para os filtros escolhidos.
        </p>
      ) : vista === "quadro" ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {ESTADOS_REPORTE.map((estado) => {
            const cards = filtrados.filter((r) => r.estado === estado);
            return (
              <section key={estado} className="flex flex-col gap-2">
                <h2 className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {LABEL_ESTADO[estado]}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{cards.length}</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {cards.map((r) => (
                    <CartaoReporte key={r.id} r={r} agora={agora} />
                  ))}
                  {cards.length === 0 && (
                    <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                      Vazio
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="py-2 pr-3">Número</th>
                <th className="py-2 pr-3">Título</th>
                <th className="py-2 pr-3">Destino</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Gravidade</th>
                <th className="py-2 pr-3">Reportou</th>
                <th className="py-2 pr-3">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const prazo = formatarPrazo(
                  r.respondido_em ? r.prazo_resolucao : r.prazo_resposta,
                  agora,
                );
                return (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="py-2 pr-3 font-mono text-xs">
                      <Link to="/reportes/$id" params={{ id: r.id }} className="hover:underline">
                        {r.numero ?? "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      <Link to="/reportes/$id" params={{ id: r.id }} className="hover:underline">
                        {r.titulo}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{r.setor_destino ?? "—"}</td>
                    <td className="py-2 pr-3">{LABEL_ESTADO[r.estado as EstadoReporte] ?? r.estado}</td>
                    <td className="py-2 pr-3">{LABEL_GRAVIDADE[r.gravidade as keyof typeof LABEL_GRAVIDADE] ?? r.gravidade}</td>
                    <td className="py-2 pr-3">{r.reportado_por_nome ?? "—"}</td>
                    <td className={cn("py-2 pr-3 text-xs", prazo?.classe)}>{prazo?.texto ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Button
        onClick={() => setNovo(true)}
        className="fixed bottom-20 right-4 z-40 h-14 gap-2 rounded-full px-5 shadow-lg md:bottom-6"
      >
        <Plus className="h-5 w-5" /> Reportar erro
      </Button>

      <NovoReporteDialog open={novo} onOpenChange={setNovo} />
    </div>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  opcoes,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: { v: string; l: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CartaoReporte({ r, agora, cor }: { r: Reporte; agora: number; cor?: string | null }) {
  const atrasado = !!(r.resposta_em_atraso || r.resolucao_em_atraso);
  const prazo = formatarPrazo(r.respondido_em ? r.prazo_resolucao : r.prazo_resposta, agora);
  return (
    <Link
      to="/reportes/$id"
      params={{ id: r.id }}
      className={cn(
        "block rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40",
        atrasado ? "border-destructive/50" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{r.numero ?? "—"}</span>
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
            CLASSE_GRAVIDADE[r.gravidade as keyof typeof CLASSE_GRAVIDADE],
          )}
        >
          {LABEL_GRAVIDADE[r.gravidade as keyof typeof LABEL_GRAVIDADE] ?? r.gravidade}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium text-foreground">{r.titulo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corSetor(cor) }} />
          {r.setor_destino ?? "—"}
        </span>

        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px]",
            CLASSE_ESTADO[r.estado as EstadoReporte],
          )}
        >
          {LABEL_ESTADO[r.estado as EstadoReporte] ?? r.estado}
        </span>
        {r.foi_contestado && (
          <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-destructive">
            Contestado
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{r.reportado_por_nome ?? "—"} · {dataCurta(r.criado_em)}</span>
        {prazo && <span className={prazo.classe}>{prazo.texto}</span>}
      </div>
    </Link>
  );
}
