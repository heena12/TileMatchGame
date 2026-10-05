import { DEFAULT_LANGUAGE, isLanguageCode } from '@config/languages';
import type { LanguageCode } from '@config/languages';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { gu } from './translations/gu';
import { hi } from './translations/hi';

/** Every user-visible string lives here so translation needs no code changes. */
const en = {
  'app.title': 'Tile Match',

  'splash.loading': 'Quickly entering the level...',
  // Studio shown on the first splash screen; replace with your own.
  'splash.studio': 'Tile Studio',
  'splash.studioSub': 'Games',

  'home.play': 'Play',
  'home.continue': 'Level {level}',
  'home.resume': 'Resume - Level {level}',
  'home.settings': 'Settings',
  'home.coins': 'Coins: {coins}',

  'map.title': 'Levels',
  'map.level': 'Level {level}',
  'map.levelStars': 'Level {level}, {stars} of 3 stars',
  'map.locked': 'Level {level}, locked',
  'map.range': 'Level {first}-{last}',
  'map.back': 'Back',
  'revive.oddsBefore': 'Only ',
  'revive.oddsAfter': ' players can pass this level',
  'revive.button': 'Revive',
  'revive.buttonCost': 'Revive for {cost} coins',
  'revive.restart': 'Tap to restart',
  'revive.noCoins': 'Not enough coins to revive.',
  'revive.cannot': 'Nothing to take back.',
  'settings.close': 'Close',
  'settings.back': 'Back',
  'settings.music': 'Music',
  'settings.vibration': 'Vibration',
  'settings.on': 'on',
  'settings.off': 'off',
  'settings.toggled': '{name} is {state}',
  'settings.voice': 'Voice',
  'settings.notifications': 'Notification',

  'daily.title': 'Daily reward',
  'daily.day': 'Day {day}',
  'daily.streak': '{days}-day streak',
  'daily.claim': 'Claim',
  'daily.coins': '{coins} coins',
  'daily.received': 'You got: {reward}',
  'daily.comeBack': 'Come back tomorrow for the next reward.',
  'daily.button': 'Daily reward, ready to claim',

  'settings.testReminder': 'Send test reminder',
  'settings.testReminderSent':
    'Test reminder in 10 seconds. You can leave the app.',
  'settings.testReminderNo': 'Allow notifications first.',
  'notify.test.title': 'Test reminder',
  'notify.test.body': 'If you can read this, notifications work.',

  'settings.devSteps': '{n} more taps for developer tools',
  'settings.devOn': 'Developer tools on',

  'notify.channel': 'Reminders',
  'notify.reward.title': 'Your daily reward is ready!',
  'notify.reward.body': "Claim today's coins and boosters.",
  'notify.streak.title': 'Your {days}-day streak is at risk!',
  'notify.streak.body': 'Come back today to keep it going.',
  'notify.day3.title': 'Miss the puzzles?',
  'notify.day3.body': 'A fresh level is ready for you.',
  'notify.day7.title': 'It has been a while',
  'notify.day7.body': 'Pick up where you left off in Tile Match.',
  'settings.colorFriendly': 'Color-friendly Mode',
  'settings.colorWhenOff': 'When disabled, these level types will return:',
  'settings.colorVariation': 'Color variation levels',
  'common.no': 'No',
  'common.yes': 'Yes',
  'settings.language': 'Language',
  'settings.support': 'Support',
  'settings.save': 'Save Your Progress',
  'settings.about': 'About Us',
  'settings.version': 'Version {version}',
  'settings.languageSoon': 'More languages are coming soon.',
  'settings.privacy': 'Privacy Policy',
  'settings.privacyText':
    'Tile Match does not ask you to sign up and does not collect your name, email or location. Your progress, coins and settings are stored only on this device. Daily reminders are scheduled on your device and you can turn them off in Settings. If cloud save is switched on, only your game progress is backed up. We never sell your data. Questions? Contact us from Support.',
  'settings.supportText':
    'Need help or found a problem? Send us an email and tell us your app version and what happened. We will get back to you as soon as we can.',
  'settings.supportEmail': 'Email us',
  'settings.supportFail': 'No email app found. Write to {email}',
  'settings.cloudOff': "Cloud save isn't connected yet.",
  'settings.aboutText':
    'Match three tiles at a time and clear the board before the tray fills up. Explore the world one picture at a time.',
  'shop.title': 'Shop',
  'shop.boosters': 'Boosters',
  'shop.bundles': 'Offers',
  'shop.buy': 'Buy {name} for {price} coins',
  'shop.bought': '{name} added!',
  'shop.noCoins': 'Not enough coins.',
  'shop.unavailable': 'Purchases are not available yet.',
  'map.prev': 'Previous levels',
  'map.next': 'Next levels',

  'game.level': 'Level {level}',
  'game.score': 'Score {score}',
  'game.combo': 'Combo x{level}',
  'game.restart': 'Restart',
  'game.quit': 'Quit',
  'game.loading': 'Loading level',
  'game.error': 'Could not load this level.',
  'game.retry': 'Try again',
  'game.tile': '{name} tile, {state}',
  'game.tileFree': 'available',
  'game.tileBlocked': 'covered',
  'booster.undo': 'Undo',
  'booster.hint': 'Wand',
  'booster.shuffle': 'Shuffle',
  'booster.left': '{name}, {count} left',
  'booster.buy': '{name}, costs {price} coins',
  'booster.noCoins': 'Not enough coins',
  'booster.locked': 'Finish this tutorial step first',
  'booster.nothingToUndo': 'Nothing to undo yet',
  'booster.nothingToShuffle': 'Nothing to shuffle',
  'booster.noHint': 'No set to collect right now',
  'game.tray': 'Tray, {count} of {size} slots used',

  'result.won': 'Level complete!',
  'result.lost': 'Tray full',
  'result.score': 'Score {score}',
  'result.stars': '{stars} of 3 stars',
  'result.coins': '+{coins} coins',
  'result.next': 'Continue',
  'result.retry': 'Try again',
  'result.map': 'Level map',
  'result.home': 'Home',
  'result.leaderboard': 'Leaderboard',
  'result.none': 'No result to show.',

  'settings.title': 'Settings',
  'settings.sound': 'Sound',
  'settings.haptics': 'Haptics',
  'settings.replayTutorial': 'Replay tutorial',
  'settings.cloud': 'Cloud save',

  'cloud.unavailable': 'Not connected yet',
  'cloud.idle': 'Ready to sync',
  'cloud.syncing': 'Syncing...',
  'cloud.synced': 'Saved to the cloud',
  'cloud.offline': 'Offline, will try again',
  'cloud.update': 'Update the app to sync',
  'cloud.error': 'Sync did not work',
  'cloud.syncNow': 'Sync now',

  'board.title': 'Leaderboard',
  'board.level': 'Level {level}',
  'board.loading': 'Loading scores',
  'board.empty': 'No scores yet. Be the first!',
  'board.error': 'Could not load the leaderboard.',
  'board.retry': 'Try again',
  'board.entry': '{rank}. {name}, {score} points, {stars} of 3 stars',
  'board.you': 'You',

  'tutorial.gotIt': 'Got it',
  'tutorial.skip': 'Skip tutorial',
  'tutorial.nudge': 'Tap the highlighted tile to continue.',
  'tutorial.l1.tap': 'Welcome! Tap a tile to send it to the tray below.',
  'tutorial.l1.same': 'Now tap another tile with the same picture.',
  'tutorial.l1.three': 'Three of a kind vanish! Clear every tile to win.',
  'tutorial.l2.first': 'Tap this tile.',
  'tutorial.l2.wait': 'Different pictures wait side by side in the tray.',
  'tutorial.l2.again': 'Tap another tile that matches the first one.',
  'tutorial.l2.match': 'One more makes three, and three of a kind clear away!',
  'tutorial.l3.covered':
    "Some tiles sit under others. Covered tiles are dimmed and can't be tapped.",
  'tutorial.l3.top': 'Tap a tile on top. Free tiles can be tapped.',
  'tutorial.l3.next': 'Tap the next matching tile on top.',
  'tutorial.l3.last': 'And the last one on top.',
  'tutorial.l3.under': 'The tiles underneath are free now. Keep going!',
  'tutorial.l4.capacity':
    'The tray holds 7 tiles. If it fills up with no match, you lose.',
  'tutorial.l4.pile':
    'Different pictures pile up in the tray. Tap these three.',
  'tutorial.l4.match': 'Tap a tile that matches one already in the tray.',
  'tutorial.l4.clear': 'Tap this last matching tile to clear space.',
  'tutorial.l5.layers': 'Tiles are stacked in layers. Start with the top ones.',
  'tutorial.l5.top': 'Tap a top tile.',
  'tutorial.l5.more': 'Tap the matching top tiles.',
  'tutorial.l5.done':
    'The tiles below get uncovered. Now finish the level yourself!',
  'tutorial.l6.plan': 'Plan ahead: choose tiles that uncover more matches.',
  'tutorial.l6.pick': 'Tap this tile first.',
  'tutorial.l6.more': 'Now take the other two matching tiles.',
  'tutorial.l6.uncover': 'Nice! Now finish the level yourself.',
  'tutorial.l7.combo':
    'Clear matches quickly, one after another, to build a combo and earn bonus points!',
  'tutorial.l7.first': 'Match this first set.',
  'tutorial.l7.quick': 'Quickly match the next set!',
  'tutorial.l7.bonus': 'One more for a combo bonus!',
  'tutorial.l8.stars':
    'Score high to earn up to 3 stars. Quick matches and an empty tray add bonus points.',
  'tutorial.l9.boosters':
    'Undo, Wand and Shuffle are your helpers. Finish training to get your first ones!',
  'tutorial.l10.ready':
    'You know the basics. Clear the board to finish training!',
} as const;

