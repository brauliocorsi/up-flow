import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError(t("auth.fillFields"));
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(t("auth.errorGeneric"));
      return;
    }
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="font-semibold text-foreground tracking-tight">{t("app.name")}</span>
        <LanguageSwitcher />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-foreground">{t("auth.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                {t("auth.email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                {t("auth.password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
