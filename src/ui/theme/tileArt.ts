export interface TileArt {
  readonly name: string;
  readonly glyph: string;
  readonly accent: string;
}

/** The 30 base tile types (GAME_DESIGN section 4). The engine only knows typeId; art lives here. */
const ART: readonly TileArt[] = [
  { name: 'Apple', glyph: '🍎', accent: '#EF4444' },
  { name: 'Banana', glyph: '🍌', accent: '#EAB308' },
  { name: 'Grapes', glyph: '🍇', accent: '#8B5CF6' },
  { name: 'Cherry', glyph: '🍒', accent: '#DC2626' },
  { name: 'Lemon', glyph: '🍋', accent: '#FACC15' },
  { name: 'Strawberry', glyph: '🍓', accent: '#F43F5E' },
  { name: 'Peach', glyph: '🍑', accent: '#FB923C' },
  { name: 'Carrot', glyph: '🥕', accent: '#F97316' },
  { name: 'Corn', glyph: '🌽', accent: '#EAB308' },
  { name: 'Mushroom', glyph: '🍄', accent: '#B91C1C' },
  { name: 'Cat', glyph: '🐱', accent: '#F59E0B' },
  { name: 'Dog', glyph: '🐶', accent: '#A16207' },
  { name: 'Fox', glyph: '🦊', accent: '#EA580C' },
  { name: 'Bear', glyph: '🐻', accent: '#92400E' },
  { name: 'Panda', glyph: '🐼', accent: '#374151' },
  { name: 'Frog', glyph: '🐸', accent: '#16A34A' },
  { name: 'Owl', glyph: '🦉', accent: '#78350F' },
  { name: 'Fish', glyph: '🐟', accent: '#0EA5E9' },
  { name: 'Butterfly', glyph: '🦋', accent: '#3B82F6' },
  { name: 'Bee', glyph: '🐝', accent: '#CA8A04' },
  { name: 'Star', glyph: '⭐', accent: '#F59E0B' },
  { name: 'Moon', glyph: '🌙', accent: '#6366F1' },
  { name: 'Sun', glyph: '☀️', accent: '#F59E0B' },
  { name: 'Cloud', glyph: '☁️', accent: '#60A5FA' },
  { name: 'Flower', glyph: '🌸', accent: '#EC4899' },
  { name: 'Tulip', glyph: '🌷', accent: '#E11D48' },
  { name: 'Leaf', glyph: '🍃', accent: '#22C55E' },
  { name: 'Gem', glyph: '💎', accent: '#06B6D4' },
  { name: 'Bell', glyph: '🔔', accent: '#D97706' },
  { name: 'Key', glyph: '🔑', accent: '#A16207' },
];

export const TILE_ART_COUNT = ART.length;

/** typeId is 1-based. Out-of-range ids wrap so an unexpected id never crashes rendering. */
export function getTileArt(typeId: number): TileArt {
  const index =
    (((Math.trunc(typeId) - 1) % ART.length) + ART.length) % ART.length;
  return ART[index] as TileArt;
}
