export type Cadencia =
  | "semanal"
  | "quinzenal_a"
  | "quinzenal_b"
  | "mensal_1"
  | "mensal_2"
  | "mensal_3"
  | "mensal_4"
  | "mensal_ultima";

export const CADENCIAS: Cadencia[] = [
  "semanal",
  "quinzenal_a",
  "quinzenal_b",
  "mensal_1",
  "mensal_2",
  "mensal_3",
  "mensal_4",
  "mensal_ultima",
];

export function isCadencia(v: unknown): v is Cadencia {
  return typeof v === "string" && (CADENCIAS as string[]).includes(v);
}

export function normalizeCadencia(v: unknown): Cadencia {
  return isCadencia(v) ? v : "semanal";
}
