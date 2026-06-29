import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/routes/_authenticated/auth-context";

export const Route = createFileRoute("/_authenticated/relatorios/")({
  component: RelatoriosPage,
  errorComponent: ({ error }) => (
    <main className="px-6 py-10 max-w-5xl mx-auto">
      <p className="text-sm text-destructive">{error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="px-6 py-10 max-w-5xl mx-auto">
      <p className="text-sm text-muted-foreground">Não encontrado.</p>
    </main>
  ),
});

type Funcionario = { id: string; nome: string; cor: string | null };
type TarefaRow = {
  id: string;
  funcionario_id: string;
  data: string;
  estado: string;
  tipo: string;
  titulo: string;
  minutos_previstos: number;
  execucoes: { inicio: string; fim: string | null }[];
};

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
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function fmtMin(min: number) {
  if (!isFinite(min) || min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function RelatoriosPage() {
  const user = useAuthUser();
  const [de, setDe] = useState(() => addDaysISO(todayISO(), -29));
  const [ate, setAte] = useState(() => todayISO());
  const [funcId, setFuncId] = useState<string>("__all");

  const { data: isGestor, isLoading: loadingRole } = useQuery({
    queryKey: ["is-gestor", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "gestor")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const { data: funcionarios } = useQuery({
    enabled: !!isGestor,
    queryKey: ["funcionarios-relatorio"],
    queryFn: async (): Promise<Funcionario[]> => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cor")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tarefas, isFetching } = useQuery({
    enabled: !!isGestor && !!funcionarios,
    queryKey: ["relatorio", de, ate, funcId],
    queryFn: async (): Promise<TarefaRow[]> => {
      let q = supabase
        .from("tarefas_dia")
        .select("id, funcionario_id, data, estado, tipo, titulo, minutos_previstos, execucoes ( inicio, fim )")
        .gte("data", de)
        .lte("data", ate)
        .eq("tipo", "atividade")
        .order("data", { ascending: false });
      if (funcId !== "__all") q = q.eq("funcionario_id", funcId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TarefaRow[];
    },
  });

  const stats = useMemo(() => {
    const byFunc = new Map<string, {
      total: number; concluidas: number; saltadas: number; pendentes: number; emCurso: number;
      previstoMin: number; realMin: number; concluidasDentro: number; concluidasFora: number;
    }>();
    const ensure = (id: string) => {
      let s = byFunc.get(id);
      if (!s) {
        s = { total: 0, concluidas: 0, saltadas: 0, pendentes: 0, emCurso: 0, previstoMin: 0, realMin: 0, concluidasDentro: 0, concluidasFora: 0 };
        byFunc.set(id, s);
      }
      return s;
    };
    (tarefas ?? []).forEach((t) => {
      const s = ensure(t.funcionario_id);
      s.total++;
      s.previstoMin += t.minutos_previstos || 0;
      const realMin = (t.execucoes ?? []).reduce((sum, e) => {
        if (!e.fim) return sum;
        return sum + (new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000;
      }, 0);
      s.realMin += realMin;
      if (t.estado === "concluida") {
        s.concluidas++;
        if (realMin <= (t.minutos_previstos || 0)) s.concluidasDentro++;
        else s.concluidasFora++;
      } else if (t.estado === "saltada") {
        s.saltadas++;
      } else if (t.estado === "a_decorrer" || t.estado === "pausada") {
        s.emCurso++;
      } else {
        s.pendentes++;
      }
    });
    return byFunc;
  }, [tarefas]);

  const global = useMemo(() => {
    let total = 0, concluidas = 0, pendentes = 0, saltadas = 0, emCurso = 0;
    let previstoMin = 0, realMin = 0, concluidasDentro = 0;
    stats.forEach((s) => {
      total += s.total; concluidas += s.concluidas; pendentes += s.pendentes;
      saltadas += s.saltadas; emCurso += s.emCurso;
      previstoMin += s.previstoMin; realMin += s.realMin;
      concluidasDentro += s.concluidasDentro;
    });
    const concl = total > 0 ? (concluidas / total) * 100 : 0;
    const efic = realMin > 0 ? (previstoMin / realMin) * 100 : 0;
    const dentro = concluidas > 0 ? (concluidasDentro / concluidas) * 100 : 0;
    const mediaReal = concluidas > 0 ? realMin / concluidas : 0;
    return { total, concluidas, pendentes, saltadas, emCurso, previstoMin, realMin, concl, efic, dentro, mediaReal };
  }, [stats]);

  if (loadingRole) {
    return <Shell><p className="text-muted-foreground text-sm">A carregar…</p></Shell>;
  }
  if (!isGestor) {
    return <Shell><p className="text-muted-foreground text-sm">Acesso restrito ao gestor.</p></Shell>;
  }

  const funcMap = new Map((funcionarios ?? []).map((f) => [f.id, f] as const));

  function setPreset(days: number) {
    setAte(todayISO());
    setDe(addDaysISO(todayISO(), -(days - 1)));
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Relatórios</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Desempenho e eficiência por funcionário entre datas.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button onClick={() => setPreset(7)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">7 dias</button>
          <button onClick={() => setPreset(30)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">30 dias</button>
          <button onClick={() => setPreset(90)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">90 dias</button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          De
          <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Até
          <input type="date" value={ate} min={de} max={todayISO()} onChange={(e) => setAte(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Funcionário
          <select value={funcId} onChange={(e) => setFuncId(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground">
            <option value="__all">Todos</option>
            {(funcionarios ?? []).map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Período: {fmtDate(de)} — {fmtDate(ate)}{isFetching ? " · a atualizar…" : ""}
      </p>

      {/* KPIs */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total de tarefas" value={String(global.total)} hint={`${global.concluidas} concluídas`} />
        <Kpi label="Taxa de conclusão" value={`${global.concl.toFixed(0)}%`} hint={`${global.pendentes} pendentes · ${global.saltadas} saltadas`} tone={global.concl >= 80 ? "good" : global.concl >= 50 ? "warn" : "bad"} />
        <Kpi label="Eficiência (previsto/real)" value={global.realMin > 0 ? `${global.efic.toFixed(0)}%` : "—"} hint={`Real: ${fmtMin(global.realMin)} · Prev: ${fmtMin(global.previstoMin)}`} tone={global.efic >= 95 ? "good" : global.efic >= 75 ? "warn" : "bad"} />
        <Kpi label="Média por tarefa concluída" value={fmtMin(global.mediaReal)} hint={`${global.dentro.toFixed(0)}% dentro do tempo`} />
      </div>

      {/* Breakdown estados */}
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        <Pill color="bg-emerald-500" label="Concluídas" value={global.concluidas} />
        <Pill color="bg-blue-500" label="Em curso" value={global.emCurso} />
        <Pill color="bg-amber-500" label="Pendentes" value={global.pendentes} />
        <Pill color="bg-slate-400" label="Saltadas" value={global.saltadas} />
        <Pill color="bg-red-500" label="Fora do tempo" value={global.concluidas - (global.concluidas > 0 ? Math.round(global.dentro / 100 * global.concluidas) : 0)} />
      </div>

      {/* Tabela por funcionário */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-foreground">Por funcionário</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm" style={{ minWidth: 820 }}>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Funcionário</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Concluídas</th>
                <th className="px-3 py-2 text-right font-medium">Pendentes</th>
                <th className="px-3 py-2 text-right font-medium">Saltadas</th>
                <th className="px-3 py-2 text-right font-medium">Conclusão</th>
                <th className="px-3 py-2 text-right font-medium">Eficiência</th>
                <th className="px-3 py-2 text-right font-medium">Média/tarefa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from(stats.entries()).map(([fid, s]) => {
                const f = funcMap.get(fid);
                const concl = s.total > 0 ? (s.concluidas / s.total) * 100 : 0;
                const efic = s.realMin > 0 ? (s.previstoMin / s.realMin) * 100 : 0;
                const media = s.concluidas > 0 ? s.realMin / s.concluidas : 0;
                return (
                  <tr key={fid}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: f?.cor ?? "#64748b" }} />
                        <span className="font-medium text-foreground">{f?.nome ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">{s.total}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{s.concluidas}</td>
                    <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{s.pendentes + s.emCurso}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{s.saltadas}</td>
                    <td className="px-3 py-2 text-right text-foreground">{concl.toFixed(0)}%</td>
                    <td className={`px-3 py-2 text-right ${efic >= 95 ? "text-emerald-600 dark:text-emerald-400" : efic >= 75 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {s.realMin > 0 ? `${efic.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtMin(media)}</td>
                  </tr>
                );
              })}
              {stats.size === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Sem tarefas no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "warn" | "bad" }) {
  const toneCls =
    tone === "good" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "bad" ? "text-red-600 dark:text-red-400"
    : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Pill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="px-4 sm:px-6 py-6 sm:py-10 max-w-5xl w-full mx-auto">{children}</main>;
}
