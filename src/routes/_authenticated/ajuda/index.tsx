import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/routes/_authenticated/auth-context";
import { MacrosSection } from "@/components/MacrosSection";

export const Route = createFileRoute("/_authenticated/ajuda/")({
  component: AjudaPage,
});

type Funcao = { id: string; nome: string };

function AjudaPage() {
  const { t } = useTranslation();
  const user = useAuthUser();

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

  const { data: funcoes = [] } = useQuery({
    queryKey: ["funcoes"],
    queryFn: async (): Promise<Funcao[]> => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Funcionario's own sectors (for operator filtering)
  const { data: meusSetores = [] } = useQuery({
    enabled: !isGestor,
    queryKey: ["meus-setores", user.id],
    queryFn: async (): Promise<string[]> => {
      const { data: fun, error: e1 } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (e1) throw e1;
      if (!fun) return [];
      const { data: rows, error } = await supabase
        .from("funcionario_setores")
        .select("funcao_id")
        .eq("funcionario_id", fun.id);
      if (error) throw error;
      return (rows ?? []).map((r: { funcao_id: string }) => r.funcao_id);
    },
  });

  // For viewing: load all activities + macros tied to activities (read-only) for everyone
  const { data: atividades = [] } = useQuery({
    queryKey: ["atividades-with-macros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades")
        .select("id, nome, funcao_id, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: macrosCtx = [] } = useQuery({
    queryKey: ["macros-contextuais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("macros")
        .select("id, titulo, conteudo, atividade_id, ordem, ativo")
        .eq("ativo", true)
        .not("atividade_id", "is", null)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const macrosPorAtividade = useMemo(() => {
    const m = new Map<string, typeof macrosCtx>();
    macrosCtx.forEach((mac) => {
      if (!mac.atividade_id) return;
      const list = m.get(mac.atividade_id) ?? [];
      list.push(mac);
      m.set(mac.atividade_id, list);
    });
    return m;
  }, [macrosCtx]);

  const setorFilter: string[] | null = isGestor ? null : meusSetores;
  const atividadesVisiveis = isGestor
    ? atividades
    : atividades.filter((a) => meusSetores.includes(a.funcao_id));
  const funcoesById = new Map(funcoes.map((f) => [f.id, f.nome]));

  return (
    <div className="px-4 sm:px-6 py-6 max-w-3xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("ajuda.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("ajuda.subtitle")}</p>
        </div>
        <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">
          {t("common.back")}
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">{t("ajuda.gerais")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("ajuda.geraisHint")}</p>
        <div className="mt-3">
          <MacrosSection
            canManage={!!isGestor}
            scope={{ kind: "geral", funcoes, funcaoFilterIds: setorFilter }}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">{t("ajuda.porAtividade")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("ajuda.porAtividadeHint")}</p>
        <div className="mt-3 space-y-4">
          {atividadesVisiveis.map((a) => {
            const list = macrosPorAtividade.get(a.id) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{a.nome}</h3>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {funcoesById.get(a.funcao_id) ?? "—"}
                  </span>
                </div>
                <ul className="mt-2 space-y-2">
                  {list.map((m) => (
                    <li key={m.id} className="rounded-md border border-border bg-background p-2">
                      <p className="text-sm font-medium text-foreground">{m.titulo}</p>
                      {m.conteudo && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                          {m.conteudo}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {atividadesVisiveis.every((a) => (macrosPorAtividade.get(a.id) ?? []).length === 0) && (
            <p className="text-xs text-muted-foreground">{t("ajuda.semContexto")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
