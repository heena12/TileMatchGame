import { isChapterStart } from '@config/chapters';

interface Nav {
  navigate(name: 'ChapterIntro', params: { levelId: number }): void;
  navigate(name: 'Game', params: { levelId: number; tutorial?: boolean }): void;
  replace(name: 'ChapterIntro', params: { levelId: number }): void;
  replace(name: 'Game', params: { levelId: number; tutorial?: boolean }): void;
}

/** Opens a level, going through the chapter intro first when a new chapter begins. */
export function startLevel(
  navigation: Nav,
  levelId: number,
  how: 'navigate' | 'replace' = 'navigate',
  params: { tutorial?: boolean } = {},
): void {
  const intro = isChapterStart(levelId) && params.tutorial !== true;
  if (intro) {
    navigation[how]('ChapterIntro', { levelId });
  } else {
    navigation[how]('Game', { levelId, ...params });
  }
}
