import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuthUser } from "@/routes/_authenticated/auth-context";
import { corFuncionario } from "@/lib/cores";

export const Route = createFileRoute("/_authenticated/hoje/")({
  component: HojePage,
});

type Estado = "pendente" | "a_decorrer" | "pausada" | "saltada" | "concluida";
type Funcionario = {
  id: string;
  nome: string;
  cor: string | null;
  funcao: { nome: string } | null;
};
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
type Motivo = { id: string; label: string };
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

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function fmtClock(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function HojePage() {
  const { t, i18n } = useTranslation();
  const user = useAuthUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const data = todayISO();
  const [now, setNow] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [pausaMotivoId, setPausaMotivoId] = useState<string>("");
  const [bellOpen, setBellOpen] = useState(false);
  const [retomarPrompt, setRetomarPrompt] = useState<{ tarefaId: string; titulo: string } | null>(null);
  const [novoEvOpen, setNovoEvOpen] = useState(false);
  const [novoEv, setNovoEv] = useState<{ tipo: "recebimento" | "levantamento" | "outro"; titulo: string; descricao: string }>(
    { tipo: "recebimento", titulo: "", descricao: "" },
  );
  const [duvidasTarefa, setDuvidasTarefa] = useState<{ titulo: string; atividadeId: string } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Carrega o meu funcionário (ativo)
  const meQuery = useQuery({
    queryKey: ["meu-funcionario", user.id],
    queryFn: async (): Promise<Funcionario | null> => {
      const { data: rows, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cor, funcao:funcoes(nome)")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      return (rows as unknown as Funcionario) ?? null;
    },
  });
  const me = meQuery.data ?? null;

  // Garante geração das tarefas de hoje
  const ensureQuery = useQuery({
    enabled: !!me,
    queryKey: ["hoje-ensure", me?.id, data],
    queryFn: async (): Promise<true> => {
      const { error } = await supabase.rpc("gerar_tarefas_do_dia", {
        _funcionario_id: me!.id,
        _data: data,
      });
      if (error) throw error;
      return true;
    },
  });

  const tarefasQuery = useQuery({
    enabled: !!me && ensureQuery.isSuccess,
    queryKey: ["hoje-tarefas", me?.id, data],
    queryFn: async (): Promise<Tarefa[]> => {
      const { data: rows, error } = await supabase
        .from("tarefas_dia")
        .select("id, funcionario_id, titulo, ordem, minutos_previstos, estado")
        .eq("funcionario_id", me!.id)
        .eq("data", data)
        .order("ordem");
      if (error) throw error;
      return (rows ?? []) as Tarefa[];
    },
  });

  const execucoesQuery = useQuery({
    enabled: !!tarefasQuery.data && tarefasQuery.data.length > 0,
    queryKey: ["hoje-execucoes", me?.id, data, tarefasQuery.data?.length ?? 0],
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

  const motivosQuery = useQuery({
    queryKey: ["motivos-pausa-ativos"],
    queryFn: async (): Promise<Motivo[]> => {
      const { data: rows, error } = await supabase
        .from("motivos_pausa")
        .select("id, label")
        .eq("ativo", true)
        .order("label");
      if (error) throw error;
      return (rows ?? []) as Motivo[];
    },
  });

  const motivosMap = useMemo(() => {
    const m = new Map<string, string>();
    (motivosQuery.data ?? []).forEach((x) => m.set(x.id, x.label));
    return m;
  }, [motivosQuery.data]);

  const motivoOutroId = useMemo(
    () => motivosQuery.data?.find((m) => m.label.toLowerCase() === "outro")?.id ?? null,
    [motivosQuery.data],
  );

  const eventosQuery = useQuery({
    enabled: !!me,
    queryKey: ["hoje-eventos", me?.id, data],
    queryFn: async (): Promise<Evento[]> => {
      const start = `${data}T00:00:00Z`;
      const end = `${data}T23:59:59Z`;
      const { data: rows, error } = await supabase
        .from("eventos")
        .select("id, funcionario_id, tipo, titulo, descricao, inicio, fim, prioridade, estado, tarefa_pausada_id, lido")
        .eq("funcionario_id", me!.id)
        .gte("inicio", start).lte("inicio", end)
        .order("inicio", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as Evento[];
    },
  });

  // Setores do meu funcionário (para atividades + macros contextuais)
  const setoresQuery = useQuery({
    enabled: !!me,
    queryKey: ["meus-setores-ids", me?.id],
    queryFn: async (): Promise<string[]> => {
      const { data: rows, error } = await supabase
        .from("funcionario_setores")
        .select("funcao_id")
        .eq("funcionario_id", me!.id);
      if (error) throw error;
      return (rows ?? []).map((r: { funcao_id: string }) => r.funcao_id);
    },
  });

  // Atividades nos meus setores (para encontrar id por nome)
  const atividadesQuery = useQuery({
    enabled: !!setoresQuery.data && setoresQuery.data.length > 0,
    queryKey: ["minhas-atividades", (setoresQuery.data ?? []).join(",")],
    queryFn: async (): Promise<{ id: string; nome: string; funcao_id: string }[]> => {
      const { data: rows, error } = await supabase
        .from("atividades")
        .select("id, nome, funcao_id")
        .eq("ativo", true)
        .in("funcao_id", setoresQuery.data ?? []);
      if (error) throw error;
      return rows ?? [];
    },
  });

  // Contagem de macros por atividade (só para mostrar/ocultar botão)
  const macrosCountQuery = useQuery({
    enabled: !!atividadesQuery.data && atividadesQuery.data.length > 0,
    queryKey: ["macros-count", (atividadesQuery.data ?? []).map((a) => a.id).join(",")],
    queryFn: async (): Promise<Map<string, number>> => {
      const ids = (atividadesQuery.data ?? []).map((a) => a.id);
      const { data: rows, error } = await supabase
        .from("macros")
        .select("atividade_id")
        .eq("ativo", true)
        .in("atividade_id", ids);
      if (error) throw error;
      const m = new Map<string, number>();
      (rows ?? []).forEach((r: { atividade_id: string | null }) => {
        if (!r.atividade_id) return;
        m.set(r.atividade_id, (m.get(r.atividade_id) ?? 0) + 1);
      });
      return m;
    },
  });

  const atividadePorNome = useMemo(() => {
    const m = new Map<string, string>();
    (atividadesQuery.data ?? []).forEach((a) => {
      m.set(a.nome.trim().toLowerCase(), a.id);
    });
    return m;
  }, [atividadesQuery.data]);

  function atividadeIdDaTarefa(titulo: string): string | null {
    return atividadePorNome.get(titulo.trim().toLowerCase()) ?? null;
  }
  function tarefaTemMacros(titulo: string): { atividadeId: string } | null {
    const aid = atividadeIdDaTarefa(titulo);
    if (!aid) return null;
    const count = macrosCountQuery.data?.get(aid) ?? 0;
    return count > 0 ? { atividadeId: aid } : null;
  }


  // Realtime
  useEffect(() => {
    if (!me) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["hoje-tarefas", me.id, data] });
      qc.invalidateQueries({ queryKey: ["hoje-execucoes", me.id, data] });
      qc.invalidateQueries({ queryKey: ["hoje-eventos", me.id, data] });
    };
    const ch = supabase
      .channel(`hoje-${me.id}-${data}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas_dia", filter: `funcionario_id=eq.${me.id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "execucoes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos", filter: `funcionario_id=eq.${me.id}` }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, data, qc]);

  const tarefas = tarefasQuery.data ?? [];
  const execucoes = execucoesQuery.data ?? [];
  const execByTarefa = useMemo(() => {
    const m = new Map<string, Execucao[]>();
    execucoes.forEach((e) => {
      const arr = m.get(e.tarefa_dia_id) ?? [];
      arr.push(e);
      m.set(e.tarefa_dia_id, arr);
    });
    return m;
  }, [execucoes]);

  function execAbertaDe(tid: string): Execucao | null {
    return (execByTarefa.get(tid) ?? []).find((e) => !e.fim) ?? null;
  }

  function tempoGastoMs(tid: string): number {
    const execs = execByTarefa.get(tid) ?? [];
    let total = 0;
    for (const e of execs) {
      const start = new Date(e.inicio).getTime();
      const end = e.fim ? new Date(e.fim).getTime() : now;
      total += Math.max(0, end - start);
    }
    return total;
  }

  // === MUTAÇÕES ===

  const iniciar = useMutation({
    mutationFn: async (tarefaId: string) => {
      // 1. Se houver outra tarefa a_decorrer minha, fecha-a (passa a pausada)
      const decorrendo = tarefas.find((t) => t.estado === "a_decorrer" && t.id !== tarefaId);
      if (decorrendo) {
        const aberta = execAbertaDe(decorrendo.id);
        if (aberta) {
          const { error: eClose } = await supabase
            .from("execucoes")
            .update({ fim: new Date().toISOString(), motivo_pausa_id: motivoOutroId })
            .eq("id", aberta.id);
          if (eClose) throw eClose;
        }
        const { error: eState } = await supabase
          .from("tarefas_dia")
          .update({ estado: "pausada" })
          .eq("id", decorrendo.id);
        if (eState) throw eState;
      }
      // 2. Garante que não há execução aberta nesta tarefa antes de criar nova
      const minhaAberta = execAbertaDe(tarefaId);
      if (minhaAberta) {
        // já está a correr — apenas atualiza estado
        const { error } = await supabase.from("tarefas_dia").update({ estado: "a_decorrer" }).eq("id", tarefaId);
        if (error) throw error;
        return;
      }
      // 3. Cria nova execução aberta
      const { error: eIns } = await supabase
        .from("execucoes")
        .insert({ tarefa_dia_id: tarefaId });
      if (eIns) throw eIns;
      const { error: eEst } = await supabase
        .from("tarefas_dia")
        .update({ estado: "a_decorrer" })
        .eq("id", tarefaId);
      if (eEst) throw eEst;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hoje-tarefas", me?.id, data] });
      qc.invalidateQueries({ queryKey: ["hoje-execucoes", me?.id, data] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const concluir = useMutation({
    mutationFn: async (tarefaId: string) => {
      const aberta = execAbertaDe(tarefaId);
      if (aberta) {
        const { error } = await supabase
          .from("execucoes")
          .update({ fim: new Date().toISOString() })
          .eq("id", aberta.id);
        if (error) throw error;
      }
      const { error: eEst } = await supabase
        .from("tarefas_dia")
        .update({ estado: "concluida" })
        .eq("id", tarefaId);
      if (eEst) throw eEst;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hoje-tarefas", me?.id, data] });
      qc.invalidateQueries({ queryKey: ["hoje-execucoes", me?.id, data] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const pausar = useMutation({
    mutationFn: async (args: { tarefaId: string; motivoId: string }) => {
      const aberta = execAbertaDe(args.tarefaId);
      if (aberta) {
        const { error } = await supabase
          .from("execucoes")
          .update({ fim: new Date().toISOString(), motivo_pausa_id: args.motivoId })
          .eq("id", aberta.id);
        if (error) throw error;
      }
      const { error: eEst } = await supabase
        .from("tarefas_dia")
        .update({ estado: "pausada" })
        .eq("id", args.tarefaId);
      if (eEst) throw eEst;
    },
    onSuccess: () => {
      setPausingId(null);
      setPausaMotivoId("");
      qc.invalidateQueries({ queryKey: ["hoje-tarefas", me?.id, data] });
      qc.invalidateQueries({ queryKey: ["hoje-execucoes", me?.id, data] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const saltar = useMutation({
    mutationFn: async (tarefaId: string) => {
      const { error } = await supabase
        .from("tarefas_dia")
        .update({ estado: "saltada" })
        .eq("id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hoje-tarefas", me?.id, data] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const fecharEvento = useMutation({
    mutationFn: async (args: { eventoId: string; retomar: boolean; tarefaTitulo?: string; tarefaId?: string | null }) => {
      const { error } = await supabase.rpc("fechar_evento", {
        _evento_id: args.eventoId,
        _retomar: args.retomar,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hoje-eventos", me?.id, data] });
      qc.invalidateQueries({ queryKey: ["hoje-tarefas", me?.id, data] });
      qc.invalidateQueries({ queryKey: ["hoje-execucoes", me?.id, data] });
      if (!vars.retomar && vars.tarefaId && vars.tarefaTitulo) {
        setRetomarPrompt({ tarefaId: vars.tarefaId, titulo: vars.tarefaTitulo });
      } else {
        setRetomarPrompt(null);
      }
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const registarEvento = useMutation({
    mutationFn: async () => {
      if (!novoEv.titulo.trim()) throw new Error(t("hoje.eventos.fillRequired"));
      const { error } = await supabase.from("eventos").insert({
        funcionario_id: me!.id,
        tipo: novoEv.tipo,
        titulo: novoEv.titulo.trim(),
        descricao: novoEv.descricao.trim(),
        criado_por: "funcionario",
        prioridade: "normal",
        estado: "aberto",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoEvOpen(false);
      setNovoEv({ tipo: "recebimento", titulo: "", descricao: "" });
      qc.invalidateQueries({ queryKey: ["hoje-eventos", me?.id, data] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const marcarLidos = useMutation({
    mutationFn: async () => {
      if (!me) return;
      const { error } = await supabase.rpc("marcar_eventos_lidos", { _funcionario_id: me.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hoje-eventos", me?.id, data] }),
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // === RENDER ===

  if (meQuery.isLoading) {
    return <Shell onSignOut={handleSignOut}><p className="text-muted-foreground">{t("common.loading")}</p></Shell>;
  }
  if (!me) {
    return (
      <Shell onSignOut={handleSignOut}>
        <p className="text-muted-foreground">{t("home.unlinked")}</p>
        <Link to="/app" className="text-sm text-primary underline mt-2 inline-block">{t("common.back")}</Link>
      </Shell>
    );
  }

  const cor = corFuncionario(me.cor);
  const concluidas = tarefas.filter((tk) => tk.estado === "concluida").length;
  const atual =
    tarefas.find((tk) => tk.estado === "a_decorrer") ??
    tarefas.find((tk) => tk.estado === "pendente") ??
    tarefas.find((tk) => tk.estado === "pausada") ??
    null;
  const motivos = motivosQuery.data ?? [];
  const eventos = eventosQuery.data ?? [];
  const eventosAbertos = eventos.filter((e) => e.estado === "aberto");
  const urgenciaAberta = eventosAbertos.find((e) => e.prioridade === "urgente") ?? null;
  const normaisAbertos = eventosAbertos.filter((e) => e.prioridade !== "urgente");
  const eventosFechados = eventos.filter((e) => e.estado === "fechado");
  const unread = eventosAbertos.filter((e) => !e.lido).length;

  const dateFmt = new Intl.DateTimeFormat(i18n.language === "pt" ? "pt-PT" : "en-GB", {
    weekday: "long", day: "2-digit", month: "long",
  }).format(new Date());

  return (
    <Shell onSignOut={handleSignOut}>
      {/* Cabeçalho com avatar colorido */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4" style={{ borderLeft: `6px solid ${cor}` }}>
        <div
          className="h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0"
          style={{ backgroundColor: cor }}
        >
          {initials(me.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-foreground truncate">{me.nome}</h1>
          <p className="text-sm text-muted-foreground">{dateFmt} · {me.funcao?.nome ?? "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("hoje.progresso")}</p>
          <p className="text-xl font-semibold text-foreground">{concluidas} / {tarefas.length}</p>
        </div>
        <button
          onClick={() => { setBellOpen((v) => { const nv = !v; if (nv && unread > 0) marcarLidos.mutate(); return nv; }); }}
          className="relative ml-2 rounded-full border border-input bg-background p-2 hover:bg-accent"
          aria-label={t("hoje.eventos.sino")}
          title={t("hoje.eventos.sino")}
        >
          <span className="text-lg">🔔</span>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </button>
        <Link
          to="/ajuda"
          className="ml-1 rounded-full border border-input bg-background p-2 hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label={t("hoje.ajudaProcesso")}
          title={t("hoje.ajudaProcesso")}
        >
          <HelpCircle className="h-5 w-5" />
        </Link>
      </div>

      {bellOpen && (
        <div className="mt-3 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{t("hoje.eventos.sino")}</h3>
            <button onClick={() => setNovoEvOpen((v) => !v)} className="text-xs rounded-md border border-input bg-background px-2 py-1 hover:bg-accent">
              + {t("hoje.eventos.registar")}
            </button>
          </div>
          {novoEvOpen && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block text-xs text-muted-foreground mb-1">{t("hoje.eventos.tipo")}</span>
                <select
                  value={novoEv.tipo}
                  onChange={(e) => setNovoEv({ ...novoEv, tipo: e.target.value as typeof novoEv.tipo })}
                  className="w-full rounded border border-input bg-background px-2 py-1.5"
                >
                  <option value="recebimento">{t("painel.eventoTipo.recebimento")}</option>
                  <option value="levantamento">{t("painel.eventoTipo.levantamento")}</option>
                  <option value="outro">{t("painel.eventoTipo.outro")}</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-xs text-muted-foreground mb-1">{t("hoje.eventos.tituloLabel")}</span>
                <input
                  value={novoEv.titulo}
                  onChange={(e) => setNovoEv({ ...novoEv, titulo: e.target.value })}
                  className="w-full rounded border border-input bg-background px-2 py-1.5"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="block text-xs text-muted-foreground mb-1">{t("hoje.eventos.descricaoLabel")}</span>
                <textarea
                  value={novoEv.descricao}
                  onChange={(e) => setNovoEv({ ...novoEv, descricao: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-input bg-background px-2 py-1.5"
                />
              </label>
              <div className="sm:col-span-2 flex gap-2">
                <button
                  onClick={() => registarEvento.mutate()}
                  disabled={registarEvento.isPending}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {registarEvento.isPending ? t("hoje.eventos.submitting") : t("hoje.eventos.submit")}
                </button>
                <button onClick={() => setNovoEvOpen(false)} className="text-sm text-muted-foreground hover:underline">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
          {eventosAbertos.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">{t("hoje.eventos.semAbertos")}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {eventosAbertos.map((e) => (
                <li key={e.id} className="flex items-center justify-between border-b border-border/40 py-1">
                  <span className="truncate">
                    {e.prioridade === "urgente" && <span className="mr-1 text-destructive font-bold">URG</span>}
                    {e.titulo}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(e.inicio).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          )}
          {eventosFechados.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer">{t("painel.eventosFechados")} · {eventosFechados.length}</summary>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {eventosFechados.map((e) => (
                  <li key={e.id} className="flex items-center justify-between border-b border-border/30 py-1">
                    <span className="truncate">{e.titulo}</span>
                    <span>{e.fim ? new Date(e.fim).toLocaleTimeString() : "—"}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
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

      {retomarPrompt && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">{t("hoje.eventos.retomarPergunta", { titulo: retomarPrompt.titulo })}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                // retoma manualmente: cria nova execução e marca a_decorrer
                iniciar.mutate(retomarPrompt.tarefaId);
                setRetomarPrompt(null);
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t("hoje.eventos.retomar")}
            </button>
            <button onClick={() => setRetomarPrompt(null)} className="text-sm text-muted-foreground hover:underline">
              {t("hoje.eventos.naoRetomar")}
            </button>
          </div>
        </div>
      )}

      {urgenciaAberta && (
        <div className="mt-4 rounded-xl border-2 border-destructive bg-destructive/10 p-5 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🚨</span>
            <span className="text-xs font-bold tracking-widest text-destructive">{t("hoje.eventos.urgenciaTitulo")}</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-foreground">{urgenciaAberta.titulo}</h2>
          {urgenciaAberta.descricao && (
            <p className="mt-1 text-sm text-foreground/80 whitespace-pre-wrap">{urgenciaAberta.descricao}</p>
          )}
          <button
            onClick={() => {
              const tarefaPausada = urgenciaAberta.tarefa_pausada_id
                ? tarefas.find((t) => t.id === urgenciaAberta.tarefa_pausada_id) ?? null
                : null;
              fecharEvento.mutate({
                eventoId: urgenciaAberta.id,
                retomar: false,
                tarefaId: tarefaPausada?.id ?? null,
                tarefaTitulo: tarefaPausada?.titulo,
              });
            }}
            disabled={fecharEvento.isPending}
            className="mt-4 w-full rounded-lg bg-destructive px-4 py-4 text-base font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            ✓ {t("hoje.eventos.concluirUrgencia")}
          </button>
        </div>
      )}

      {normaisAbertos.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground">{t("hoje.eventos.aAtender")}</h3>
          <ul className="mt-2 space-y-2">
            {normaisAbertos.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 border-t border-border/50 pt-2 first:border-0 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">
                      {t(`painel.eventoTipo.${e.tipo}`)}
                    </span>
                    {e.titulo}
                  </p>
                  {e.descricao && <p className="text-xs text-muted-foreground truncate">{e.descricao}</p>}
                </div>
                <button
                  onClick={() => fecharEvento.mutate({ eventoId: e.id, retomar: false })}
                  disabled={fecharEvento.isPending}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  ✓ {t("hoje.eventos.concluir")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* TAREFA ATUAL em destaque */}
      {atual ? (
        <TarefaAtualCard
          tarefa={atual}
          cor={cor}
          execAberta={execAbertaDe(atual.id)}
          tempoGastoMs={tempoGastoMs(atual.id)}
          now={now}
          motivos={motivos}
          motivosMap={motivosMap}
          pausingId={pausingId}
          pausaMotivoId={pausaMotivoId}
          setPausingId={setPausingId}
          setPausaMotivoId={setPausaMotivoId}
          onIniciar={() => iniciar.mutate(atual.id)}
          onConcluir={() => concluir.mutate(atual.id)}
          onPausarConfirm={(motivoId) => pausar.mutate({ tarefaId: atual.id, motivoId })}
          onSaltar={() => saltar.mutate(atual.id)}
          iniciarPending={iniciar.isPending}
          concluirPending={concluir.isPending}
          pausarPending={pausar.isPending}
          t={t}
        />
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-2xl font-semibold text-foreground">🎉 {t("hoje.tudoConcluido")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("hoje.semTarefasHoje")}</p>
        </div>
      )}

      {/* LISTA das tarefas do dia */}
      <h2 className="mt-10 text-lg font-semibold text-foreground">{t("hoje.listaTarefas")}</h2>
      <ul className="mt-3 space-y-2">
        {tarefas.map((tk) => {
          const aberta = execAbertaDe(tk.id);
          const gasto = tempoGastoMs(tk.id);
          const gastoMin = Math.floor(gasto / 60000);
          const isAtual = atual?.id === tk.id;
          return (
            <li
              key={tk.id}
              className="rounded-lg border border-border bg-card p-3"
              style={isAtual ? { borderLeft: `4px solid ${cor}` } : undefined}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-6 shrink-0">#{tk.ordem}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tk.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {gastoMin}m / {tk.minutos_previstos}m
                  </p>
                </div>
                <EstadoBadge estado={tk.estado} t={t} />
                {(() => {
                  const macro = tarefaTemMacros(tk.titulo);
                  return macro ? (
                    <button
                      onClick={() => setDuvidasTarefa({ titulo: tk.titulo, atividadeId: macro.atividadeId })}
                      className="rounded-md border border-input bg-background p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground shrink-0"
                      title={t("hoje.duvidas")}
                      aria-label={t("hoje.duvidas")}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  ) : null;
                })()}
                <ActionsInline
                  estado={tk.estado}
                  cor={cor}
                  hasOpen={!!aberta}
                  onIniciar={() => iniciar.mutate(tk.id)}
                  onConcluir={() => concluir.mutate(tk.id)}
                  onPausar={() => { setPausingId(tk.id); setPausaMotivoId(motivos[0]?.id ?? ""); }}
                  onSaltar={() => saltar.mutate(tk.id)}
                  t={t}
                />
              </div>
              {pausingId === tk.id && (
                <PausaForm
                  motivos={motivos}
                  motivoId={pausaMotivoId}
                  setMotivoId={setPausaMotivoId}
                  onConfirm={() => pausar.mutate({ tarefaId: tk.id, motivoId: pausaMotivoId })}
                  onCancel={() => { setPausingId(null); setPausaMotivoId(""); }}
                  pending={pausar.isPending}
                  t={t}
                />
              )}
            </li>
          );
        })}
        {tarefas.length === 0 && (
          <li className="text-sm text-muted-foreground">{t("hoje.semTarefasHoje")}</li>
        )}
      </ul>
    </Shell>
  );
}

// ===== Sub-componentes =====

type TFn = (k: string, o?: Record<string, unknown>) => string;

function TarefaAtualCard(props: {
  tarefa: Tarefa;
  cor: string;
  execAberta: Execucao | null;
  tempoGastoMs: number;
  now: number;
  motivos: Motivo[];
  motivosMap: Map<string, string>;
  pausingId: string | null;
  pausaMotivoId: string;
  setPausingId: (id: string | null) => void;
  setPausaMotivoId: (id: string) => void;
  onIniciar: () => void;
  onConcluir: () => void;
  onPausarConfirm: (motivoId: string) => void;
  onSaltar: () => void;
  iniciarPending: boolean;
  concluirPending: boolean;
  pausarPending: boolean;
  t: TFn;
}) {
  const { tarefa, cor, execAberta, tempoGastoMs, now, motivos, t } = props;
  const decorridoSessaoMs = execAberta ? now - new Date(execAberta.inicio).getTime() : 0;
  const previstoMs = tarefa.minutos_previstos * 60000;
  const pct = previstoMs > 0 ? Math.min(100, (tempoGastoMs / previstoMs) * 100) : 0;
  const excedido = previstoMs > 0 && tempoGastoMs > previstoMs;
  const isOpenPausa = props.pausingId === tarefa.id;

  return (
    <div
      className="mt-4 rounded-xl border bg-card p-5"
      style={{ borderColor: cor, borderTopWidth: 4 }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide" style={{ color: cor }}>{t("hoje.tarefaAtual")}</p>
        <EstadoBadge estado={tarefa.estado} t={t} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{tarefa.titulo}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("hoje.sessaoAtual")}</p>
          <p className={`mt-1 font-mono text-2xl ${execAberta ? "" : "text-muted-foreground"}`}>
            {execAberta ? fmtClock(decorridoSessaoMs) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("hoje.tempoTotal")}</p>
          <p className={`mt-1 font-mono text-2xl ${excedido ? "text-destructive" : "text-foreground"}`}>
            {fmtClock(tempoGastoMs)} <span className="text-sm text-muted-foreground">/ {tarefa.minutos_previstos}m</span>
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${excedido ? "bg-destructive" : ""}`}
          style={{ width: `${pct}%`, backgroundColor: excedido ? undefined : cor }}
        />
      </div>

      {/* Botões grandes */}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {(tarefa.estado === "pendente" || tarefa.estado === "pausada" || tarefa.estado === "saltada") && (
          <button
            onClick={props.onIniciar}
            disabled={props.iniciarPending}
            className="rounded-lg px-4 py-4 text-base font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: cor }}
          >
            {tarefa.estado === "pausada" ? t("hoje.acao.retomar") : t("hoje.acao.iniciar")}
          </button>
        )}
        {tarefa.estado === "a_decorrer" && (
          <>
            <button
              onClick={props.onConcluir}
              disabled={props.concluirPending}
              className="rounded-lg px-4 py-4 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              ✓ {t("hoje.acao.concluir")}
            </button>
            <button
              onClick={() => { props.setPausingId(tarefa.id); props.setPausaMotivoId(motivos[0]?.id ?? ""); }}
              disabled={props.pausarPending}
              className="rounded-lg px-4 py-4 text-base font-semibold border border-input bg-background text-foreground hover:bg-accent disabled:opacity-50"
            >
              ⏸ {t("hoje.acao.pausar")}
            </button>
          </>
        )}
        {(tarefa.estado === "pendente" || tarefa.estado === "pausada") && (
          <button
            onClick={props.onSaltar}
            className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground border border-dashed border-input"
          >
            ⤼ {t("hoje.acao.saltar")}
          </button>
        )}
      </div>

      {isOpenPausa && (
        <PausaForm
          motivos={motivos}
          motivoId={props.pausaMotivoId}
          setMotivoId={props.setPausaMotivoId}
          onConfirm={() => props.onPausarConfirm(props.pausaMotivoId)}
          onCancel={() => { props.setPausingId(null); props.setPausaMotivoId(""); }}
          pending={props.pausarPending}
          t={t}
        />
      )}
    </div>
  );
}

function ActionsInline(props: {
  estado: Estado;
  cor: string;
  hasOpen: boolean;
  onIniciar: () => void;
  onConcluir: () => void;
  onPausar: () => void;
  onSaltar: () => void;
  t: TFn;
}) {
  const { estado, t } = props;
  if (estado === "concluida") return null;
  return (
    <div className="flex items-center gap-1 shrink-0">
      {(estado === "pendente" || estado === "pausada" || estado === "saltada") && (
        <button
          onClick={props.onIniciar}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: props.cor }}
        >
          {estado === "pausada" ? t("hoje.acao.retomar") : t("hoje.acao.iniciar")}
        </button>
      )}
      {estado === "a_decorrer" && (
        <>
          <button
            onClick={props.onConcluir}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700"
          >
            ✓
          </button>
          <button
            onClick={props.onPausar}
            className="rounded-md px-3 py-1.5 text-xs font-medium border border-input bg-background text-foreground hover:bg-accent"
          >
            ⏸
          </button>
        </>
      )}
      {(estado === "pendente" || estado === "pausada") && (
        <button
          onClick={props.onSaltar}
          className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          title={t("hoje.acao.saltar")}
        >
          ⤼
        </button>
      )}
    </div>
  );
}

function PausaForm(props: {
  motivos: Motivo[];
  motivoId: string;
  setMotivoId: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  t: TFn;
}) {
  const { t, motivos } = props;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <label className="text-sm text-muted-foreground">{t("hoje.motivoPausa")}</label>
      <select
        value={props.motivoId}
        onChange={(e) => props.setMotivoId(e.target.value)}
        className="rounded border border-input bg-background px-2 py-1 text-sm"
      >
        {motivos.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
      <button
        onClick={props.onConfirm}
        disabled={props.pending || !props.motivoId}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {t("hoje.confirmarPausa")}
      </button>
      <button onClick={props.onCancel} className="text-xs text-muted-foreground hover:underline">
        {t("common.cancel")}
      </button>
    </div>
  );
}

function EstadoBadge({ estado, t }: { estado: Estado; t: TFn }) {
  const map: Record<Estado, string> = {
    pendente: "bg-muted text-muted-foreground",
    a_decorrer: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    pausada: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    saltada: "bg-muted text-muted-foreground line-through",
    concluida: "bg-primary/10 text-primary",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[estado]}`}>{t(`painel.estado.${estado}`)}</span>;
}

function Shell({ children, onSignOut }: { children: React.ReactNode; onSignOut: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
        <div>
          <p className="font-semibold text-foreground tracking-tight">{t("app.name")}</p>
          <p className="text-xs text-muted-foreground">{t("hoje.title")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">
            {t("common.back")}
          </Link>
          <LanguageSwitcher />
          <button
            onClick={onSignOut}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            {t("common.signOut")}
          </button>
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-3xl w-full mx-auto">{children}</main>
    </div>
  );
}
