import { describe, expect, test } from "bun:test";
import {
  validarFicheiros,
  validarSubmissao,
  assinaturaValida,
  contaConfirmado,
} from "./central-regras.ts";
describe("Regras da Central", () => {
  test("máximo 10 ficheiros", () =>
    expect(() =>
      validarFicheiros(Array.from({ length: 11 }, () => ({ size: 1, type: "image/png" }))),
    ).toThrow());
  test("20 MB por ficheiro", () => {
    validarFicheiros([{ size: 20971520, type: "application/pdf" }]);
    expect(() => validarFicheiros([{ size: 20971521, type: "application/pdf" }])).toThrow();
  });
  test("áudio desativado", () =>
    expect(() => validarFicheiros([{ size: 100, type: "audio/mpeg" }])).toThrow());
  test("tipo declarado deve coincidir com conteúdo", () =>
    expect(assinaturaValida("application/pdf", new TextEncoder().encode("not-a-pdf"))).toBe(false));
  test("envolvidos opcionais e sem atribuição automática de culpa", () => {
    const d = validarSubmissao("criar", {
      titulo: "Erro de processo",
      descricao: "Descrição suficiente do problema",
      setor_destino_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(d.responsaveis).toBeUndefined();
    expect(d.envolvidos).toBeUndefined();
  });
  test("alegações não contam como erros confirmados", () =>
    expect(contaConfirmado({ erro_confirmado: false, apurado_em: null, estado: "pendente" })).toBe(
      false,
    ));
  test("confirmação exige apuração", () =>
    expect(contaConfirmado({ erro_confirmado: true, apurado_em: null, estado: "validado" })).toBe(
      false,
    ));
  test("não procede não conta como erro", () =>
    expect(
      contaConfirmado({ erro_confirmado: true, apurado_em: "2026-11-20", estado: "nao_procede" }),
    ).toBe(false));
  test("processo não atribui responsabilidade individual", () =>
    expect(() =>
      validarSubmissao("apurar", {
        id: "11111111-1111-4111-8111-111111111111",
        texto: "Conclusão fundamentada",
        evidencia: "Evidência suficiente",
        tipo_causa: "processo",
        responsaveis: ["11111111-1111-4111-8111-111111111111"],
      }),
    ).toThrow());
  test("correção exige resultado mínimo", () =>
    expect(() =>
      validarSubmissao("estado", {
        id: "11111111-1111-4111-8111-111111111111",
        texto: "Ação realizada com detalhe",
        estado: "corrigido",
        resultado: "curto",
      }),
    ).toThrow());
});
