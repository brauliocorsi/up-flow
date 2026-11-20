import { z } from "zod";

export const MAX_FICHEIROS = 10;
export const MAX_TAMANHO = 20 * 1024 * 1024;
export const MIME_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export const FASES = [
  "abertura",
  "resposta",
  "comentario",
  "correcao",
  "validacao",
  "apuracao",
  "atribuicao",
] as const;
export type Fase = (typeof FASES)[number];
export function validarFicheiros(files: { size: number; type: string }[]) {
  if (files.length > MAX_FICHEIROS) throw new Error("Máximo 10 ficheiros por submissão.");
  for (const f of files) {
    if (!MIME_PERMITIDOS.some((m) => m === f.type))
      throw new Error(
        "Aceitamos apenas JPG, PNG, WebP e PDF; áudio e vídeo não estão habilitados.",
      );
    if (f.size < 1 || f.size > MAX_TAMANHO)
      throw new Error("Cada ficheiro deve ter entre 1 byte e 20 MB.");
  }
}
export function assinaturaValida(mime: string, b: Uint8Array) {
  if (mime === "image/jpeg") return b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (mime === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v);
  if (mime === "application/pdf") return new TextDecoder().decode(b.slice(0, 5)) === "%PDF-";
  if (mime === "image/webp")
    return (
      new TextDecoder().decode(b.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(b.slice(8, 12)) === "WEBP"
    );
  return false;
}
const optionalText = (max: number) => z.string().max(max).optional();
const date = z
  .string()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "Data inválida")
  .optional();
const uuidOrEmpty = z.union([z.string().uuid(), z.literal("")]).optional();
export const dadosSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: optionalText(200),
  descricao: optionalText(10000),
  setor_origem_id: uuidOrEmpty,
  setor_destino_id: uuidOrEmpty,
  gravidade: z.enum(["baixa", "media", "alta"]).optional(),
  ocorrido_em: date,
  detetado_em: date,
  prazo: date,
  causa_alegada: optionalText(2000),
  referencia_tipo: z.enum(["", "venda", "os", "rota", "op", "outro"]).optional(),
  referencia_externa: optionalText(200),
  up_care_referencia: optionalText(200),
  envolvidos: z.array(z.string().uuid()).max(50).optional(),
  responsaveis: z.array(z.string().uuid()).max(50).optional(),
  texto: optionalText(10000),
  resultado: optionalText(10000),
  evidencia: optionalText(10000),
  resposta: z.enum(["reconheco", "contesto", "esclarecimentos"]).optional(),
  assumido_por: uuidOrEmpty,
  data_prevista: date,
  tipo_causa: z.enum(["pessoa", "processo", "sistema", "fornecedor", "desconhecida"]).optional(),
  confirmado: z.boolean().optional(),
  estado: z.enum(["pendente", "a_tratar", "corrigido", "validado", "nao_procede"]).optional(),
});
export type DadosCentral = z.infer<typeof dadosSchema>;
export function validarSubmissao(acao: string, raw: unknown) {
  const d = dadosSchema.parse(raw);
  if (acao === "criar") {
    if (
      (d.titulo?.trim().length ?? 0) < 5 ||
      (d.descricao?.trim().length ?? 0) < 15 ||
      !d.setor_destino_id
    )
      throw new Error("Indica setor destino, título (5 caracteres) e descrição (15 caracteres).");
  } else if (!d.id || (d.texto?.trim().length ?? 0) < 15)
    throw new Error("Escreve pelo menos 15 caracteres.");
  if (acao === "estado" && d.estado === "corrigido" && (d.resultado?.trim().length ?? 0) < 15)
    throw new Error("Descreve o resultado da correção (mínimo 15 caracteres).");
  if (acao === "apurar") {
    if ((d.evidencia?.trim().length ?? 0) < 15)
      throw new Error("Fundamenta a evidência da apuração (mínimo 15 caracteres).");
    if (d.tipo_causa !== "pessoa" && (d.responsaveis?.length ?? 0) > 0)
      throw new Error("Causas não individuais não atribuem responsabilidade a pessoas.");
  }
  return d;
}
export function contaConfirmado(r: {
  erro_confirmado: boolean;
  apurado_em: string | null;
  estado: string;
}) {
  return r.erro_confirmado && r.apurado_em !== null && r.estado !== "nao_procede";
}
