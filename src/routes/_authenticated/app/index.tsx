import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuthUser } from "@/routes/_authenticated/route";

export const Route = createFileRoute("/_authenticated/app/")({
  component: HomePage,
});

type FuncionarioRow = {
  id: string;
  nome: string;
  papel: "gestor" | "funcionario";
  funcao: { nome: string } | null;
};

function HomePage() {
  const { t } = useTranslation();
  const user = useAuthUser();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["funcionario", user.id],
    queryFn: async (): Promise<FuncionarioRow | null> => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, papel, funcao:funcoes(nome)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as FuncionarioRow) ?? null;
    },
  });

  const { data: isGestor } = useQuery({
    queryKey: ["is-gestor", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "gestor").maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <p className="font-semibold text-foreground tracking-tight">{t("app.name")}</p>
          <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
        </div>
        <div className="flex items-center gap-4">
          {isGestor && (
            <nav className="flex items-center gap-3 text-sm">
              <Link to="/equipa" className="text-muted-foreground hover:text-foreground">
                {t("nav.equipa")}
              </Link>
              <Link to="/gerar" className="text-muted-foreground hover:text-foreground">
                {t("nav.gerar")}
              </Link>
            </nav>
          )}
          <LanguageSwitcher />
          <button
            onClick={handleSignOut}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            {t("common.signOut")}
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-10 max-w-2xl w-full mx-auto">
        {isLoading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : !data ? (
          <p className="text-muted-foreground">{t("home.unlinked")}</p>
        ) : (
          <div className="space-y-6">
            <h1 className="text-3xl font-semibold text-foreground">
              {t("home.hello", { name: data.nome })}
            </h1>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("home.yourRole")}
                </dt>
                <dd className="mt-1 text-lg font-medium text-foreground">
                  {t(`roles.${data.papel}`)}
                </dd>
              </div>
              {data.funcao?.nome && (
                <div className="rounded-lg border border-border p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("home.funcao")}
                  </dt>
                  <dd className="mt-1 text-lg font-medium text-foreground">{data.funcao.nome}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </main>
    </div>
  );
}
