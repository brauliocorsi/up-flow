import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/routes/_authenticated/route";

export const Route = createFileRoute("/_authenticated/gerar/")({
  component: GerarPage,
});

type Funcionario = { id: string; nome: string };
type ResultRow = { funcionario_id: string; nome: string; data: string; tarefas: number; erro?: string };

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

function GerarPage() {
  const { t } = useTranslation();
  const user = useAuthUser();
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [dias, setDias] = useState<number>(7);

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
    queryKey: ["funcionarios-ativos"],
    queryFn: async (): Promise<Funcionario[]> => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!funcionarios) return [];
      const base = todayISO();
      const n = Math.max(1, Math.min(60, Math.floor(dias)));
      const datas = Array.from({ length: n }, (_, i) => addDaysISO(base, i));
      const out: ResultRow[] = [];
      for (const f of funcionarios) {
        for (const data of datas) {
          const { data: rows, error } = await supabase.rpc("gerar_tarefas_do_dia", {
            _funcionario_id: f.id,
            _data: data,
          });
          if (error) {
            out.push({ funcionario_id: f.id, nome: f.nome, data, tarefas: 0, erro: error.message });
          } else {
            out.push({ funcionario_id: f.id, nome: f.nome, data, tarefas: (rows ?? []).length });
          }
        }
      }
      return out;
    },
    onSuccess: (r) => setResults(r),
  });

  if (loadingRole) {
    return <Shell><p className="text-muted-foreground">{t("common.loading")}</p></Shell>;
  }
  if (!isGestor) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t("gerar.forbidden")}</p>
      </Shell>
    );
  }

  const totalTarefas = results?.reduce((s, r) => s + r.tarefas, 0) ?? 0;
  const totalDias = results ? new Set(results.map((r) => r.data)).size : 0;

  return (
    <Shell>
      <h1 className="text-3xl font-semibold text-foreground">{t("gerar.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("gerar.subtitle", { date: todayISO() })}
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-4 space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">{t("gerar.diasLabel")}</span>
          <input
            type="number"
            min={1}
            max={60}
            value={dias}
            onChange={(e) => setDias(Number(e.target.value) || 1)}
            className="w-32 rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <p className="text-xs text-muted-foreground">{t("gerar.diasHint")}</p>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !funcionarios?.length}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? t("gerar.running") : t("gerar.actionRange", { days: dias })}
        </button>
      </div>

      {funcionarios && funcionarios.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">{t("gerar.noFuncionarios")}</p>
      )}

      {results && (
        <div className="mt-8 space-y-2">
          <h2 className="text-lg font-medium text-foreground">{t("gerar.results")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("gerar.totalGerado", { count: totalTarefas, dias: totalDias })}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("gerar.colFuncionario")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("gerar.colData")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("gerar.colTarefas")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r, i) => (
                  <tr key={`${r.funcionario_id}-${r.data}-${i}`}>
                    <td className="px-3 py-2 text-foreground">{r.nome}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.data}</td>
                    <td className="px-3 py-2 text-right">
                      {r.erro ? (
                        <span className="text-xs text-destructive">{r.erro}</span>
                      ) : (
                        <span className="text-foreground">
                          {t("gerar.tarefasCount", { count: r.tarefas })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="px-4 sm:px-6 py-6 sm:py-10 max-w-3xl w-full mx-auto">{children}</main>
  );
}
