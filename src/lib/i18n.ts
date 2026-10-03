export type Language = "en" | "ar";

export const DEFAULT_LANGUAGE: Language = "en";

export function uiText(language: Language, english: string, arabic: string): string {
  return language === "ar" ? arabic : english;
}

export function appDisplayName(language: Language): string {
  return uiText(language, "M&A Admin", "إدارة M&A");
}

export function otherLanguageLabel(language: Language): string {
  return language === "ar" ? "English" : "العربية";
}

export function languageName(language: Language): string {
  return language === "ar" ? "العربية" : "English";
}
