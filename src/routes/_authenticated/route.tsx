import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthUserContext, useAuthUser } from "./auth-context";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";

export { useAuthUser };

function PendingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">…</p>
    </div>
  );
}

function AuthGate() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      if (data.user.user_metadata?.must_change_password === true) {
        navigate({ to: "/trocar-password", replace: true });
        return;
      }
      setUser(data.user);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!user) return <PendingScreen />;
  return (
    <AuthUserContext.Provider value={user}>
      <AuthenticatedLayout>
        <Outlet />
      </AuthenticatedLayout>
    </AuthUserContext.Provider>
  );
}

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});
