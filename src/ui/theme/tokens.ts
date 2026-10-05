export const colors = {
  /** Sky blue used by the menu screens. */
  background: '#5E93E0',
  /** Warm sand used behind the board. */
  gameBackground: '#EDC86E',
  surface: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  /** Text that sits directly on `background`. */
  onBackground: '#FFFFFF',
  textShadow: 'rgba(20, 40, 90, 0.6)',
  primary: '#6CC644',
  primaryEdge: '#3E8E1F',
  primaryText: '#FFFFFF',
  secondary: '#3D5A99',
  secondaryEdge: '#28407A',
  secondaryText: '#FFFFFF',
  border: '#D1D5DB',
  /** Cream card used for panels such as Settings. */
  panel: '#FFF7E6',
  panelInset: '#F7EBD2',
  panelText: '#4A4E69',
  tileFace: '#FFFFFF',
  tileEdge: '#A9ADB4',
  tileBlocked: 'rgba(48, 55, 65, 0.24)',
  trayFrame: '#A7A096',
  tray: '#6A6457',
  traySlot: '#443E33',
  star: '#F59E0B',
  starOff: '#D1D5DB',
  danger: '#DC2626',
  coin: '#F5B82E',
  pill: 'rgba(30, 58, 110, 0.55)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 20 } as const;

export const fontSize = {
  caption: 13,
  body: 16,
  title: 24,
  hero: 36,
} as const;

/** Smallest comfortable touch target (points). */
export const MIN_TOUCH_TARGET = 48;

/** Soft dark outline that lets white text read on any background. */
export const textOutline = {
  textShadowColor: colors.textShadow,
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 3,
} as const;
