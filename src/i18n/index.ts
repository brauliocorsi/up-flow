import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pt from "./locales/pt.json";

// App monolingue: apenas Português (PT-PT). Limpa qualquer preferência antiga.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("up-moveis-lang");
    window.localStorage.removeItem("i18nextLng");
  } catch {
    /* ignore */
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    initAsync: false,
    resources: {
      pt: { translation: pt },
    },
    lng: "pt",
    fallbackLng: "pt",
    supportedLngs: ["pt"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
    returnEmptyString: false,
    // Em vez de mostrar a chave técnica (ex.: "hoje.eventos.urgente"),
    // mostra um espaço vazio. Mantém a UI limpa mesmo se faltar tradução.
    parseMissingKeyHandler: (key) => {
      if (import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[i18n] missing key:", key);
      }
      // Devolve apenas o último segmento legível (ex.: "urgente") em vez da chave inteira.
      const last = key.split(".").pop() ?? "";
      // Capitaliza para parecer um label decente.
      return last
        ? last.charAt(0).toUpperCase() + last.slice(1).replace(/_/g, " ")
        : "";
    },
    saveMissing: false,
  });
}

export default i18n;
