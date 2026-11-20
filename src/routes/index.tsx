import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{"title": "Início · UP Flow"}, {"name": "description", "content": "Acesso às rotinas e qualidade da UP Móveis."}, {"property": "og:title", "content": "Início · UP Flow"}, {"property": "og:description", "content": "Acesso às rotinas e qualidade da UP Móveis."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        navigate({ to: "/app", replace: true });
      } else {
        navigate({ to: "/auth", replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">…</p>
    </div>
  );
}
