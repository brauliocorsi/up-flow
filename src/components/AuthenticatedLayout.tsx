import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Menu,
  LogOut,
  LayoutDashboard,
  Users,
  ListChecks,
  CalendarPlus,
  ClipboardList,
  HelpCircle,
  MessageCircleQuestion,
  Bell,
  LayoutGrid,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { useAuthUser } from "@/routes/_authenticated/auth-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof Menu; badge?: number };
type Section = { label: string; items: Item[] };

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

  const sections: Section[] = isGestor
    ? [
        {
          label: tf("nav.sectionGestao", "Gestão"),
          items: [
            { to: "/painel", label: tf("nav.painel", "Painel"), icon: LayoutDashboard },
            { to: "/equipa", label: tf("nav.equipa", "Equipa"), icon: Users },
            { to: "/atividades", label: tf("nav.atividades", "Atividades"), icon: ListChecks },
            { to: "/construtor", label: tf("nav.construtor", "Construtor"), icon: LayoutGrid },
            { to: "/questoes", label: tf("nav.questoes", "Questões"), icon: MessageCircleQuestion, badge: unread },
            { to: "/ajuda", label: tf("nav.ajuda", "Ajuda"), icon: HelpCircle },
            { to: "/gerar", label: tf("nav.gerar", "Gerar tarefas"), icon: CalendarPlus },
          ],
        },
        {
          label: tf("nav.sectionOperador", "Operador"),
          items: [
            { to: "/hoje", label: tf("nav.hoje", "A minha rotina"), icon: ClipboardList },
          ],
        },
      ]
    : [
        {
          label: tf("nav.section", "Navegação"),
          items: [
            { to: "/hoje", label: tf("nav.hoje", "A minha rotina"), icon: ClipboardList },
            { to: "/ajuda", label: tf("nav.ajuda", "Ajuda"), icon: HelpCircle },
          ],
        },
      ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label={tf("nav.openMenu", "Abrir menu")}
              onClick={() => setOpen(true)}
              className="rounded-full"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link
              to={isGestor ? "/painel" : "/hoje"}
              className="group flex items-center gap-2.5 min-w-0"
            >
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-background font-display font-bold text-sm tracking-tight transition-transform group-hover:scale-105"
              >
                UP
              </span>
              <span className="flex flex-col leading-none truncate">
                <span className="font-display text-[15px] font-semibold tracking-tight text-foreground truncate">
                  {APP_NAME}
                </span>
                <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">
                  {tf("app.tagline", "Rotina diária")}
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {isGestor && (
              <Link
                to="/questoes"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground focus-ring"
                aria-label={tf("nav.questoes", "Questões")}
                title={tf("nav.questoes", "Questões")}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground ring-2 ring-background">
                    {unread}
                  </span>
                )}
              </Link>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 rounded-full"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{tf("common.signOut", "Sair")}</span>
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-80 p-0 border-r border-border">
          <SheetHeader className="border-b border-border px-6 py-5 text-left">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-md bg-foreground text-background font-display font-bold text-sm tracking-tight"
              >
                UP
              </span>
              <div className="flex flex-col">
                <SheetTitle className="font-display text-base font-semibold tracking-tight">
                  {APP_NAME}
                </SheetTitle>
                <SheetDescription className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {tf("app.tagline", "Rotina diária")}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <nav className="p-3 flex flex-col gap-0.5">
            <span className="px-3 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {tf("nav.section", "Navegação")}
            </span>
            {items.map((it) => {
              const active = pathname === it.to || pathname.startsWith(it.to + "/");
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.badge && it.badge > 0 ? (
                    <span className={cn(
                      "inline-flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full text-[10px] font-semibold",
                      active ? "bg-background text-foreground" : "bg-destructive text-destructive-foreground",
                    )}>
                      {it.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-border px-5 py-4 text-[11px] text-muted-foreground">
            <p className="truncate">{user.email}</p>
            <p className="mt-1 uppercase tracking-[0.18em] text-[10px]">{isGestor ? tf("roles.gestor", "Gestor") : tf("roles.funcionario", "Operador")}</p>
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 page-enter">{children}</main>
    </div>
  );
}
