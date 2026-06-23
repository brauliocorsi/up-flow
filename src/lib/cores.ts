// Paleta fixa de cores distintas, sincronizada com a função SQL proxima_cor_funcionario().
export const CORES_FUNCIONARIO: { value: string; label: string }[] = [
  { value: "#1D9E75", label: "Teal" },
  { value: "#2563EB", label: "Azul" },
  { value: "#EF4444", label: "Coral" },
  { value: "#7C3AED", label: "Roxo" },
  { value: "#F59E0B", label: "Âmbar" },
  { value: "#16A34A", label: "Verde" },
  { value: "#EC4899", label: "Rosa" },
  { value: "#6366F1", label: "Índigo" },
  { value: "#F97316", label: "Laranja" },
  { value: "#475569", label: "Cinza" },
];

export const COR_FALLBACK = "#64748B";

export function corFuncionario(cor: string | null | undefined): string {
  return cor && cor.trim() !== "" ? cor : COR_FALLBACK;
}