export type StringKey = keyof typeof en;

/** A translation: any subset of the keys; anything missing is shown in English. */
export type Translation = Partial<Record<StringKey, string>>;

const TRANSLATIONS: Readonly<Record<LanguageCode, Translation>> = {
  en: {},
  hi,
  gu,
  es,
  fr,
};

let current: LanguageCode = DEFAULT_LANGUAGE;

/** Switches the language `t()` answers in. Unknown codes are ignored. */
export function setLanguage(code: string): void {
  if (isLanguageCode(code)) {
    current = code;
  }
}

export function getLanguage(): LanguageCode {
  return current;
}

/** Every translation, for checks that none has fallen out of step with English. */
export function translationsFor(code: LanguageCode): Translation {
  return TRANSLATIONS[code];
}

export const ENGLISH: Readonly<Record<StringKey, string>> = en;

export type StringVars = Readonly<Record<string, string | number>>;

/** Looks up a string and fills {placeholders}. Unknown placeholders are left visible. */
export function t(key: StringKey, vars?: StringVars): string {
  const template: string = TRANSLATIONS[current][key] ?? en[key];
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function isStringKey(key: string): key is StringKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

/** Text for a key that came from level data. An unknown key shows itself rather than crashing. */
export function textForKey(key: string, vars?: StringVars): string {
  return isStringKey(key) ? t(key, vars) : key;
}

export const STRING_KEYS = Object.keys(en) as StringKey[];
