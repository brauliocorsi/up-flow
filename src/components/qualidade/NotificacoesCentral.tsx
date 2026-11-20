import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMeuFuncionario } from "@/lib/qualidade";
import { Button } from "@/components/ui/button";
export function useNotificacoesCentral() {
  const me = useMeuFuncionario();
  return useQuery({
    queryKey: ["central", "notificacoes", me.data?.id],
    enabled: !!me.data,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reporte_notificacoes")
        .select("id,reporte_id,mensagem,criado_em")
        .is("lida_em", null)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
export function NotificacoesCentral() {
  const q = useNotificacoesCentral();
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`central-notices-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reporte_notificacoes" },
        () => qc.invalidateQueries({ queryKey: ["central", "notificacoes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  if (!q.data?.length) return null;
  return (
    <section aria-label="Notificações de reportes" className="border-y border-border py-3">
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4" />
          {q.data.length} avisos por ler
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            const { error } = await supabase.rpc("central_ler_notificacoes");
            if (!error) qc.invalidateQueries({ queryKey: ["central", "notificacoes"] });
          }}
        >
          Marcar como lidos
        </Button>
      </div>
      <ul className="mt-2 max-h-40 overflow-auto space-y-2">
        {q.data.map((n) => (
          <li key={n.id}>
            <Link
              to="/reportes/$id"
              params={{ id: n.reporte_id }}
              className="text-sm text-primary underline"
            >
              {n.mensagem}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
