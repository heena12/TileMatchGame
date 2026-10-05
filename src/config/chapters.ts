import { APP_CONFIG } from './constants';

export const LEVELS_PER_CHAPTER = 4;

export interface Chapter {
  readonly name: string;
  readonly description: string;
  readonly glyph: string;
}

const CHAPTERS: readonly Chapter[] = [
  {
    name: 'Big Ben',
    glyph: '🕰️',
    description:
      'Big Ben is the great bell of the clock tower at Westminster, whose chimes have marked the hours of London for over a century and a half.',
  },
  {
    name: 'Eiffel Tower',
    glyph: '🗼',
    description:
      'The Eiffel Tower, an emblem of Paris, merges engineering marvel with romantic allure. With a total height of 330 meters, the tower is attractive, both for its daytime elegance and nocturnal luminescence.',
  },
  {
    name: 'Great Wall',
    glyph: '🏯',
    description:
      'The Great Wall of China winds across mountains and deserts for thousands of kilometres, a monument to patience and the will to protect.',
  },
  {
    name: 'Taj Mahal',
    glyph: '🕌',
    description:
      'The Taj Mahal, a white marble mausoleum in Agra, glows pink at dawn and gold at dusk, a tribute to love built over two decades.',
  },
  {
    name: 'Statue of Liberty',
    glyph: '🗽',
    description:
      'The Statue of Liberty has greeted travellers arriving in New York harbour since 1886, torch raised high above the water.',
  },
];

const chapterIndex = (levelId: number): number =>
  Math.floor((Math.max(levelId, 1) - 1) / LEVELS_PER_CHAPTER);

/** The chapter a level belongs to: four levels each, cycling through the list. */
export function chapterFor(levelId: number): Chapter {
  return CHAPTERS[chapterIndex(levelId) % CHAPTERS.length] as Chapter;
}

/** "5-8" for level 5, 6, 7 or 8. */
export function chapterRange(levelId: number): string {
  const first = chapterIndex(levelId) * LEVELS_PER_CHAPTER + 1;
  return `${first}-${first + LEVELS_PER_CHAPTER - 1}`;
}

/** The intro shows before the first level of a chapter, once the tutorial is over. */
export function isChapterStart(levelId: number): boolean {
  return (
    levelId > APP_CONFIG.tutorialLevels &&
    (levelId - 1) % LEVELS_PER_CHAPTER === 0
  );
}
