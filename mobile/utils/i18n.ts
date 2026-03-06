/**
 * Returns the localised name: Georgian if lang='ka' and a Georgian name exists,
 * otherwise falls back to English.
 */
export function localName(nameEn: string, nameKa: string | null | undefined, lang: string): string {
  return lang === 'ka' && nameKa ? nameKa : nameEn;
}
