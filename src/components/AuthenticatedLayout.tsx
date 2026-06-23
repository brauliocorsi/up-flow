import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Menu, LogOut, LayoutDashboard, Users, ListChecks, CalendarPlus, ClipboardList, HelpCircle, MessageCircleQuestion, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuthUser } from "@/routes/_authenticated/auth-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof Menu; badge?: number };

const APP_NAME = "UP Móveis";

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const tf = (key: string, defaultValue: string) => t(key, { defaultValue });
  const user = useAuthUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: isGestor } = useQuery({
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

  // Unread questions count (gestor only) — abertas/respondidas com mensagens do operador por ler
  const unreadQ = useQuery({
    enabled: !!isGestor,
    queryKey: ["questoes-unread-gestor"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("questao_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("autor_papel", "operador")
        .eq("lida_pelo_gestor", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!isGestor) return;
    const ch = supabase
      .channel("layout-questoes-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "questao_mensagens" },
        () => qc.invalidateQueries({ queryKey: ["questoes-unread-gestor"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "questoes" },
        () => qc.invalidateQueries({ queryKey: ["questoes-unread-gestor"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isGestor, qc]);

  const unread = unreadQ.data ?? 0;

  const items: Item[] = isGestor
    ? [
        { to: "/painel", label: tf("nav.painel", "Painel"), icon: LayoutDashboard },
        { to: "/equipa", label: tf("nav.equipa", "Equipa"), icon: Users },
        { to: "/atividades", label: tf("nav.atividades", "Atividades"), icon: ListChecks },
        { to: "/questoes", label: tf("nav.questoes", "Questões"), icon: MessageCircleQuestion, badge: unread },
        { to: "/ajuda", label: tf("nav.ajuda", "Ajuda"), icon: HelpCircle },
        { to: "/gerar", label: tf("nav.gerar", "Gerar tarefas"), icon: CalendarPlus },
      ]
    : [
        { to: "/hoje", label: tf("nav.hoje", "A minha rotina"), icon: ClipboardList },
        { to: "/ajuda", label: tf("nav.ajuda", "Ajuda"), icon: HelpCircle },
      ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/95 backdrop-blur px-3 sm:px-4 h-14">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label={tf("nav.openMenu", "Abrir menu")}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to={isGestor ? "/painel" : "/hoje"} className="font-semibold tracking-tight truncate">
            {APP_NAME}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {isGestor && (
            <Link
              to="/questoes"
              className="relative inline-flex items-center justify-center rounded-md border border-input bg-background h-9 w-9 hover:bg-accent"
              aria-label={t("nav.questoes")}
              title={t("nav.questoes")}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </Link>
          )}
          <LanguageSwitcher />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.signOut")}</span>
          </Button>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-5 py-4 border-b border-border text-left">
            <SheetTitle>{t("app.name")}</SheetTitle>
            <SheetDescription>{t("app.tagline")}</SheetDescription>
          </SheetHeader>
          <nav className="p-2 flex flex-col gap-1">
            {items.map((it) => {
              const active = pathname === it.to || pathname.startsWith(it.to + "/");
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{it.label}</span>
                  {it.badge && it.badge > 0 ? (
                    <span className="inline-flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {it.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <main className="flex-1">{children}</main>
    </div>
  );
}
