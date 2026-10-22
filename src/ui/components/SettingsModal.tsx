import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { APP_CONFIG } from '@config/constants';
import { LANGUAGES, languageName } from '@config/languages';
import { useGameController, useSettings } from '@state/StoresContext';
import { transitionConfig } from '@ui/animation/transitionConfig';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { TileBadge } from '@ui/components/TileBadge';
import {
  colors,
  fontSize,
  radius,
  spacing,
  textOutline,
} from '@ui/theme/tokens';

/** How long the card takes to pop in (ms). */
const OPEN_MS = 220;
const MESSAGE_MS = 1600;

interface ToggleProps {
  testID: string;
  label: string;
  glyph: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** A round on/off button: green when on, dark when off. */
function RoundToggle({
  testID,
  label,
  glyph,
  value,
  onValueChange,
}: ToggleProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.round,
        value ? styles.roundOn : styles.roundOff,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.roundGlyph}>{glyph}</Text>
    </Pressable>
  );
}

/** A labelled row with a switch. */
function SwitchRow({
  icon,
  label,
  value,
  onChange,
  testID,
}: {
  icon: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#8B8FA8', true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/** A labelled row that goes somewhere, with a green arrow. */
function LinkRow({
  icon,
  label,
  note,
  onPress,
  testID,
  noteTestID,
  noteBelow = false,
  disabled = false,
}: {
  icon: string;
  label: string;
  note?: string;
  onPress: () => void;
  testID?: string;
  noteTestID?: string;
  /** Show the note as a small line under the label instead of beside it. */
  noteBelow?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      {noteBelow && note ? (
        <View style={styles.stack}>
          <Text style={styles.stackLabel}>{label}</Text>
          <Text testID={noteTestID} style={styles.noteSmall}>
            {note}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>{label}</Text>
          {note ? (
            <Text testID={noteTestID} style={styles.note}>
              {note}
            </Text>
          ) : null}
        </>
      )}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

/**
 * The Settings card, shown over the screen that opened it, laid out like the
 * reference game: round switches for music, sound, voice and vibration, then
 * Notification and Color-friendly Mode, then Language, Support, Save Your
 * Progress and About Us. The screen behind stays visible and darkens, the card
 * scales up from small, and on close it fades while the darkness lifts.
 * `onClose` runs once the close animation has finished.
 */
export function SettingsModal({
  onClose,
  onReplayTutorial,
}: {
  onClose: () => void;
  onReplayTutorial: () => void;
}) {
  const soundEnabled = useSettings(s => s.soundEnabled);
  const hapticsEnabled = useSettings(s => s.hapticsEnabled);
  const musicEnabled = useSettings(s => s.musicEnabled);
  const voiceEnabled = useSettings(s => s.voiceEnabled);
  const colorFriendly = useSettings(s => s.colorFriendly);
  const notificationsEnabled = useSettings(s => s.notificationsEnabled);
  const setSoundEnabled = useSettings(s => s.setSoundEnabled);
  const setHapticsEnabled = useSettings(s => s.setHapticsEnabled);
  const setMusicEnabled = useSettings(s => s.setMusicEnabled);
  const setVoiceEnabled = useSettings(s => s.setVoiceEnabled);
  const setColorFriendly = useSettings(s => s.setColorFriendly);
  const setNotificationsEnabled = useSettings(s => s.setNotificationsEnabled);
  const language = useSettings(s => s.language);
  const setLanguage = useSettings(s => s.setLanguage);
  useLanguage();
  const controller = useGameController();
  // The card sits at a tenth of the height this overlay really has (on the
  // web the game is a narrow column, so measure it instead of the window).
  const window = useWindowDimensions();
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const height = measuredHeight ?? window.height;

  const [view, setView] = useState<
    'main' | 'about' | 'language' | 'privacy' | 'support'
  >('main');
  // Asked before Color-friendly Mode is switched off, as in the reference game.
  const [confirmColor, setConfirmColor] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (message === null) {
      return undefined;
    }
    const id = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(id);
  }, [message]);

  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  const closing = useSharedValue(0);
  const closed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!reduced) {
      progress.value = withTiming(1, {
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [progress, reduced]);

  const close = useCallback(() => {
    if (closed.current) {
      return;
    }
    closed.current = true;
    if (reduced || transitionConfig.modalMs <= 0) {
      onClose();
      return;
    }
    closing.value = 1;
    progress.value = withTiming(0, {
      duration: transitionConfig.modalMs,
      easing: Easing.in(Easing.quad),
    });
    timer.current = setTimeout(onClose, transitionConfig.modalMs);
  }, [closing, onClose, progress, reduced]);

  // The Android back button closes the card first, as the X does.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (confirmColor) {
          setConfirmColor(false);
        } else if (view !== 'main') {
          setView('main');
        } else {
          close();
        }
        return true;
      },
    );
    return () => subscription.remove();
  }, [close, view, confirmColor]);

  const backdropStyle = useAnimatedStyle(
    () => ({ opacity: progress.value }),
    [progress],
  );

  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (closing.value === 1) {
      // Leaving: fade out while growing a little, like the reference game.
      return { opacity: p, transform: [{ scale: 1 + 0.06 * (1 - p) }] };
    }
    // Arriving: from small and a little low, with a slight overshoot.
    return {
      opacity: Math.min(1, p * 3),
      transform: [
        { translateY: 40 * (1 - p) },
        { scale: 0.4 + 0.6 * p + 0.06 * Math.sin(p * Math.PI) },
      ],
    };
  }, [progress, closing]);

  // Every switch says what it just did, like the reference game's toast.
  const announce = (name: string, value: boolean) =>
    setMessage(
      t('settings.toggled', {
        name,
        state: t(value ? 'settings.on' : 'settings.off'),
      }),
    );

  const emailSupport = () => {
    const subject = encodeURIComponent(
      `${t('app.title')} ${APP_CONFIG.appVersion}`,
    );
    Linking.openURL(
      `mailto:${APP_CONFIG.supportEmail}?subject=${subject}`,
    ).catch(() =>
      setMessage(
        t('settings.supportFail', { email: APP_CONFIG.supportEmail }),
      ),
    );
  };

  const music = (value: boolean) => {
    setMusicEnabled(value);
    // Start or stop the music right away.
    controller.warmUp();
    announce(t('settings.music'), value);
  };

  return (
    <View
      testID="settings-modal"
      onLayout={event => {
        const h = event.nativeEvent.layout.height;
        if (h > 0) {
          setMeasuredHeight(h);
        }
      }}
      style={[styles.overlay, { paddingTop: Math.round(height * 0.11) }]}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.close')}
          onPress={close}
          style={styles.fill}
        />
      </Animated.View>
      <Animated.View style={[styles.panel, cardStyle]}>
        <Pressable
          testID="setting-close"
          accessibilityRole="button"
          accessibilityLabel={t('settings.close')}
          hitSlop={8}
          onPress={close}
          style={styles.close}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>
            {view === 'about'
              ? t('settings.about')
              : view === 'language'
              ? t('settings.language')
              : view === 'privacy'
              ? t('settings.privacy')
              : view === 'support'
              ? t('settings.support')
              : t('settings.title')}
          </Text>
        </View>

        {view === 'main' ? (
          <>
            <View style={styles.rounds}>
              <RoundToggle
                testID="setting-music"
                label={t('settings.music')}
                glyph="🎵"
                value={musicEnabled}
                onValueChange={music}
              />
              <RoundToggle
                testID="setting-sound"
                label={t('settings.sound')}
                glyph="🔊"
                value={soundEnabled}
                onValueChange={value => {
                  setSoundEnabled(value);
                  announce(t('settings.sound'), value);
                }}
              />
              <RoundToggle
                testID="setting-voice"
                label={t('settings.voice')}
                glyph="🗣️"
                value={voiceEnabled}
                onValueChange={value => {
                  setVoiceEnabled(value);
                  announce(t('settings.voice'), value);
                }}
              />
              <RoundToggle
                testID="setting-haptics"
                label={t('settings.vibration')}
                glyph="📳"
                value={hapticsEnabled}
                onValueChange={value => {
                  setHapticsEnabled(value);
                  announce(t('settings.vibration'), value);
                }}
              />
            </View>

            <View style={styles.group}>
              <SwitchRow
                testID="setting-notifications"
                icon="🔔"
                label={t('settings.notifications')}
                value={notificationsEnabled}
                onChange={value => {
                  setNotificationsEnabled(value);
                  announce(t('settings.notifications'), value);
                }}
              />
              <SwitchRow
                testID="setting-color-friendly"
                icon="🎨"
                label={t('settings.colorFriendly')}
                value={colorFriendly}
                onChange={value => {
                  if (!value && colorFriendly) {
                    // Switching off asks first, like the reference game.
                    setConfirmColor(true);
                    return;
                  }
                  setColorFriendly(value);
                  announce(t('settings.colorFriendly'), value);
                }}
              />
            </View>

            <View style={styles.group}>
              <LinkRow
                testID="setting-language"
                icon="🌐"
                label={t('settings.language')}
                note={languageName(language)}
                onPress={() => setView('language')}
              />
              <LinkRow
                testID="setting-support"
                icon="💬"
                label={t('settings.support')}
                onPress={() => setView('support')}
              />
              <LinkRow
                testID="setting-privacy"
                icon="🔒"
                label={t('settings.privacy')}
                onPress={() => setView('privacy')}
              />
              <LinkRow
                testID="setting-replay-tutorial"
                icon="🎓"
                label={t('settings.replayTutorial')}
                onPress={onReplayTutorial}
              />
              <LinkRow
                testID="setting-about"
                icon="ℹ️"
                label={t('settings.about')}
                onPress={() => setView('about')}
              />
            </View>

            <View style={styles.versionTap}>
              <Text style={styles.version}>
                {t('settings.version', { version: APP_CONFIG.appVersion })}
              </Text>
            </View>
          </>
        ) : view === 'language' ? (
          <>
            <View style={styles.group}>
              {LANGUAGES.map(option => (
                <Pressable
                  key={option.code}
                  testID={`language-${option.code}`}
                  accessibilityRole="radio"
                  accessibilityLabel={option.name}
                  accessibilityState={{ selected: option.code === language }}
                  onPress={() => setLanguage(option.code)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.label}>{option.name}</Text>
                  {option.code === language ? (
                    <Text testID="language-selected" style={styles.check}>
                      ✓
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
            <Pressable
              testID="setting-language-back"
              accessibilityRole="button"
              accessibilityLabel={t('settings.back')}
              onPress={() => setView('main')}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Text style={styles.backText}>{t('settings.back')}</Text>
            </Pressable>
          </>
        ) : view === 'privacy' ? (
          <>
            <View style={styles.group}>
              <View style={styles.aboutBox}>
                <Text testID="privacy-text" style={styles.aboutText}>
                  {t('settings.privacyText')}
                </Text>
              </View>
            </View>
            <Pressable
              testID="setting-privacy-back"
              accessibilityRole="button"
              accessibilityLabel={t('settings.back')}
              onPress={() => setView('main')}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Text style={styles.backText}>{t('settings.back')}</Text>
            </Pressable>
          </>
        ) : view === 'support' ? (
          <>
            <View style={styles.group}>
              <View style={styles.aboutBox}>
                <Text testID="support-text" style={styles.aboutText}>
                  {t('settings.supportText')}
                </Text>
                <Text style={styles.aboutTitle}>{APP_CONFIG.supportEmail}</Text>
              </View>
            </View>
            <Pressable
              testID="support-email"
              accessibilityRole="button"
              accessibilityLabel={t('settings.supportEmail')}
              onPress={emailSupport}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Text style={styles.backText}>{t('settings.supportEmail')}</Text>
            </Pressable>
            <Pressable
              testID="setting-support-back"
              accessibilityRole="button"
              accessibilityLabel={t('settings.back')}
              onPress={() => setView('main')}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Text style={styles.backText}>{t('settings.back')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.group}>
              <View style={styles.aboutBox}>
                <Text style={styles.aboutTitle}>{t('app.title')}</Text>
                <Text style={styles.aboutText}>{t('settings.aboutText')}</Text>
                <Text style={styles.version}>
                  {t('settings.version', { version: APP_CONFIG.appVersion })}
                </Text>
              </View>
            </View>
            <Pressable
              testID="setting-about-back"
              accessibilityRole="button"
              accessibilityLabel={t('settings.back')}
              onPress={() => setView('main')}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Text style={styles.backText}>{t('settings.back')}</Text>
            </Pressable>
          </>
        )}
        {message ? (
          <Animated.View
            key={message}
            pointerEvents="none"
            entering={reduced ? undefined : FadeIn.duration(150)}
            style={styles.toast}
          >
            <Text
              testID="settings-message"
              accessibilityLiveRegion="polite"
              style={styles.toastText}
            >
              {message}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
      {confirmColor ? (
        <ColorConfirm
          onNo={() => setConfirmColor(false)}
          onYes={() => {
            setConfirmColor(false);
            setColorFriendly(false);
            announce(t('settings.colorFriendly'), false);
          }}
        />
      ) : null}
    </View>
  );
}

/** Sample tiles for the confirmation: the same fruit, told apart by a mark. */
const SAMPLES = [
  { glyph: '🍎', shape: '○' },
  { glyph: '🍏', shape: '△' },
  { glyph: '🍋', shape: '☆' },
] as const;

/**
 * "When disabled, these level types will return": the question asked before
 * Color-friendly Mode is switched off, with No and Yes, like the reference game.
 */
function ColorConfirm({
  onNo,
  onYes,
}: {
  onNo: () => void;
  onYes: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <View testID="color-confirm" style={styles.confirmOverlay}>
      <Animated.View
        style={styles.confirmBackdrop}
        entering={reduced ? undefined : FadeIn.duration(160)}
      />
      <Animated.View
        style={styles.confirmCard}
        entering={reduced ? undefined : ZoomIn.duration(220)}
      >
        <Pressable
          testID="color-confirm-close"
          accessibilityRole="button"
          accessibilityLabel={t('settings.close')}
          hitSlop={8}
          onPress={onNo}
          style={styles.close}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <View style={[styles.ribbon, styles.ribbonWide]}>
          <Text numberOfLines={1} style={styles.ribbonText}>
            {t('settings.colorFriendly')}
          </Text>
        </View>
        <Text style={styles.confirmText}>{t('settings.colorWhenOff')}</Text>
        <View style={styles.sampleBox}>
          <Text style={styles.sampleTitle}>{t('settings.colorVariation')}</Text>
          <View style={styles.samples}>
            {SAMPLES.map(sample => (
              <View key={sample.shape} style={styles.sampleTile}>
                <Text style={styles.sampleGlyph}>{sample.glyph}</Text>
                <TileBadge typeId={0} size={18} shape={sample.shape} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.confirmButtons}>
          <Pressable
            testID="color-confirm-no"
            accessibilityRole="button"
            accessibilityLabel={t('common.no')}
            onPress={onNo}
            style={({ pressed }) => [
              styles.confirmButton,
              styles.noButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.confirmButtonText}>{t('common.no')}</Text>
          </Pressable>
          <Pressable
            testID="color-confirm-yes"
            accessibilityRole="button"
            accessibilityLabel={t('common.yes')}
            onPress={onYes}
            style={({ pressed }) => [
              styles.confirmButton,
              styles.yesButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.confirmButtonText}>{t('common.yes')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  versionTap: { paddingVertical: spacing.sm },
  ribbonWide: { paddingHorizontal: spacing.md, maxWidth: '100%' },
  check: { fontSize: 22, fontWeight: '900', color: colors.primary },
  confirmOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 10,
    elevation: 10,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  confirmCard: {
    alignSelf: 'stretch',
    padding: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: colors.panel,
  },
  confirmText: {
    textAlign: 'center',
    fontSize: fontSize.body + 4,
    fontWeight: '900',
    color: colors.panelText,
    paddingHorizontal: spacing.sm,
  },
  sampleBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.panelInset,
  },
  sampleTitle: { fontSize: fontSize.body, fontWeight: '900', color: '#E0A030' },
  samples: { flexDirection: 'row', gap: spacing.sm },
  sampleTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#C9CCD2',
    borderBottomWidth: 5,
  },
  sampleGlyph: { fontSize: 30 },
  confirmButtons: { flexDirection: 'row', gap: spacing.md },
  confirmButton: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderBottomWidth: 6,
  },
  noButton: { backgroundColor: '#5BA8EE', borderBottomColor: '#2F6EB5' },
  yesButton: { backgroundColor: '#6CC644', borderBottomColor: '#3E8E1F' },
  confirmButtonText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
  },
  fill: { ...StyleSheet.absoluteFill },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 16, 30, 0.62)',
  },
  close: {
    position: 'absolute',
    top: -14,
    right: -6,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8452C',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  closeGlyph: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  panel: {
    alignSelf: 'stretch',
    padding: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: colors.panel,
  },
  ribbon: {
    alignSelf: 'center',
    marginTop: -spacing.lg - spacing.xl,
    paddingHorizontal: spacing.xl + spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderBottomWidth: 5,
    borderBottomColor: colors.secondaryEdge,
    backgroundColor: '#6FB1F0',
  },
  ribbonText: {
    fontSize: fontSize.title,
    fontWeight: '800',
    color: colors.onBackground,
    ...textOutline,
  },
  rounds: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.xs,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  roundOn: { backgroundColor: '#5BC95B' },
  roundOff: { backgroundColor: '#5A5478' },
  roundGlyph: { fontSize: 22 },
  pressed: { opacity: 0.8 },
  group: {
    gap: 2,
    borderRadius: radius.md,
    backgroundColor: colors.panelInset,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rowIcon: { width: 24, fontSize: 18, textAlign: 'center' },
  label: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '800',
    color: colors.panelText,
  },
  stack: { flex: 1, justifyContent: 'center' },
  stackLabel: {
    fontSize: fontSize.body,
    fontWeight: '800',
    color: colors.panelText,
  },
  noteSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8170',
  },
  note: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.panelText,
    textAlign: 'right',
  },
  chevron: { fontSize: 24, fontWeight: '900', color: colors.primary },
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(70, 70, 70, 0.84)',
    zIndex: 5,
    elevation: 5,
  },
  toastText: { fontSize: 24, fontWeight: '900', color: '#E6E6E6' },
  version: {
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#A99F8C',
  },
  aboutBox: { padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  aboutTitle: {
    fontSize: fontSize.title,
    fontWeight: '900',
    color: colors.panelText,
  },
  aboutText: {
    textAlign: 'center',
    fontSize: fontSize.caption + 1,
    fontWeight: '600',
    color: colors.panelText,
  },
  back: {
    alignSelf: 'center',
    minWidth: 160,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    borderBottomWidth: 5,
    borderBottomColor: colors.secondaryEdge,
  },
  backText: { fontSize: fontSize.body, fontWeight: '800', color: '#FFFFFF' },
});
