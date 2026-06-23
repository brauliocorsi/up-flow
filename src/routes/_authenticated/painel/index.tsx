import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/routes/_authenticated/auth-context";
import { corFuncionario } from "@/lib/cores";

export const Route = createFileRoute("/_authenticated/painel/")({
  component: PainelPage,
});

type Estado = "pendente" | "a_decorrer" | "pausada" | "saltada" | "concluida";
type Tarefa = {
  id: string;
  funcionario_id: string;
  titulo: string;
  ordem: number;
  minutos_previstos: number;
  estado: Estado;
};
type Execucao = {
  id: string;
  tarefa_dia_id: string;
  inicio: string;
  fim: string | null;
  motivo_pausa_id: string | null;
};
type Evento = {
  id: string;
  funcionario_id: string;
  tipo: "recebimento" | "levantamento" | "urgencia" | "outro";
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string | null;
  prioridade: "urgente" | "normal";
  estado: "aberto" | "fechado";
  tarefa_pausada_id: string | null;
  lido: boolean;
};
type Funcionario = {
  id: string;
  nome: string;
  papel: "gestor" | "funcionario";
  cor: string | null;
  funcao: { nome: string } | null;
};
type Motivo = { id: string; label: string };

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function PainelPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthUser();
  const qc = useQueryClient();
  const [dataSel, setDataSel] = useState<string>(() => todayISO());
  const hoje = todayISO();
  const isLive = dataSel === hoje;
  const isFuture = dataSel > hoje;
  const isPast = dataSel < hoje;

  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [urgOpen, setUrgOpen] = useState(false);
  const [urgForm, setUrgForm] = useState({ funcionario_id: "", titulo: "", descricao: "", prioridade: "urgente" as "urgente" | "normal" });

  // Live ticker only when viewing today
  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isLive]);

  const { data: isGestor, isLoading: loadingRole } = useQuery({
    queryKey: ["is-gestor", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "gestor").maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const funcionariosQuery = useQuery({
    enabled: !!isGestor,
    queryKey: ["painel-funcionarios"],
    queryFn: async (): Promise<Funcionario[]> => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, papel, cor, funcao:funcoes(nome)")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Funcionario[];
    },
  });

  const tarefasQuery = useQuery({
    enabled: !!isGestor,
    queryKey: ["painel-tarefas", dataSel],
    queryFn: async (): Promise<Tarefa[]> => {
      const { data: rows, error } = await supabase
        .from("tarefas_dia")
        .select("id, funcionario_id, titulo, ordem, minutos_previstos, estado")
        .eq("data", dataSel)
        .order("ordem");
      if (error) throw error;
      return (rows ?? []) as Tarefa[];
    },
  });

  const execucoesQuery = useQuery({
    enabled: !!isGestor && !!tarefasQuery.data,
    queryKey: ["painel-execucoes", dataSel, tarefasQuery.data?.length ?? 0],
    queryFn: async (): Promise<Execucao[]> => {
      const ids = (tarefasQuery.data ?? []).map((t) => t.id);
      if (ids.length === 0) return [];
      const { data: rows, error } = await supabase
        .from("execucoes")
        .select("id, tarefa_dia_id, inicio, fim, motivo_pausa_id")
        .in("tarefa_dia_id", ids);
      if (error) throw error;
      return (rows ?? []) as Execucao[];
    },
  });

  const eventosQuery = useQuery({
    enabled: !!isGestor,
    queryKey: ["painel-eventos", dataSel],
    queryFn: async (): Promise<Evento[]> => {
      const start = `${dataSel}T00:00:00Z`;
      const end = `${dataSel}T23:59:59Z`;
      const { data: rows, error } = await supabase
        .from("eventos")
        .select("id, funcionario_id, tipo, titulo, descricao, inicio, fim, prioridade, estado, tarefa_pausada_id, lido")
        .gte("inicio", start).lte("inicio", end)
        .order("inicio");
      if (error) throw error;
      return (rows ?? []) as Evento[];
    },
  });

  const motivosQuery = useQuery({
    enabled: !!isGestor,
    queryKey: ["motivos-pausa"],
    queryFn: async (): Promise<Motivo[]> => {
      const { data: rows, error } = await supabase
        .from("motivos_pausa").select("id, label").eq("ativo", true);
      if (error) throw error;
      return (rows ?? []) as Motivo[];
    },
  });

  // Realtime subscriptions — only in LIVE mode (today)
  useEffect(() => {
    if (!isGestor) return;
    if (!isLive) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["painel-tarefas", dataSel] });
      qc.invalidateQueries({ queryKey: ["painel-execucoes", dataSel] });
      qc.invalidateQueries({ queryKey: ["painel-eventos", dataSel] });
    };
    const ch = supabase
      .channel(`painel-${dataSel}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas_dia" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "execucoes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isGestor, isLive, dataSel, qc]);

  const gerarDemo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("gerar_dados_demo", { _data: dataSel });
      if (error) throw error;
    },
    onSuccess: () => setFeedback(t("painel.demo.generated")),
    onError: (e: Error) => setFeedback(e.message),
  });

  const limparDemo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("limpar_dados_demo", { _data: dataSel });
      if (error) throw error;
    },
    onSuccess: () => setFeedback(t("painel.demo.cleared")),
    onError: (e: Error) => setFeedback(e.message),
  });

  const dispararUrgencia = useMutation({
    mutationFn: async () => {
      if (!urgForm.funcionario_id || !urgForm.titulo.trim()) {
        throw new Error(t("painel.urgencia.fillRequired"));
      }
      const { error } = await supabase.rpc("criar_urgencia_gestor", {
        _funcionario_id: urgForm.funcionario_id,
        _titulo: urgForm.titulo.trim(),
        _descricao: urgForm.descricao.trim(),
        _prioridade: urgForm.prioridade,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedback(t("painel.urgencia.sent"));
      setUrgOpen(false);
      setUrgForm({ funcionario_id: "", titulo: "", descricao: "", prioridade: "urgente" });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const motivosMap = useMemo(() => {
    const m = new Map<string, string>();
    (motivosQuery.data ?? []).forEach((x) => m.set(x.id, x.label));
    return m;
  }, [motivosQuery.data]);

  if (loadingRole) return <Shell><p className="text-muted-foreground">{t("common.loading")}</p></Shell>;
  if (!isGestor) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t("painel.forbidden")}</p>
        <Link to="/app" className="text-sm text-primary underline mt-2 inline-block">{t("common.back")}</Link>
      </Shell>
    );
  }

  const funcionarios = funcionariosQuery.data ?? [];
  const tarefas = tarefasQuery.data ?? [];
  const execucoes = execucoesQuery.data ?? [];
  const eventos = eventosQuery.data ?? [];

  const execByTarefa = new Map<string, Execucao[]>();
  execucoes.forEach((e) => {
    const arr = execByTarefa.get(e.tarefa_dia_id) ?? [];
    arr.push(e);
    execByTarefa.set(e.tarefa_dia_id, arr);
  });

  type Cartao = {
    f: Funcionario;
    tarefas: Tarefa[];
    totalReal: number;
    totalPrevisto: number;
    concluidas: number;
    atual: Tarefa | null;
    execAberta: Execucao | null;
    decorridoMin: number;
    excedido: boolean;
    pausada: boolean;
    motivoPausa: string | null;
    urgencia: Evento | null;
    eventosFunc: Evento[];
  };

  const cartoes: Cartao[] = funcionarios.map((f) => {
    const fts = tarefas.filter((t) => t.funcionario_id === f.id);
    const concluidas = fts.filter((t) => t.estado === "concluida").length;
    // In historical mode there's no "current task" — nothing should be running in the past.
    const atual = isLive
      ? (fts.find((t) => t.estado === "a_decorrer" || t.estado === "pausada") ??
         fts.find((t) => t.estado === "pendente") ?? null)
      : null;
    let execAberta: Execucao | null = null;
    let decorridoMin = 0;
    let pausada = false;
    let motivoPausa: string | null = null;
    if (atual) {
      const execs = execByTarefa.get(atual.id) ?? [];
      execAberta = execs.find((e) => !e.fim) ?? null;
      if (execAberta) {
        decorridoMin = (now - new Date(execAberta.inicio).getTime()) / 60000;
      }
      if (atual.estado === "pausada") {
        pausada = true;
        motivoPausa = execAberta?.motivo_pausa_id
          ? motivosMap.get(execAberta.motivo_pausa_id) ?? null
          : null;
      }
    }
    const excedido = !!atual && decorridoMin > atual.minutos_previstos && atual.minutos_previstos > 0;
    const eventosFunc = eventos.filter((e) => e.funcionario_id === f.id);
    const urgencia = isLive
      ? (eventosFunc.find((e) => e.prioridade === "urgente" && e.estado === "aberto") ?? null)
      : null;
    return {
      f,
      tarefas: fts,
      totalReal: fts.length,
      totalPrevisto: fts.length,
      concluidas,
      atual,
      execAberta,
      decorridoMin,
      excedido,
      pausada,
      motivoPausa,
      urgencia,
      eventosFunc,
    };
  });

  const urgenciasAbertas = eventos.filter((e) => e.tipo === "urgencia" && e.prioridade === "urgente" && e.estado === "aberto");
  const tempoUrgenciasMin = (() => {
    let total = 0;
    for (const e of eventos) {
      if (e.prioridade !== "urgente") continue;
      const start = new Date(e.inicio).getTime();
      const end = e.fim ? new Date(e.fim).getTime() : (isLive ? now : start);
      total += Math.max(0, end - start);
    }
    return Math.round(total / 60000);
  })();

  const metrics = {
    ativos: cartoes.filter((c) => c.execAberta && !c.pausada).length,
    concluidas: cartoes.reduce((s, c) => s + c.concluidas, 0),
    dentroPct: (() => {
      // Histórico: % de tarefas concluídas dentro do tempo previsto
      if (!isLive) {
        const done = cartoes.flatMap((c) => c.tarefas).filter((tk) => tk.estado === "concluida");
        if (done.length === 0) return 100;
        let dentro = 0;
        for (const tk of done) {
          const execs = execByTarefa.get(tk.id) ?? [];
          const real = execs.reduce((s, e) => s + (e.fim ? (new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000 : 0), 0);
          if (real <= tk.minutos_previstos) dentro++;
        }
        return Math.round((dentro / done.length) * 100);
      }
      const ativas = cartoes.filter((c) => c.execAberta);
      if (ativas.length === 0) return 100;
      return Math.round((ativas.filter((c) => !c.excedido).length / ativas.length) * 100);
    })(),
    pausas: cartoes.filter((c) => c.pausada).length,
    urgencias: isLive ? urgenciasAbertas.length : 0,
    tempoUrg: tempoUrgenciasMin,
  };

  const locale = i18n.language === "pt" ? "pt-PT" : "en-GB";
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long", day: "2-digit", month: "long",
  }).format(isoToDate(dataSel));

  // Future day with no tasks?
  const futureEmpty = isFuture && tarefas.length === 0 && !tarefasQuery.isLoading;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold text-foreground">{t("painel.title")}</h1>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {t("painel.mode.live")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {t("painel.mode.historic")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            {dateFmt}{isLive ? ` · ${t("painel.mode.today")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setUrgOpen((v) => !v)}
            disabled={!isLive}
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-40"
            title={!isLive ? t("painel.mode.historicOnly") : undefined}
          >
            ⚠ {t("painel.urgencia.trigger")}
          </button>
          <button
            onClick={() => gerarDemo.mutate()}
            disabled={gerarDemo.isPending}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {gerarDemo.isPending ? t("painel.demo.generating") : t("painel.demo.generate")}
          </button>
          <button
            onClick={() => limparDemo.mutate()}
            disabled={limparDemo.isPending}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {limparDemo.isPending ? t("painel.demo.clearing") : t("painel.demo.clear")}
          </button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <button
          onClick={() => setDataSel((d) => addDays(d, -1))}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm hover:bg-accent"
          aria-label={t("painel.nav.prev")}
        >
          ‹ {t("painel.nav.prev")}
        </button>
        <button
          onClick={() => setDataSel(hoje)}
          disabled={isLive}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {t("painel.nav.today")}
        </button>
        <button
          onClick={() => setDataSel((d) => addDays(d, 1))}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm hover:bg-accent"
          aria-label={t("painel.nav.next")}
        >
          {t("painel.nav.next")} ›
        </button>
        <input
          type="date"
          value={dataSel}
          onChange={(e) => { if (e.target.value) setDataSel(e.target.value); }}
          className="ml-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
      </div>

      {urgOpen && isLive && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("painel.urgencia.title")}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block text-muted-foreground text-xs mb-1">{t("painel.urgencia.funcionario")}</span>
              <select
                value={urgForm.funcionario_id}
                onChange={(e) => setUrgForm({ ...urgForm, funcionario_id: e.target.value })}
                className="w-full rounded border border-input bg-background px-2 py-1.5"
              >
                <option value="">—</option>
                {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-muted-foreground text-xs mb-1">{t("painel.urgencia.prioridade")}</span>
              <select
                value={urgForm.prioridade}
                onChange={(e) => setUrgForm({ ...urgForm, prioridade: e.target.value as "urgente" | "normal" })}
                className="w-full rounded border border-input bg-background px-2 py-1.5"
              >
                <option value="urgente">{t("painel.urgencia.urgente")}</option>
                <option value="normal">{t("painel.urgencia.normal")}</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="block text-muted-foreground text-xs mb-1">{t("painel.urgencia.tituloLabel")}</span>
              <input
                value={urgForm.titulo}
                onChange={(e) => setUrgForm({ ...urgForm, titulo: e.target.value })}
                className="w-full rounded border border-input bg-background px-2 py-1.5"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="block text-muted-foreground text-xs mb-1">{t("painel.urgencia.descricaoLabel")}</span>
              <textarea
                value={urgForm.descricao}
                onChange={(e) => setUrgForm({ ...urgForm, descricao: e.target.value })}
                rows={2}
                className="w-full rounded border border-input bg-background px-2 py-1.5"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => dispararUrgencia.mutate()}
              disabled={dispararUrgencia.isPending}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {dispararUrgencia.isPending ? t("painel.urgencia.submitting") : t("painel.urgencia.submit")}
            </button>
            <button onClick={() => setUrgOpen(false)} className="text-sm text-muted-foreground hover:underline">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          {feedback}
          <button onClick={() => setFeedback(null)} className="ml-2 text-xs text-muted-foreground hover:underline">
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {futureEmpty && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm font-medium text-foreground">{t("painel.future.empty")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("painel.future.hint")}</p>
        </div>
      )}

      <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label={t("painel.metrics.ativos")} value={metrics.ativos} />
        <Metric label={t("painel.metrics.concluidas")} value={metrics.concluidas} />
        <Metric label={t("painel.metrics.dentroPct")} value={`${metrics.dentroPct}%`} />
        <Metric label={t("painel.metrics.pausas")} value={metrics.pausas} />
        <Metric label={t("painel.metrics.urgencias")} value={metrics.urgencias} tone={metrics.urgencias > 0 ? "danger" : undefined} />
        <Metric label={t("painel.metrics.tempoUrg")} value={`${metrics.tempoUrg}m`} />
      </div>


      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cartoes.map((c) => <FuncionarioCard key={c.f.id} c={c} t={t} isLive={isLive} />)}
        {cartoes.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("painel.empty")}</p>
        )}
      </div>

      <h2 className="mt-12 text-xl font-semibold text-foreground">{t("painel.details")}</h2>
      <div className="mt-4 space-y-3">
        {cartoes.map((c) => {
          const open = expanded[c.f.id] ?? false;
          const cor = corFuncionario(c.f.cor);
          return (
            <div
              key={c.f.id}
              className="rounded-lg border border-border overflow-hidden"
              style={{ borderLeftColor: cor, borderLeftWidth: 4 }}
            >
              <button
                onClick={() => setExpanded((s) => ({ ...s, [c.f.id]: !open }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50"
              >
                <span className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: cor }}
                    aria-hidden
                  />
                  {c.f.nome} <span className="text-muted-foreground font-normal">· {c.concluidas}/{c.tarefas.length}</span>
                </span>
                <span className="text-xs text-muted-foreground">{open ? "▾" : "▸"}</span>
              </button>
              {open && (
                <div className="px-4 py-3">
                  <DetalheTarefas c={c} execByTarefa={execByTarefa} t={t} cor={cor} />
                  {c.eventosFunc.length > 0 && (
                    <>
                      <h4 className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
                        {t("painel.eventos")}
                      </h4>
                      <ul className="mt-2 space-y-1 text-sm">
                        {c.eventosFunc.map((e) => {
                          const start = new Date(e.inicio).getTime();
                          const end = e.fim ? new Date(e.fim).getTime() : (isLive ? now : start);
                          const min = Math.round((end - start) / 60000);
                          const isUrg = e.prioridade === "urgente";
                          return (
                            <li key={e.id} className="flex items-center justify-between border-b border-border/50 py-1 gap-2">
                              <span className="text-foreground flex items-center gap-2 min-w-0">
                                {isUrg && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">URG</span>}
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t(`painel.eventoTipo.${e.tipo}`)}</span>
                                <span className="truncate">{e.titulo}</span>
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {e.estado === "aberto" && isLive
                                  ? `${t("painel.eventosAbertos")} · ${t("painel.ha", { m: min })}`
                                  : `${min}m`}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: "danger" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "danger" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function FuncionarioCard({ c, t, isLive }: { c: ReturnType<typeof makeCartaoType>; t: (k: string, o?: Record<string, unknown>) => string; isLive: boolean }) {
  const dayPct = c.tarefas.length === 0 ? 0 : Math.round((c.concluidas / c.tarefas.length) * 100);
  const taskRawPct = c.atual && c.atual.minutos_previstos > 0
    ? (c.decorridoMin / c.atual.minutos_previstos) * 100
    : 0;
  const taskPct = Math.min(100, taskRawPct);
  const overPct = taskRawPct > 100 ? Math.min(100, ((taskRawPct - 100) / taskRawPct) * 100) : 0;

  let badgeLabel = isLive ? t("painel.badge.idle") : t("painel.mode.historic");
  let badgeClass = "bg-muted text-muted-foreground";
  if (c.urgencia) { badgeLabel = t("painel.badge.urgencia"); badgeClass = "bg-orange-500/15 text-orange-600 dark:text-orange-400"; }
  else if (c.pausada) { badgeLabel = t("painel.badge.pausa"); badgeClass = "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"; }
  else if (c.excedido) { badgeLabel = t("painel.badge.excedido"); badgeClass = "bg-destructive/15 text-destructive"; }
  else if (c.execAberta) { badgeLabel = t("painel.badge.ativo"); badgeClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"; }

  const cor = corFuncionario(c.f.cor);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
      {/* Colored band — strong presence of person color */}
      <div className="h-2" style={{ backgroundColor: cor }} aria-hidden />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-full text-white flex items-center justify-center text-sm font-semibold shrink-0 ring-2 ring-background shadow"
            style={{ backgroundColor: cor }}
          >
            {initials(c.f.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate" style={{ color: cor }}>{c.f.nome}</p>
            <p className="text-xs text-muted-foreground truncate">{c.f.funcao?.nome ?? "—"}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{badgeLabel}</span>
        </div>

        {c.urgencia && (
          <div className="mt-3 rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-300">
            ⚠ {c.urgencia.titulo}
          </div>
        )}

        {c.atual ? (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("painel.tarefaAtual")}</p>
            <p className="text-sm text-foreground mt-1">{c.atual.titulo}</p>
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className={`font-mono ${c.excedido ? "text-destructive" : "text-foreground"}`}>
                {formatMin(c.decorridoMin)} / {c.atual.minutos_previstos} min
              </span>
              {c.pausada && c.motivoPausa && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">⏸ {c.motivoPausa}</span>
              )}
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full"
                style={{ width: `${taskPct - (taskRawPct > 100 ? (overPct * taskPct / 100) : 0)}%`, backgroundColor: cor }}
              />
              {taskRawPct > 100 && (
                <div
                  className="h-full bg-destructive"
                  style={{ width: `${overPct * taskPct / 100}%` }}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {isLive ? t("painel.semTarefa") : t("painel.historicNoLive")}
          </p>
        )}

        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("painel.progressoDia")}</span>
            <span>{c.concluidas} / {c.tarefas.length} · {dayPct}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${dayPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetalheTarefas({
  c, execByTarefa, t, cor,
}: {
  c: ReturnType<typeof makeCartaoType>;
  execByTarefa: Map<string, Execucao[]>;
  t: (k: string, o?: Record<string, unknown>) => string;
  cor: string;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="py-1 pr-2">#</th>
          <th className="py-1 pr-2">{t("painel.tabela.titulo")}</th>
          <th className="py-1 pr-2">{t("painel.tabela.estado")}</th>
          <th className="py-1 pr-2 text-right">{t("painel.tabela.previsto")}</th>
          <th className="py-1 pr-2 text-right">{t("painel.tabela.real")}</th>
          <th className="py-1 text-right">{t("painel.tabela.desvio")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {c.tarefas.map((tk) => {
          const execs = execByTarefa.get(tk.id) ?? [];
          const realMin = execs.reduce((s, e) => {
            if (!e.fim) return s;
            return s + (new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000;
          }, 0);
          const finalizada = tk.estado === "concluida" || tk.estado === "saltada";
          const desvio = finalizada && tk.estado === "concluida" ? realMin - tk.minutos_previstos : null;
          const desvioOver = desvio !== null && desvio > 0;
          const desvioUnder = desvio !== null && desvio <= 0;
          return (
            <tr key={tk.id} className="text-foreground">
              <td className="py-1 pr-2 text-muted-foreground" style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 6 }}>{tk.ordem}</td>
              <td className="py-1 pr-2">{tk.titulo}</td>
              <td className="py-1 pr-2"><EstadoBadge estado={tk.estado} t={t} /></td>
              <td className="py-1 pr-2 text-right font-mono text-xs">{tk.minutos_previstos}m</td>
              <td className="py-1 pr-2 text-right font-mono text-xs">{tk.estado === "concluida" ? `${Math.round(realMin)}m` : "—"}</td>
              <td className={`py-1 text-right font-mono text-xs font-semibold ${desvioOver ? "text-destructive" : desvioUnder ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {desvio === null ? "—" : `${desvio > 0 ? "+" : ""}${Math.round(desvio)}m`}
              </td>
            </tr>
          );
        })}
        {c.tarefas.length === 0 && (
          <tr><td colSpan={6} className="py-2 text-center text-muted-foreground">{t("painel.tabela.semTarefas")}</td></tr>
        )}
      </tbody>
    </table>
  );
}

function EstadoBadge({ estado, t }: { estado: Estado; t: (k: string) => string }) {
  const map: Record<Estado, string> = {
    pendente: "bg-muted text-muted-foreground",
    a_decorrer: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    pausada: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    saltada: "bg-muted text-muted-foreground line-through",
    concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[estado]}`}>{t(`painel.estado.${estado}`)}</span>;
}

function formatMin(min: number): string {
  if (min < 0) min = 0;
  const m = Math.floor(min);
  const s = Math.floor((min - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Helper purely for typing in sub-components
function makeCartaoType() {
  return null as unknown as {
    f: Funcionario;
    tarefas: Tarefa[];
    totalReal: number;
    totalPrevisto: number;
    concluidas: number;
    atual: Tarefa | null;
    execAberta: Execucao | null;
    decorridoMin: number;
    excedido: boolean;
    pausada: boolean;
    motivoPausa: string | null;
    urgencia: Evento | null;
    eventosFunc: Evento[];
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl w-full mx-auto">{children}</main>
  );
}
