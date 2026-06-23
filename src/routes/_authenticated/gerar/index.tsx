import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuthUser } from "@/routes/_authenticated/route";

export const Route = createFileRoute("/_authenticated/gerar/")({
  component: GerarPage,
});

type Funcionario = { id: string; nome: string };
type ResultRow = { funcionario_id: string; nome: string; tarefas: number; erro?: string };

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function GerarPage() {
  const { t } = useTranslation();
  const user = useAuthUser();
  const [results, setResults] = useState<ResultRow[] | null>(null);

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
      const data = todayISO();
      const out: ResultRow[] = [];
      for (const f of funcionarios) {
        const { data: rows, error } = await supabase.rpc("gerar_tarefas_do_dia", {
          _funcionario_id: f.id,
          _data: data,
        });
        if (error) {
          out.push({ funcionario_id: f.id, nome: f.nome, tarefas: 0, erro: error.message });
        } else {
          out.push({ funcionario_id: f.id, nome: f.nome, tarefas: (rows ?? []).length });
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
        <Link to="/app" className="text-sm text-primary underline mt-2 inline-block">
          {t("gerar.backHome")}
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl font-semibold text-foreground">{t("gerar.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("gerar.subtitle", { date: todayISO() })}
      </p>

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !funcionarios?.length}
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {mutation.isPending ? t("gerar.running") : t("gerar.action")}
      </button>

      {funcionarios && funcionarios.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">{t("gerar.noFuncionarios")}</p>
      )}

      {results && (
        <div className="mt-8 space-y-2">
          <h2 className="text-lg font-medium text-foreground">{t("gerar.results")}</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.map((r) => (
              <li key={r.funcionario_id} className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-foreground">{r.nome}</span>
                {r.erro ? (
                  <span className="text-xs text-destructive">{r.erro}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("gerar.tarefasCount", { count: r.tarefas })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <p className="font-semibold text-foreground tracking-tight">{t("app.name")}</p>
          <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">
            {t("gerar.backHome")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-1 px-6 py-10 max-w-2xl w-full mx-auto">{children}</main>
    </div>
  );
}
