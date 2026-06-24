import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pt from "./locales/pt.json";

// Apenas Português (PT-PT). Limpa qualquer preferência antiga.
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
    resources: {
      pt: { translation: pt },
    },
    lng: "pt",
    fallbackLng: "pt",
    supportedLngs: ["pt"],
    load: "languageOnly",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
    returnEmptyString: false,
  });
}

export default i18n;
