import type { LanguageCode } from '@config/languages';
import { useSettings } from '@state/StoresContext';
import { setLanguage } from './strings';

/**
 * Call this in a component that shows text. It re-renders the component when
 * the player changes language in Settings, so `t()` is read again. (`t()` itself
 * is a plain function and cannot tell React that the language changed.)
 */
export function useLanguage(): LanguageCode {
  const language = useSettings(s => s.language);
  // Harmless when repeated: makes sure the first render already uses it.
  setLanguage(language);
  return language;
}
