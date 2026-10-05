/** Languages the game can be shown in, each named in its own language. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'gu', name: 'ગુજરાતી' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some(language => language.code === value);
}

/** The name of a language in that language, for the Settings list. */
export function languageName(code: LanguageCode): string {
  return LANGUAGES.find(language => language.code === code)?.name ?? 'English';
}
