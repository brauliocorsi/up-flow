import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { submeterCentral } from "./central.functions";
import { validarFicheiros, validarSubmissao, type DadosCentral, type Fase } from "./central-regras";
export type PessoaCentral = { id: string; nome: string };
export type ReporteCentral = {
  id: string;
  numero: string | null;
  titulo: string;
  descricao: string;
  estado: string;
  gravidade: string;
  criado_em: string;
  ocorrido_em: string | null;
  detetado_em: string | null;
  causa_alegada: string | null;
  referencia_tipo: string | null;
  referencia_externa: string | null;
  up_care_referencia: string | null;
  setor_origem_id: string | null;
  setor_destino_id: string;
  reportado_por: string;
  assumido_por: string | null;
  prazo_resposta: string | null;
  prazo_resolucao: string | null;
  respondido_em: string | null;
  contestado_em: string | null;
  origem: string | null;
  destino: string;
  criador: string;
  executor: string | null;
  envolvidos: PessoaCentral[];
  tipo_causa: string;
  conclusao: string | null;
  evidencia_apuracao: string | null;
  erro_confirmado: boolean;
  apurado_em: string | null;
  apurado_por: string | null;
  responsaveis_apurados: string[];
  corrigido_por: string | null;
  validado_por: string | null;
  correcao_resultado: string | null;
  validacao_evidencia: string | null;
};
export function useCentralLista() {
  return useQuery({
    queryKey: ["reportes", "central"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("central_lista");
      if (error) throw error;
      return data as unknown as ReporteCentral[];
    },
  });
}
export function useCentralPessoas() {
  return useQuery({
    queryKey: ["central", "pessoas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("central_diretorio");
      if (error) throw error;
      return data as unknown as PessoaCentral[];
    },
  });
}
export async function enviarCentral(acao: string, fase: Fase, dados: DadosCentral, files: File[]) {
  validarSubmissao(acao, dados);
  validarFicheiros(files);
  const form = new FormData();
  form.set("acao", acao);
  form.set("fase", fase);
  form.set("dados", JSON.stringify(dados));
  files.forEach((f) => form.append("ficheiros", f));
  return submeterCentral({ data: form });
}
