import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeusSetores, useMeuFuncionario, LABEL_PERIODICIDADE, LABEL_ESTADO_EXEC, corSetor } from "@/lib/qualidade";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/checklists/")({
  component: ChecklistsPage,
  head: () => ({
    meta: [
      { title: "Os meus checklists · UP Flow" },
      { name: "description", content: "Verificações periódicas do teu setor: por fazer, em curso, concluídas e em falta." },
      { property: "og:title", content: "Os meus checklists · UP Flow" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Verificações periódicas do teu setor: por fazer, em curso, concluídas e em falta." },
    ],
  }),
});


type Linha = {
  execucao_id: string;
  checklist: string | null;
  alvo: string | null;
  periodicidade: string | null;
  estado: string | null;
  data_referencia: string | null;
  itens_total: number | null;
  itens_respondidos: number | null;
  template_id: string | null;
  setor_id: string | null;
};

function haDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function ChecklistsPage() {
  useMeuFuncionario();
  const setoresQ = useMeusSetores();
  const setores = setoresQ.data ?? [];
  const [setorId, setSetorId] = useState<string>("");
  const setorAtivo = setorId || setores[0]?.id || "";

  const linhasQ = useQuery({
    queryKey: ["checklists-lista", setorAtivo],
    enabled: !!setorAtivo,
    queryFn: async (): Promise<Linha[]> => {
      const desde = haDias(14);
      const { data, error } = await supabase
        .from("vw_cumprimento_checklists")
        .select("*")
        .eq("setor_id", setorAtivo)
        .gte("data_referencia", desde)
        .order("data_referencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const templateIds = useMemo(
    () => Array.from(new Set((linhasQ.data ?? []).map((l) => l.template_id).filter(Boolean))) as string[],
    [linhasQ.data],
  );

  const horasQ = useQuery({
    queryKey: ["checklist-horas", templateIds],
    enabled: templateIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, hora_limite")
        .in("id", templateIds);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((t) => map.set(t.id, t.hora_limite));
      return map;
    },
  });

  const linhas = linhasQ.data ?? [];
  const grupos: Record<string, Linha[]> = {
    pendente: [],
    em_curso: [],
    concluida: [],
    em_falta: [],
  };
  linhas.forEach((l) => {
    const key = l.estado && grupos[l.estado] ? l.estado : "pendente";
    grupos[key].push(l);
  });

  const seccoes: { key: string; titulo: string }[] = [
    { key: "pendente", titulo: "Por fazer hoje" },
    { key: "em_curso", titulo: "Em curso" },
    { key: "concluida", titulo: "Concluídas" },
    { key: "em_falta", titulo: "Em falta" },
  ];

  return (
    <div className="px-4 py-6 max-w-xl mx-auto pb-24">
      <h1 className="text-2xl font-semibold text-foreground">Os meus checklists</h1>
      <p className="text-sm text-muted-foreground">Checklists dos últimos 14 dias.</p>

      {setores.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {setores.map((s) => (
            <button
              key={s.id}
              onClick={() => setSetorId(s.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                setorAtivo === s.id
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border bg-card text-foreground"
              }`}
              style={setorAtivo === s.id ? { borderColor: corSetor(s.cor) } : undefined}
            >
              {s.nome}
            </button>
          ))}
        </div>
      )}

      {setoresQ.isLoading && <p className="mt-6 text-sm text-muted-foreground">A carregar…</p>}
      {!setoresQ.isLoading && setores.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">Não estás associado a nenhum setor.</p>
      )}

      {setorAtivo && (
        <div className="mt-6 space-y-6">
          {linhasQ.isLoading && <p className="text-sm text-muted-foreground">A carregar checklists…</p>}
          {!linhasQ.isLoading && linhas.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem checklists nos últimos 14 dias.</p>
          )}
          {seccoes.map((sec) => {
            const lista = grupos[sec.key];
            if (lista.length === 0) return null;
            return (
              <section key={sec.key}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{sec.titulo}</h2>
                <div className="mt-2 space-y-2">
                  {lista.map((l) => {
                    const hora = l.template_id ? horasQ.data?.get(l.template_id) : undefined;
                    return (
                      <Link key={l.execucao_id} to="/checklists/$execucaoId" params={{ execucaoId: l.execucao_id! }}>
                        <Card className="p-4 active:scale-[0.99] transition hover:bg-accent/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{l.checklist ?? "Checklist"}</p>
                              {l.alvo && <p className="text-xs text-muted-foreground truncate">{l.alvo}</p>}
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{LABEL_PERIODICIDADE[l.periodicidade ?? ""] ?? l.periodicidade}</span>
                                <span>•</span>
                                <span>{l.itens_respondidos ?? 0}/{l.itens_total ?? 0} itens</span>
                                {hora && (
                                  <>
                                    <span>•</span>
                                    <span>até às {hora.slice(0, 5)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {LABEL_ESTADO_EXEC[l.estado ?? ""] ?? l.estado}
                            </Badge>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
