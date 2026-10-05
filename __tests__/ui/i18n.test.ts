import { LANGUAGES, isLanguageCode, languageName } from '@config/languages';
import type { LanguageCode } from '@config/languages';
import {
  ENGLISH,
  STRING_KEYS,
  getLanguage,
  setLanguage,
  t,
  translationsFor,
} from '@ui/i18n/strings';

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

/** Keys that are the same in every language on purpose (names, not sentences). */
const SAME_EVERYWHERE = new Set(['splash.studio', 'splash.studioSub']);

afterEach(() => setLanguage('en'));

describe('languages', () => {
  it('lists English, Hindi, Gujarati, Spanish and French, each named in itself', () => {
    expect(LANGUAGES.map(l => l.code)).toEqual(['en', 'hi', 'gu', 'es', 'fr']);
    expect(languageName('hi')).toBe('हिन्दी');
    expect(languageName('gu')).toBe('ગુજરાતી');
    expect(isLanguageCode('es')).toBe(true);
    expect(isLanguageCode('xx')).toBe(false);
  });

  it('answers in the chosen language and falls back to English', () => {
    expect(t('home.play')).toBe('Play');
    setLanguage('hi');
    expect(getLanguage()).toBe('hi');
    expect(t('home.play')).toBe('खेलें');
    setLanguage('es');
    expect(t('settings.title')).toBe('Ajustes');
    // A code that does not exist changes nothing.
    setLanguage('zz');
    expect(getLanguage()).toBe('es');
  });

  it('fills in {placeholders} in every language', () => {
    setLanguage('fr');
    expect(t('map.levelStars', { level: 3, stars: 2 })).toBe(
      'Niveau 3, 2 étoiles sur 3',
    );
    setLanguage('gu');
    expect(t('home.continue', { level: 7 })).toBe('લેવલ 7');
  });
});

describe.each(LANGUAGES.filter(l => l.code !== 'en').map(l => l.code))(
  'the %s translation',
  (code: LanguageCode) => {
    const translation = translationsFor(code) as Record<string, string>;

    it('only has keys that exist in English', () => {
      for (const key of Object.keys(translation)) {
        expect(STRING_KEYS).toContain(key);
      }
    });

    it('translates every sentence the player can see', () => {
      const missing = STRING_KEYS.filter(
        key => !SAME_EVERYWHERE.has(key) && translation[key] === undefined,
      );
      // The app name is the only other line allowed to stay in English.
      expect(missing.filter(key => key !== 'app.title')).toEqual([]);
    });

    it('keeps the same {placeholders} as English, so nothing is lost', () => {
      for (const [key, text] of Object.entries(translation)) {
        const english = ENGLISH[key as keyof typeof ENGLISH];
        expect(placeholders(text)).toEqual(placeholders(english));
      }
    });

    it('is not just the English text again', () => {
      const same = Object.entries(translation).filter(
        ([key, text]) => text === ENGLISH[key as keyof typeof ENGLISH],
      );
      // A handful (a level range such as "Level 1-4", "No") legitimately match.
      expect(same.length).toBeLessThan(8);
    });
  },
);
