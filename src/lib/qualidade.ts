import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ESTADOS_REPORTE = [
  "pendente",
  "a_tratar",
  "corrigido",
  "validado",
  "nao_procede",
] as const;
export type EstadoReporte = (typeof ESTADOS_REPORTE)[number];

export const LABEL_ESTADO: Record<EstadoReporte, string> = {
  pendente: "Pendente",
  a_tratar: "A tratar",
  corrigido: "Corrigido",
  validado: "Validado",
  nao_procede: "Não procede",
};

export const CLASSE_ESTADO: Record<EstadoReporte, string> = {
  pendente: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
  a_tratar: "bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/30",
  corrigido: "bg-teal-500/12 text-teal-700 dark:text-teal-300 border-teal-500/30",
  validado: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  nao_procede: "bg-muted text-muted-foreground border-border",
};

export const GRAVIDADES = ["baixa", "media", "alta"] as const;
export type Gravidade = (typeof GRAVIDADES)[number];

export const LABEL_GRAVIDADE: Record<Gravidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const CLASSE_GRAVIDADE: Record<Gravidade, string> = {
  baixa: "bg-muted text-muted-foreground border-border",
  media: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
  alta: "bg-destructive/12 text-destructive border-destructive/30",
};

export const LABEL_PERIODICIDADE: Record<string, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
};

export const LABEL_ESTADO_EXEC: Record<string, string> = {
  pendente: "Por fazer",
  em_curso: "Em curso",
  concluida: "Concluída",
  em_falta: "Em falta",
};

/** Contador de prazo: verde acima de 8h, âmbar abaixo, vermelho em atraso. */
export type Prazo = {
  atrasado: boolean;
  texto: string;
  classe: string;
};

export function formatarPrazo(
  iso: string | null | undefined,
  agora: number = Date.now(),
): Prazo | null {
  if (!iso) return null;
  const alvo = new Date(iso).getTime();
  const diffMin = Math.round((alvo - agora) / 60000);
  const abs = Math.abs(diffMin);
  const dias = Math.floor(abs / 1440);
  const horas = Math.floor((abs % 1440) / 60);
  const min = abs % 60;
  const partes = dias > 0 ? `${dias}d ${horas}h` : horas > 0 ? `${horas}h ${min}m` : `${min}m`;
  if (diffMin < 0) {
    return { atrasado: true, texto: `${partes} em atraso`, classe: "text-destructive" };
  }
  if (diffMin < 8 * 60) {
    return { atrasado: false, texto: `faltam ${partes}`, classe: "text-amber-600 dark:text-amber-400" };
  }
  return { atrasado: false, texto: `faltam ${partes}`, classe: "text-emerald-600 dark:text-emerald-400" };
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** funcionarios.id do utilizador autenticado. */
export function useMeuFuncionario() {
  return useQuery({
    queryKey: ["qualidade", "meu-funcionario"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, papel, cor")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type Setor = { id: string; nome: string; cor: string | null; prefixo: string | null };

/** Setores do utilizador (via rc_meus_setores) com nome e cor. */
export function useMeusSetores() {
  return useQuery({
    queryKey: ["qualidade", "meus-setores"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Setor[]> => {
      const { data: ids, error } = await supabase.rpc("rc_meus_setores");
      if (error) throw error;
      const lista = (ids as unknown as string[] | null) ?? [];
      if (lista.length === 0) return [];
      const { data, error: e2 } = await supabase
        .from("funcoes")
        .select("id, nome, cor, prefixo")
        .in("id", lista)
        .order("nome");
      if (e2) throw e2;
      return data ?? [];
    },
  });
}

export function useSetores(apenasAtivos = true) {
  return useQuery({
    queryKey: ["qualidade", "setores", apenasAtivos],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Setor[]> => {
      let q = supabase.from("funcoes").select("id, nome, cor, prefixo").order("nome");
      if (apenasAtivos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEGestor() {
  return useQuery({
    queryKey: ["qualidade", "e-gestor"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rc_e_gestor");
      if (error) throw error;
      return !!data;
    },
  });
}

const BUCKET = "qualidade";

/** Carrega ficheiros para o bucket de qualidade e devolve URLs assinadas de longa duração. */
export async function uploadAnexos(files: File[], prefixo: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${prefixo}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data, error: e2 } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (e2) throw e2;
    urls.push(data.signedUrl);
  }
  return urls;
}

export function corSetor(cor: string | null | undefined): string {
  return cor && cor.trim() !== "" ? cor : "#64748B";
}
