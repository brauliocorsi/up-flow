import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language ?? "pt";

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{t("common.language")}</span>
      <select
        aria-label={t("common.language")}
        value={current.startsWith("en") ? "en" : "pt"}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      >
        <option value="pt">PT</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
