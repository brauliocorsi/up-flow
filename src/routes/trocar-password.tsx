import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/trocar-password")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: TrocarPasswordPage,
});

function TrocarPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw1.length < 8) {
      setError(t("trocar.tooShort"));
      return;
    }
    if (pw1 !== pw2) {
      setError(t("trocar.mismatch"));
      return;
    }
    setLoading(true);
    const { error: upErr } = await supabase.auth.updateUser({
      password: pw1,
      data: { must_change_password: false },
    });
    setLoading(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="font-semibold text-foreground tracking-tight">{t("app.name")}</span>
        <LanguageSwitcher />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-foreground">{t("trocar.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("trocar.subtitle")}</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">{t("trocar.newPassword")}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{t("trocar.confirmPassword")}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? t("common.saving") : t("trocar.submit")}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
