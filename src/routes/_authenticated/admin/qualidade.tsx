import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ShieldAlert,
  Loader2,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Power,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SetoresManager } from "@/components/SetoresManager";
import { MetricasCentral } from "@/components/qualidade/MetricasCentral";
import { cn } from "@/lib/utils";
import {
  useEGestor,
  useSetores,
  LABEL_ESTADO,
  CLASSE_ESTADO,
  LABEL_GRAVIDADE,
  CLASSE_GRAVIDADE,
  LABEL_PERIODICIDADE,
  LABEL_ESTADO_EXEC,
  dataCurta,
  dataHora,
  corSetor,
  type EstadoReporte,
} from "@/lib/qualidade";

export const Route = createFileRoute("/_authenticated/admin/qualidade")({
  component: QualidadeAdminPage,
  head: () => ({
    meta: [
      { title: "Painel de qualidade · UP Flow" },
      { name: "description", content: "Indicadores de reportes, cumprimento de checklists e configuração do sistema de qualidade." },
      { property: "og:title", content: "Painel de qualidade · UP Flow" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Indicadores de reportes, cumprimento de checklists e configuração do sistema de qualidade." },
    ],
  }),
});


// ---------- helpers ----------

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
function addDaysISO(base: string, days: number) {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
function monthKey(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 7);
}
function fmtNum(n: number | null | undefined, casas = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(casas);
}
function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell === null || cell === undefined ? "" : String(cell);
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(";"),
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Spinner() {
  return (
    <main className="px-4 sm:px-6 py-16 max-w-6xl mx-auto flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      A carregar…
    </main>
  );
}

function Restrito() {
  return (
    <main className="px-4 sm:px-6 py-16 max-w-6xl mx-auto">
      <div className="surface-card p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Acesso restrito a gestores.</p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

const inputCls =
  "rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const selectCls = inputCls;

// ============================================================
// Página principal
// ============================================================

function QualidadeAdminPage() {
  const { data: eGestor, isLoading } = useEGestor();

  if (isLoading) return <Spinner />;
  if (!eGestor) return <Restrito />;

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-10 max-w-7xl w-full mx-auto">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Qualidade</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Painel de qualidade
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-prose">
          Indicadores, reportes, checklists e configuração do sistema de qualidade.
        </p>
      </div>

      <Tabs defaultValue="indicadores" className="mt-8">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="apurados">Erros apurados</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
          <TabsTrigger value="checklists">Cumprimento de checklists</TabsTrigger>
          <TabsTrigger value="atividade">Atividade por pessoa</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="indicadores">
          <TabIndicadores />
        </TabsContent>
        <TabsContent value="apurados"><MetricasCentral /></TabsContent>
        <TabsContent value="reportes">
          <TabReportes />
        </TabsContent>
        <TabsContent value="checklists">
          <TabCumprimento />
        </TabsContent>
        <TabsContent value="atividade">
          <TabAtividade />
        </TabsContent>
        <TabsContent value="config">
          <TabConfiguracao />
        </TabsContent>
      </Tabs>
    </main>
  );
}

// ============================================================
// a) Indicadores
// ============================================================

type RowDesempenho = {
  setor_destino: string | null;
  setor_destino_id: string | null;
  mes: string | null;
  total: number | null;
  pendentes: number | null;
  em_tratamento: number | null;
  fechados: number | null;
  recusados: number | null;
  contestados: number | null;
  resposta_atrasada: number | null;
  resolucao_atrasada: number | null;
  media_h_resposta: number | null;
  media_h_resolucao: number | null;
};

type RowReportePainel = {
  id: string | null;
  numero: string | null;
  titulo: string | null;
  estado: string | null;
  gravidade: string | null;
  criado_em: string | null;
  respondido_em: string | null;
  fechado_em: string | null;
  data_prevista: string | null;
  prazo_resposta: string | null;
  prazo_resolucao: string | null;
  horas_ate_resposta: number | null;
  horas_ate_resolucao: number | null;
  resposta_em_atraso: boolean | null;
  resolucao_em_atraso: boolean | null;
  foi_contestado: boolean | null;
  setor_origem: string | null;
  setor_origem_id: string | null;
  setor_destino: string | null;
  setor_destino_id: string | null;
  reportado_por: string | null;
  reportado_por_nome: string | null;
  assumido_por: string | null;
  assumido_por_nome: string | null;
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TabIndicadores() {
  const [de, setDe] = useState(() => addDaysISO(todayISO(), -89));
  const [ate, setAte] = useState(() => todayISO());
  const [setorId, setSetorId] = useState<string>("__all");
  const setoresQ = useSetores(false);

  const reportesQ = useQuery({
    queryKey: ["qualidade", "indicadores-reportes", de, ate, setorId],
    queryFn: async (): Promise<RowReportePainel[]> => {
      let q = supabase
        .from("vw_reportes_painel")
        .select("*")
        .gte("criado_em", de)
        .lte("criado_em", ate + "T23:59:59");
      if (setorId !== "__all") q = q.eq("setor_destino_id", setorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RowReportePainel[];
    },
  });

  const desempenhoQ = useQuery({
    queryKey: ["qualidade", "indicadores-desempenho"],
    queryFn: async (): Promise<RowDesempenho[]> => {
      const { data, error } = await supabase.from("vw_desempenho_setor").select("*");
      if (error) throw error;
      return (data ?? []) as RowDesempenho[];
    },
  });

  const rows = reportesQ.data ?? [];

  const kpis = useMemo(() => {
    const abertos = rows.filter((r) => r.estado !== "validado" && r.estado !== "nao_procede").length;
    const atrasoResposta = rows.filter((r) => r.resposta_em_atraso).length;
    const atrasoResolucao = rows.filter((r) => r.resolucao_em_atraso).length;
    const comResposta = rows.filter((r) => r.horas_ate_resposta !== null);
    const comResolucao = rows.filter((r) => r.horas_ate_resolucao !== null);
    const mediaResposta =
      comResposta.length > 0
        ? comResposta.reduce((s, r) => s + (r.horas_ate_resposta ?? 0), 0) / comResposta.length
        : null;
    const mediaResolucao =
      comResolucao.length > 0
        ? comResolucao.reduce((s, r) => s + (r.horas_ate_resolucao ?? 0), 0) / comResolucao.length
        : null;
    const contestados = rows.filter((r) => r.foi_contestado).length;
    const taxaContestacao = rows.length > 0 ? (contestados / rows.length) * 100 : null;
    return { abertos, atrasoResposta, atrasoResolucao, mediaResposta, mediaResolucao, taxaContestacao };
  }, [rows]);

  const mIni = monthKey(de);
  const mFim = monthKey(ate);
  const desempenhoFiltrado = useMemo(() => {
    return (desempenhoQ.data ?? []).filter((r) => {
      const mk = monthKey(r.mes);
      if (!mk) return false;
      if (mk < mIni || mk > mFim) return false;
      if (setorId !== "__all" && r.setor_destino_id !== setorId) return false;
      return true;
    });
  }, [desempenhoQ.data, mIni, mFim, setorId]);

  const porSetor = useMemo(() => {
    const map = new Map<string, { nome: string; total: number }>();
    desempenhoFiltrado.forEach((r) => {
      const key = r.setor_destino_id ?? r.setor_destino ?? "—";
      const cur = map.get(key) ?? { nome: r.setor_destino ?? "—", total: 0 };
      cur.total += r.total ?? 0;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [desempenhoFiltrado]);

  const porMes = useMemo(() => {
    const map = new Map<string, number>();
    desempenhoFiltrado.forEach((r) => {
      const mk = monthKey(r.mes);
      map.set(mk, (map.get(mk) ?? 0) + (r.total ?? 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, total]) => ({ mes, total }));
  }, [desempenhoFiltrado]);

  const maxSetor = Math.max(1, ...porSetor.map((s) => s.total));
  const maxMes = Math.max(1, ...porMes.map((s) => s.total));

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <Field label="Início">
          <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Fim">
          <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Setor">
          <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className={selectCls}>
            <option value="__all">Todos</option>
            {(setoresQ.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Reportes abertos" value={String(kpis.abertos)} />
        <Kpi label="Em atraso de resposta" value={String(kpis.atrasoResposta)} />
        <Kpi label="Em atraso de resolução" value={String(kpis.atrasoResolucao)} />
        <Kpi label="Média h até resposta" value={kpis.mediaResposta !== null ? `${fmtNum(kpis.mediaResposta)} h` : "—"} />
        <Kpi label="Média h até resolução" value={kpis.mediaResolucao !== null ? `${fmtNum(kpis.mediaResolucao)} h` : "—"} />
        <Kpi label="Taxa de contestação" value={kpis.taxaContestacao !== null ? `${fmtNum(kpis.taxaContestacao, 0)}%` : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Reportes por setor</h3>
          <div className="mt-4 space-y-2">
            {porSetor.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
            {porSetor.map((s) => (
              <div key={s.nome} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 truncate text-muted-foreground">{s.nome}</span>
                <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(s.total / maxSetor) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-medium text-foreground">{s.total}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Evolução mensal</h3>
          <div className="mt-4 flex items-end gap-2" style={{ height: 160 }}>
            {porMes.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
            {porMes.map((m) => (
              <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary"
                  style={{ height: `${(m.total / maxMes) * 120}px` }}
                  title={`${m.mes}: ${m.total}`}
                />
                <span className="text-[10px] text-muted-foreground">{m.mes.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// b) Reportes
// ============================================================

type Funcionario = { id: string; nome: string };

function TabReportes() {
  const [de, setDe] = useState(() => addDaysISO(todayISO(), -89));
  const [ate, setAte] = useState(() => todayISO());
  const [estado, setEstado] = useState<string>("__all");
  const [gravidade, setGravidade] = useState<string>("__all");
  const [setorDestino, setSetorDestino] = useState<string>("__all");
  const [setorOrigem, setSetorOrigem] = useState<string>("__all");
  const [reportadoPor, setReportadoPor] = useState<string>("__all");
  const [assumidoPor, setAssumidoPor] = useState<string>("__all");
  const [soAtraso, setSoAtraso] = useState(false);

  const setoresQ = useSetores(false);
  const funcionariosQ = useQuery({
    queryKey: ["qualidade", "funcionarios-reportes"],
    queryFn: async (): Promise<Funcionario[]> => {
      const { data, error } = await supabase.from("funcionarios").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const reportesQ = useQuery({
    queryKey: [
      "qualidade", "reportes-tabela", de, ate, estado, gravidade, setorDestino, setorOrigem, reportadoPor, assumidoPor,
    ],
    queryFn: async (): Promise<RowReportePainel[]> => {
      let q = supabase
        .from("vw_reportes_painel")
        .select("*")
        .gte("criado_em", de)
        .lte("criado_em", ate + "T23:59:59")
        .order("criado_em", { ascending: false });
      if (estado !== "__all") q = q.eq("estado", estado);
      if (gravidade !== "__all") q = q.eq("gravidade", gravidade);
      if (setorDestino !== "__all") q = q.eq("setor_destino_id", setorDestino);
      if (setorOrigem !== "__all") q = q.eq("setor_origem_id", setorOrigem);
      if (reportadoPor !== "__all") q = q.eq("reportado_por", reportadoPor);
      if (assumidoPor !== "__all") q = q.eq("assumido_por", assumidoPor);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RowReportePainel[];
    },
  });

  const rows = useMemo(() => {
    const all = reportesQ.data ?? [];
    if (!soAtraso) return all;
    return all.filter((r) => r.resposta_em_atraso || r.resolucao_em_atraso);
  }, [reportesQ.data, soAtraso]);

  function exportar() {
    const header = [
      "Número", "Título", "Estado", "Gravidade", "Setor origem", "Setor destino",
      "Reportado por", "Assumido por", "Criado em", "Respondido em", "Fechado em",
      "Horas até resposta", "Horas até resolução", "Atraso resposta", "Atraso resolução", "Contestado",
    ];
    const data = rows.map((r) => [
      r.numero, r.titulo, r.estado ? LABEL_ESTADO[r.estado as EstadoReporte] ?? r.estado : "", r.gravidade,
      r.setor_origem, r.setor_destino, r.reportado_por_nome, r.assumido_por_nome,
      dataHora(r.criado_em), dataHora(r.respondido_em), dataHora(r.fechado_em),
      r.horas_ate_resposta, r.horas_ate_resolucao,
      r.resposta_em_atraso ? "Sim" : "Não", r.resolucao_em_atraso ? "Sim" : "Não", r.foi_contestado ? "Sim" : "Não",
    ]);
    downloadCsv(`reportes_${de}_a_${ate}.csv`, [header, ...data]);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <Field label="Início">
          <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Fim">
          <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={selectCls}>
            <option value="__all">Todos</option>
            {Object.entries(LABEL_ESTADO).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Gravidade">
          <select value={gravidade} onChange={(e) => setGravidade(e.target.value)} className={selectCls}>
            <option value="__all">Todas</option>
            {Object.entries(LABEL_GRAVIDADE).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Setor destino">
          <select value={setorDestino} onChange={(e) => setSetorDestino(e.target.value)} className={selectCls}>
            <option value="__all">Todos</option>
            {(setoresQ.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
          </select>
        </Field>
        <Field label="Setor origem">
          <select value={setorOrigem} onChange={(e) => setSetorOrigem(e.target.value)} className={selectCls}>
            <option value="__all">Todos</option>
            {(setoresQ.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
          </select>
        </Field>
        <Field label="Reportado por">
          <select value={reportadoPor} onChange={(e) => setReportadoPor(e.target.value)} className={selectCls}>
            <option value="__all">Todos</option>
            {(funcionariosQ.data ?? []).map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
          </select>
        </Field>
        <Field label="Assumido por">
          <select value={assumidoPor} onChange={(e) => setAssumidoPor(e.target.value)} className={selectCls}>
            <option value="__all">Todos</option>
            {(funcionariosQ.data ?? []).map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Switch checked={soAtraso} onCheckedChange={setSoAtraso} />
          Só em atraso
        </label>
        <Button type="button" variant="outline" size="sm" className="gap-2 ml-auto" onClick={exportar}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm" style={{ minWidth: 1100 }}>
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Número</th>
              <th className="px-3 py-2 text-left font-medium">Título</th>
              <th className="px-3 py-2 text-left font-medium">Estado</th>
              <th className="px-3 py-2 text-left font-medium">Gravidade</th>
              <th className="px-3 py-2 text-left font-medium">Origem</th>
              <th className="px-3 py-2 text-left font-medium">Destino</th>
              <th className="px-3 py-2 text-left font-medium">Reportado por</th>
              <th className="px-3 py-2 text-left font-medium">Assumido por</th>
              <th className="px-3 py-2 text-left font-medium">Criado em</th>
              <th className="px-3 py-2 text-left font-medium">Atraso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-3 py-2">
                  <a href={`/reportes/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.numero ?? "—"}
                  </a>
                </td>
                <td className="px-3 py-2 max-w-[220px] truncate text-foreground" title={r.titulo ?? ""}>{r.titulo}</td>
                <td className="px-3 py-2">
                  {r.estado && (
                    <Badge variant="outline" className={CLASSE_ESTADO[r.estado as EstadoReporte]}>
                      {LABEL_ESTADO[r.estado as EstadoReporte] ?? r.estado}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.gravidade && (
                    <Badge variant="outline" className={CLASSE_GRAVIDADE[r.gravidade as keyof typeof CLASSE_GRAVIDADE]}>
                      {LABEL_GRAVIDADE[r.gravidade as keyof typeof LABEL_GRAVIDADE] ?? r.gravidade}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.setor_origem ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.setor_destino ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.reportado_por_nome ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.assumido_por_nome ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{dataCurta(r.criado_em)}</td>
                <td className="px-3 py-2">
                  {r.resposta_em_atraso && <Badge variant="outline" className="border-destructive/30 text-destructive mr-1">Resposta</Badge>}
                  {r.resolucao_em_atraso && <Badge variant="outline" className="border-destructive/30 text-destructive">Resolução</Badge>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Sem reportes para os filtros escolhidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// c) Cumprimento de checklists
// ============================================================

type RowCumprimento = {
  execucao_id: string | null;
  template_id: string | null;
  checklist: string | null;
  setor: string | null;
  setor_id: string | null;
  alvo: string | null;
  periodicidade: string | null;
  data_referencia: string | null;
  estado: string | null;
  itens_total: number | null;
  itens_respondidos: number | null;
  itens_nok: number | null;
  concluida_em: string | null;
  concluida_por: string | null;
};

function TabCumprimento() {
  const [setorId, setSetorId] = useState<string>("__all");
  const [estado, setEstado] = useState<string>("__all");
  const [de, setDe] = useState(() => addDaysISO(todayISO(), -29));
  const [ate, setAte] = useState(() => todayISO());
  const setoresQ = useSetores(false);

  const funcionariosQ = useQuery({
    queryKey: ["qualidade", "funcionarios-nome"],
    queryFn: async (): Promise<Funcionario[]> => {
      const { data, error } = await supabase.from("funcionarios").select("id, nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const nomeFunc = new Map((funcionariosQ.data ?? []).map((f) => [f.id, f.nome] as const));

  const q = useQuery({
    queryKey: ["qualidade", "cumprimento", setorId, estado, de, ate],
    queryFn: async (): Promise<RowCumprimento[]> => {
      let query = supabase
        .from("vw_cumprimento_checklists")
        .select("*")
        .gte("data_referencia", de)
        .lte("data_referencia", ate)
        .order("data_referencia", { ascending: false });
      if (setorId !== "__all") query = query.eq("setor_id", setorId);
      if (estado !== "__all") query = query.eq("estado", estado);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RowCumprimento[];
    },
  });

  const rows = q.data ?? [];

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <Field label="Início">
          <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Fim">
          <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Setor">
          <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className={selectCls}>
            <option value="__all">Todos</option>
            {(setoresQ.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
          </select>
        </Field>
        <Field label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={selectCls}>
            <option value="__all">Todos</option>
            {Object.entries(LABEL_ESTADO_EXEC).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm" style={{ minWidth: 1000 }}>
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Checklist</th>
              <th className="px-3 py-2 text-left font-medium">Setor</th>
              <th className="px-3 py-2 text-left font-medium">Alvo</th>
              <th className="px-3 py-2 text-left font-medium">Periodicidade</th>
              <th className="px-3 py-2 text-left font-medium">Data</th>
              <th className="px-3 py-2 text-left font-medium">Estado</th>
              <th className="px-3 py-2 text-right font-medium">Itens</th>
              <th className="px-3 py-2 text-right font-medium">NOK</th>
              <th className="px-3 py-2 text-left font-medium">Concluída por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr
                key={r.execucao_id ?? `${r.template_id}-${r.data_referencia}`}
                className={cn("hover:bg-muted/40", r.estado === "em_falta" && "bg-destructive/10")}
              >
                <td className="px-3 py-2 text-foreground">{r.checklist}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.setor}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.alvo ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{LABEL_PERIODICIDADE[r.periodicidade ?? ""] ?? r.periodicidade}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{dataCurta(r.data_referencia)}</td>
                <td className="px-3 py-2">
                  <span className={cn("text-xs font-medium", r.estado === "em_falta" ? "text-destructive" : "text-foreground")}>
                    {LABEL_ESTADO_EXEC[r.estado ?? ""] ?? r.estado}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.itens_respondidos ?? 0}/{r.itens_total ?? 0}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.itens_nok ?? 0}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.concluida_por ? (nomeFunc.get(r.concluida_por) ?? "—") : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Sem registos para os filtros escolhidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// d) Atividade por pessoa
// ============================================================

type RowAtividade = {
  funcionario_id: string | null;
  nome: string | null;
  mes: string | null;
  reportes_criados: number | null;
  reportes_assumidos: number | null;
  itens_respondidos: number | null;
  itens_nok: number | null;
  execucoes_concluidas: number | null;
};

function currentMonthValue() {
  return todayISO().slice(0, 7);
}

function TabAtividade() {
  const [mes, setMes] = useState(() => currentMonthValue());

  const q = useQuery({
    queryKey: ["qualidade", "atividade-colaborador", mes],
    queryFn: async (): Promise<RowAtividade[]> => {
      const { data, error } = await supabase.from("vw_atividade_colaborador").select("*");
      if (error) throw error;
      return (data ?? []) as RowAtividade[];
    },
  });

  const rows = useMemo(() => (q.data ?? []).filter((r) => monthKey(r.mes) === mes), [q.data, mes]);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <Field label="Mês">
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm" style={{ minWidth: 800 }}>
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nome</th>
              <th className="px-3 py-2 text-left font-medium">Mês</th>
              <th className="px-3 py-2 text-right font-medium">Reportes criados</th>
              <th className="px-3 py-2 text-right font-medium">Reportes assumidos</th>
              <th className="px-3 py-2 text-right font-medium">Itens respondidos</th>
              <th className="px-3 py-2 text-right font-medium">Itens NOK</th>
              <th className="px-3 py-2 text-right font-medium">Execuções concluídas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={`${r.funcionario_id}-${r.mes}`} className="hover:bg-muted/40">
                <td className="px-3 py-2 font-medium text-foreground">{r.nome}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.mes}</td>
                <td className="px-3 py-2 text-right text-foreground">{r.reportes_criados ?? 0}</td>
                <td className="px-3 py-2 text-right text-foreground">{r.reportes_assumidos ?? 0}</td>
                <td className="px-3 py-2 text-right text-foreground">{r.itens_respondidos ?? 0}</td>
                <td className="px-3 py-2 text-right text-foreground">{r.itens_nok ?? 0}</td>
                <td className="px-3 py-2 text-right text-foreground">{r.execucoes_concluidas ?? 0}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Sem atividade neste mês.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// e) Configuração
// ============================================================

function TabConfiguracao() {
  return (
    <div className="mt-4 space-y-8">
      <SetoresManager />
      <AlvosManager />
      <ChecklistsManager />
      <FeriadosManager />
      <ParametrosManager />
    </div>
  );
}

// --- Alvos ---

type Alvo = { id: string; setor_id: string; tipo: string; nome: string; ativo: boolean };

function AlvosManager() {
  const qc = useQueryClient();
  const setoresQ = useSetores(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Alvo | null>(null);
  const [form, setForm] = useState({ setor_id: "", tipo: "", nome: "" });
  const [erro, setErro] = useState<string | null>(null);

  const alvosQ = useQuery({
    queryKey: ["qualidade", "alvos"],
    queryFn: async (): Promise<Alvo[]> => {
      const { data, error } = await supabase.from("alvos").select("id, setor_id, tipo, nome, ativo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["qualidade", "alvos"] });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("alvos").insert({ setor_id: form.setor_id, tipo: form.tipo, nome: form.nome });
      if (error) throw error;
    },
    onSuccess: () => { setAdding(false); setForm({ setor_id: "", tipo: "", nome: "" }); setErro(null); invalidate(); },
    onError: (e: Error) => setErro(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (a: Alvo) => {
      const { error } = await supabase.from("alvos").update({ setor_id: a.setor_id, tipo: a.tipo, nome: a.nome }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); setErro(null); invalidate(); },
    onError: (e: Error) => setErro(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (a: Alvo) => {
      const { error } = await supabase.from("alvos").update({ ativo: !a.ativo }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => setErro(e.message),
  });

  const setores = setoresQ.data ?? [];
  const alvos = alvosQ.data ?? [];

  return (
    <section className="surface-card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-display text-sm font-semibold text-foreground">Alvos</h3>
        {!adding && (
          <Button type="button" variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => { setAdding(true); setEditing(null); }}>
            <Plus className="h-4 w-4" /> Novo alvo
          </Button>
        )}
      </div>
      {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      {adding && (
        <form
          onSubmit={(e: FormEvent) => { e.preventDefault(); if (!form.setor_id || !form.tipo || !form.nome.trim()) { setErro("Preenche todos os campos."); return; } createMut.mutate(); }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <select value={form.setor_id} onChange={(e) => setForm((f) => ({ ...f, setor_id: e.target.value }))} className={selectCls}>
            <option value="">Setor…</option>
            {setores.map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
          </select>
          <input type="text" placeholder="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} className={inputCls} />
          <input type="text" placeholder="Nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className={cn(inputCls, "flex-1 min-w-[160px]")} />
          <Button type="submit" size="sm" className="gap-2 rounded-full" disabled={createMut.isPending}><Save className="h-4 w-4" />Guardar</Button>
          <Button type="button" variant="ghost" size="sm" className="gap-2 rounded-full" onClick={() => setAdding(false)}><X className="h-4 w-4" />Cancelar</Button>
        </form>
      )}
      <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
        {alvos.length === 0 && <li className="px-4 py-4 text-sm text-muted-foreground">Ainda não há alvos.</li>}
        {alvos.map((a) => editing?.id === a.id ? (
          <li key={a.id} className="px-3 py-2">
            <form
              onSubmit={(e: FormEvent) => { e.preventDefault(); updateMut.mutate(editing); }}
              className="flex flex-wrap items-center gap-2"
            >
              <select value={editing.setor_id} onChange={(e) => setEditing({ ...editing, setor_id: e.target.value })} className={selectCls}>
                {setores.map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
              </select>
              <input type="text" value={editing.tipo} onChange={(e) => setEditing({ ...editing, tipo: e.target.value })} className={inputCls} />
              <input type="text" value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} className={cn(inputCls, "flex-1 min-w-[160px]")} />
              <Button type="submit" size="sm" className="gap-2 rounded-full" disabled={updateMut.isPending}><Save className="h-4 w-4" />Guardar</Button>
              <Button type="button" variant="ghost" size="sm" className="gap-2 rounded-full" onClick={() => setEditing(null)}><X className="h-4 w-4" />Cancelar</Button>
            </form>
          </li>
        ) : (
          <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm text-foreground truncate">
              <span className="font-medium">{a.nome}</span>
              <span className="ml-2 text-xs text-muted-foreground">{a.tipo} · {setores.find((s) => s.id === a.setor_id)?.nome ?? "—"}</span>
              {!a.ativo && <Badge variant="outline" className="ml-2 text-[10px]">Inativo</Badge>}
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => toggleMut.mutate(a)} title={a.ativo ? "Desativar" : "Ativar"}>
                <Power className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => { setEditing(a); setAdding(false); }} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Checklists (templates + itens com drag-to-reorder) ---

type ChecklistTemplate = {
  id: string; setor_id: string; nome: string; descricao: string | null;
  periodicidade: string; dias_semana: number[]; dia_mes: number | null;
  hora_limite: string; alvo_tipo: string | null; ativo: boolean;
};
type ChecklistItem = {
  id: string; template_id: string; ordem: number; texto: string; instrucao: string | null;
  tipo: string; obrigatorio: boolean; exige_foto_se_nok: boolean; setor_reporte_id: string | null;
};

const DIAS_SEMANA_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TIPOS_ITEM = ["ok_nok", "texto", "numero", "foto"] as const;

function ChecklistsManager() {
  const qc = useQueryClient();
  const setoresQ = useSetores(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState<ChecklistTemplate | "new" | null>(null);

  const templatesQ = useQuery({
    queryKey: ["qualidade", "checklist-templates"],
    queryFn: async (): Promise<ChecklistTemplate[]> => {
      const { data, error } = await supabase.from("checklist_templates").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as ChecklistTemplate[];
    },
  });

  const invalidateTemplates = () => qc.invalidateQueries({ queryKey: ["qualidade", "checklist-templates"] });

  const saveTemplateMut = useMutation({
    mutationFn: async (t: Partial<ChecklistTemplate> & { id?: string }) => {
      if (t.id) {
        const { id, ...rest } = t;
        const { error } = await supabase.from("checklist_templates").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("checklist_templates").insert({
          setor_id: t.setor_id!, nome: t.nome!, descricao: t.descricao ?? null,
          periodicidade: t.periodicidade ?? "diaria", dias_semana: t.dias_semana ?? [],
          dia_mes: t.dia_mes ?? null, hora_limite: t.hora_limite ?? "18:00:00",
          alvo_tipo: t.alvo_tipo ?? null, ativo: t.ativo ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { setShowTemplateForm(null); invalidateTemplates(); },
  });

  const toggleAtivoMut = useMutation({
    mutationFn: async (t: ChecklistTemplate) => {
      const { error } = await supabase.from("checklist_templates").update({ ativo: !t.ativo }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: invalidateTemplates,
  });

  const templates = templatesQ.data ?? [];
  const setores = setoresQ.data ?? [];

  return (
    <section className="surface-card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-display text-sm font-semibold text-foreground">Checklists</h3>
        <Button type="button" variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => setShowTemplateForm("new")}>
          <Plus className="h-4 w-4" /> Novo checklist
        </Button>
      </div>

      <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
        {templates.length === 0 && <li className="px-4 py-4 text-sm text-muted-foreground">Ainda não há checklists.</li>}
        {templates.map((t) => (
          <li key={t.id} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="flex-1 text-left text-sm font-medium text-foreground hover:underline"
                onClick={() => setSelecionado(selecionado === t.id ? null : t.id)}
              >
                {t.nome}
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {setores.find((s) => s.id === t.setor_id)?.nome ?? "—"} · {LABEL_PERIODICIDADE[t.periodicidade] ?? t.periodicidade}
                </span>
                {!t.ativo && <Badge variant="outline" className="ml-2 text-[10px]">Inativo</Badge>}
              </button>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => toggleAtivoMut.mutate(t)} title={t.ativo ? "Desativar" : "Ativar"}>
                  <Power className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => setShowTemplateForm(t)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {selecionado === t.id && <ChecklistItensEditor templateId={t.id} setores={setores} />}
          </li>
        ))}
      </ul>

      {showTemplateForm && (
        <TemplateFormDialog
          setores={setores}
          initial={showTemplateForm === "new" ? null : showTemplateForm}
          onClose={() => setShowTemplateForm(null)}
          onSave={(t) => saveTemplateMut.mutate(t)}
          saving={saveTemplateMut.isPending}
        />
      )}
    </section>
  );
}

function TemplateFormDialog({
  setores, initial, onClose, onSave, saving,
}: {
  setores: { id: string; nome: string }[];
  initial: ChecklistTemplate | null;
  onClose: () => void;
  onSave: (t: Partial<ChecklistTemplate> & { id?: string }) => void;
  saving: boolean;
}) {
  const [setorId, setSetorId] = useState(initial?.setor_id ?? setores[0]?.id ?? "");
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [periodicidade, setPeriodicidade] = useState(initial?.periodicidade ?? "diaria");
  const [diasSemana, setDiasSemana] = useState<number[]>(initial?.dias_semana ?? []);
  const [diaMes, setDiaMes] = useState<number | "">(initial?.dia_mes ?? "");
  const [horaLimite, setHoraLimite] = useState(initial?.hora_limite?.slice(0, 5) ?? "18:00");
  const [alvoTipo, setAlvoTipo] = useState(initial?.alvo_tipo ?? "");
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);

  function toggleDia(d: number) {
    setDiasSemana((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Editar checklist" : "Novo checklist"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Setor">
            <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className={selectCls}>
              {setores.map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
            </select>
          </Field>
          <Field label="Nome">
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Descrição">
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className={cn(inputCls, "min-h-[60px]")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Periodicidade">
              <select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} className={selectCls}>
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </Field>
            <Field label="Hora limite">
              <input type="time" value={horaLimite} onChange={(e) => setHoraLimite(e.target.value)} className={inputCls} />
            </Field>
          </div>
          {periodicidade === "semanal" && (
            <Field label="Dias da semana">
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA_LABEL.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDia(idx)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      diasSemana.includes(idx) ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {periodicidade === "mensal" && (
            <Field label="Dia do mês">
              <input type="number" min={1} max={31} value={diaMes} onChange={(e) => setDiaMes(e.target.value ? Number(e.target.value) : "")} className={inputCls} />
            </Field>
          )}
          <Field label="Tipo de alvo (opcional)">
            <input type="text" value={alvoTipo} onChange={(e) => setAlvoTipo(e.target.value)} className={inputCls} placeholder="Ex.: sala, viatura…" />
          </Field>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Switch checked={ativo} onCheckedChange={setAtivo} /> Ativo
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            disabled={saving || !nome.trim() || !setorId}
            onClick={() => onSave({
              id: initial?.id,
              setor_id: setorId,
              nome: nome.trim(),
              descricao: descricao.trim() || null,
              periodicidade,
              dias_semana: periodicidade === "semanal" ? diasSemana : [],
              dia_mes: periodicidade === "mensal" ? (diaMes === "" ? null : Number(diaMes)) : null,
              hora_limite: horaLimite + ":00",
              alvo_tipo: alvoTipo.trim() || null,
              ativo,
            })}
          >
            {saving ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableItemRow({ item, setores, onEdit, onDelete }: {
  item: ChecklistItem;
  setores: { id: string; nome: string }[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2 bg-background">
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{item.texto}</p>
        <p className="text-xs text-muted-foreground">
          {item.tipo}{item.obrigatorio ? " · obrigatório" : ""}
          {item.setor_reporte_id ? ` · reporta a ${setores.find((s) => s.id === item.setor_reporte_id)?.nome ?? "—"}` : ""}
        </p>
      </div>
      <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" className="rounded-full text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
    </li>
  );
}

function ChecklistItensEditor({ templateId, setores }: { templateId: string; setores: { id: string; nome: string }[] }) {
  const qc = useQueryClient();
  const [editingItem, setEditingItem] = useState<ChecklistItem | "new" | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const itensQ = useQuery({
    queryKey: ["qualidade", "checklist-itens", templateId],
    queryFn: async (): Promise<ChecklistItem[]> => {
      const { data, error } = await supabase.from("checklist_itens").select("*").eq("template_id", templateId).order("ordem");
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["qualidade", "checklist-itens", templateId] });

  const saveItemMut = useMutation({
    mutationFn: async (i: Partial<ChecklistItem> & { id?: string }) => {
      if (i.id) {
        const { id, ...rest } = i;
        const { error } = await supabase.from("checklist_itens").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const proximaOrdem = (itensQ.data?.length ?? 0);
        const { error } = await supabase.from("checklist_itens").insert({
          template_id: templateId, ordem: proximaOrdem, texto: i.texto!, instrucao: i.instrucao ?? null,
          tipo: i.tipo ?? "ok_nok", obrigatorio: i.obrigatorio ?? true, exige_foto_se_nok: i.exige_foto_se_nok ?? false,
          setor_reporte_id: i.setor_reporte_id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { setEditingItem(null); invalidate(); },
  });

  const deleteItemMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklist_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorderMut = useMutation({
    mutationFn: async (ordered: ChecklistItem[]) => {
      await Promise.all(ordered.map((it, idx) => supabase.from("checklist_itens").update({ ordem: idx }).eq("id", it.id)));
    },
    onSuccess: invalidate,
  });

  const itens = itensQ.data ?? [];

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const oldIndex = itens.findIndex((i) => i.id === active.id);
    const newIndex = itens.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderMut.mutate(arrayMove(itens, oldIndex, newIndex));
  }

  return (
    <div className="mt-3 ml-6 rounded-lg border border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground">Itens do checklist</p>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 rounded-full" onClick={() => setEditingItem("new")}>
          <Plus className="h-3.5 w-3.5" /> Item
        </Button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={itens.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-border">
            {itens.map((it) => (
              <SortableItemRow key={it.id} item={it} setores={setores} onEdit={() => setEditingItem(it)} onDelete={() => { if (confirm("Apagar este item?")) deleteItemMut.mutate(it.id); }} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {itens.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground">Ainda não há itens.</p>}

      {editingItem && (
        <ItemFormDialog
          setores={setores}
          initial={editingItem === "new" ? null : editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(i) => saveItemMut.mutate(i)}
          saving={saveItemMut.isPending}
        />
      )}
    </div>
  );
}

function ItemFormDialog({ setores, initial, onClose, onSave, saving }: {
  setores: { id: string; nome: string }[];
  initial: ChecklistItem | null;
  onClose: () => void;
  onSave: (i: Partial<ChecklistItem> & { id?: string }) => void;
  saving: boolean;
}) {
  const [texto, setTexto] = useState(initial?.texto ?? "");
  const [instrucao, setInstrucao] = useState(initial?.instrucao ?? "");
  const [tipo, setTipo] = useState(initial?.tipo ?? "ok_nok");
  const [obrigatorio, setObrigatorio] = useState(initial?.obrigatorio ?? true);
  const [exigeFoto, setExigeFoto] = useState(initial?.exige_foto_se_nok ?? false);
  const [setorReporte, setSetorReporte] = useState(initial?.setor_reporte_id ?? "");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Texto">
            <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Instrução (opcional)">
            <textarea value={instrucao} onChange={(e) => setInstrucao(e.target.value)} className={cn(inputCls, "min-h-[50px]")} />
          </Field>
          <Field label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls}>
              {TIPOS_ITEM.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>
          <Field label="Setor a reportar se NOK (opcional)">
            <select value={setorReporte} onChange={(e) => setSetorReporte(e.target.value)} className={selectCls}>
              <option value="">Nenhum</option>
              {setores.map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Switch checked={obrigatorio} onCheckedChange={setObrigatorio} /> Obrigatório
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Switch checked={exigeFoto} onCheckedChange={setExigeFoto} /> Exige foto se NOK
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            disabled={saving || !texto.trim()}
            onClick={() => onSave({
              id: initial?.id, texto: texto.trim(), instrucao: instrucao.trim() || null, tipo,
              obrigatorio, exige_foto_se_nok: exigeFoto, setor_reporte_id: setorReporte || null,
            })}
          >
            {saving ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Feriados ---

type Feriado = { data: string; descricao: string };

function FeriadosManager() {
  const qc = useQueryClient();
  const [novaData, setNovaData] = useState("");
  const [novaDesc, setNovaDesc] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["qualidade", "feriados"],
    queryFn: async (): Promise<Feriado[]> => {
      const { data, error } = await supabase.from("feriados").select("*").order("data");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["qualidade", "feriados"] });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("feriados").insert({ data: novaData, descricao: novaDesc.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setNovaData(""); setNovaDesc(""); setErro(null); invalidate(); },
    onError: (e: Error) => setErro(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (data: string) => {
      const { error } = await supabase.from("feriados").delete().eq("data", data);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const feriados = q.data ?? [];

  return (
    <section className="surface-card p-5">
      <h3 className="font-display text-sm font-semibold text-foreground">Feriados</h3>
      {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      <form
        onSubmit={(e: FormEvent) => { e.preventDefault(); if (!novaData || !novaDesc.trim()) { setErro("Indica a data e a descrição."); return; } addMut.mutate(); }}
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className={inputCls} />
        <input type="text" placeholder="Descrição" value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} className={cn(inputCls, "flex-1 min-w-[180px]")} />
        <Button type="submit" size="sm" className="gap-2 rounded-full" disabled={addMut.isPending}><Plus className="h-4 w-4" />Adicionar</Button>
      </form>
      <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
        {feriados.length === 0 && <li className="px-4 py-4 text-sm text-muted-foreground">Ainda não há feriados registados.</li>}
        {feriados.map((f) => (
          <li key={f.data} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm text-foreground">
              <span className="font-medium">{dataCurta(f.data)}</span>
              <span className="ml-2 text-muted-foreground">{f.descricao}</span>
            </span>
            <Button type="button" variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => deleteMut.mutate(f.data)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Parâmetros (rc_config) ---

function ParametrosManager() {
  const qc = useQueryClient();
  const [valores, setValores] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["qualidade", "rc-config"],
    queryFn: async (): Promise<{ chave: string; valor: string }[]> => {
      const { data, error } = await supabase.from("rc_config").select("*").order("chave");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (args: { chave: string; valor: string }) => {
      const { error } = await supabase.from("rc_config").update({ valor: args.valor }).eq("chave", args.chave);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qualidade", "rc-config"] }),
  });

  const config = q.data ?? [];

  return (
    <section className="surface-card p-5">
      <h3 className="font-display text-sm font-semibold text-foreground">Parâmetros</h3>
      <p className="mt-1 text-sm text-muted-foreground">Configurações gerais do sistema de qualidade.</p>
      <div className="mt-4 space-y-3">
        {config.map((c) => {
          const valorAtual = valores[c.chave] ?? c.valor;
          const alterado = valorAtual !== c.valor;
          return (
            <div key={c.chave} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <span className="min-w-[220px] flex-1 text-sm font-medium text-foreground">{c.chave}</span>
              <input
                type="text"
                value={valorAtual}
                onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                className={cn(inputCls, "w-40")}
              />
              <Button
                type="button"
                size="sm"
                variant={alterado ? "default" : "outline"}
                className="gap-1.5 rounded-full"
                disabled={!alterado || saveMut.isPending}
                onClick={() => saveMut.mutate({ chave: c.chave, valor: valorAtual })}
              >
                <Save className="h-3.5 w-3.5" /> Guardar
              </Button>
            </div>
          );
        })}
        {config.length === 0 && <p className="text-sm text-muted-foreground">Sem parâmetros configurados.</p>}
      </div>
    </section>
  );
}
