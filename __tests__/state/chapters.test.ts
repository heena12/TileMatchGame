import {
  chapterFor,
  chapterRange,
  isChapterStart,
} from '../../src/config/chapters';

describe('chapters', () => {
  it('groups levels four at a time, as "5-8"', () => {
    expect(chapterRange(5)).toBe('5-8');
    expect(chapterRange(8)).toBe('5-8');
    expect(chapterRange(9)).toBe('9-12');
  });

  it('makes level 5 the Eiffel Tower chapter', () => {
    expect(chapterFor(5).name).toBe('Eiffel Tower');
    expect(chapterFor(8).name).toBe('Eiffel Tower');
  });

  it('cycles through the list for later levels', () => {
    expect(chapterFor(1 + 4 * 500).name).toBeDefined();
  });

  it('shows the intro only at a chapter start after the tutorial', () => {
    expect(isChapterStart(5)).toBe(false);
    expect(isChapterStart(13)).toBe(true);
    expect(isChapterStart(14)).toBe(false);
  });
});
