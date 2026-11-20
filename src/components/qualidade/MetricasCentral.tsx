import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
type Metrica = {
  setor: string;
  tipo_causa: string;
  mes: string;
  confirmados: number;
  pendentes: number;
  contestados: number;
  volume_atividades: number;
};
export function MetricasCentral() {
  const [mes, setMes] = useState("");
  const q = useQuery({
    queryKey: ["reportes", "metricas-central"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("central_metricas");
      if (error) throw error;
      return data as unknown as Metrica[];
    },
  });
  const rows = (q.data ?? []).filter((r) => !mes || r.mes.startsWith(mes));
  return (
    <section className="space-y-4 py-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Erros apurados · setores e tendências
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Volume de atividades da rotina, não volume de vendas/OS; sem ranking de pessoas.
          </p>
        </div>
        <label className="text-sm">
          Mês
          <Input
            aria-label="Mês dos erros apurados"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
      </div>
      {q.isPending ? (
        <p>A carregar…</p>
      ) : q.isError ? (
        <p role="alert" className="text-destructive">
          {q.error.message}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {[
                  "Mês",
                  "Setor",
                  "Causa",
                  "Confirmados",
                  "Pendentes",
                  "Contestados",
                  "Atividades",
                  "Erros / 100 atividades",
                ].map((h) => (
                  <th key={h} className="p-2 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="p-2">{r.mes.slice(0, 7)}</td>
                  <td className="p-2">{r.setor}</td>
                  <td className="p-2">{r.tipo_causa}</td>
                  <td className="p-2 text-success">{r.confirmados}</td>
                  <td className="p-2">{r.pendentes}</td>
                  <td className="p-2">{r.contestados}</td>
                  <td className="p-2">{r.volume_atividades}</td>
                  <td className="p-2">
                    {r.volume_atividades
                      ? ((r.confirmados / r.volume_atividades) * 100).toFixed(1)
                      : "Sem volume"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="py-8 text-center text-muted-foreground">
              Sem dados de apuração neste período.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
