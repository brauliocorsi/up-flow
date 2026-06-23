import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export const AuthUserContext = createContext<User | null>(null);

export function useAuthUser(): User {
  const u = useContext(AuthUserContext);
  if (!u) throw new Error("useAuthUser must be used inside _authenticated");
  return u;
}
