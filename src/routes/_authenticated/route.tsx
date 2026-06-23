import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
      } else {
        setUser(data.user);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!user) return <PendingScreen />;
  return <AuthContext.Provider value={user}><Outlet /></AuthContext.Provider>;
}

import { createContext, useContext } from "react";
const AuthContext = createContext<User | null>(null);
export function useAuthUser(): User {
  const u = useContext(AuthContext);
  if (!u) throw new Error("useAuthUser must be used inside _authenticated");
  return u;
}

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});
