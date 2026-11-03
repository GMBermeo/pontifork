import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { LivePitch } from '@audio';
import { applyStatusChange, StringStatusTracker, type InstrumentId, type Tuning } from '@domain';

/** Everything the tuner's pieces need to know about what is being tuned. */
export interface TuningSession {
  instrument: InstrumentId;
  tuning: Tuning;
  /** A string picked by hand, or null to follow whichever string is played. */
  lockedString: number | null;
  lockString: (index: number | null) => void;
  /** Strings held in tune since this tuning was chosen. */
  tunedStrings: ReadonlySet<number>;
}

const NO_STRINGS: ReadonlySet<number> = new Set();

/**
 * The string the player has locked the tuner to. A lock belongs to a tuning:
 * choosing another tuning releases it, derived here rather than reset in an
 * effect so the release costs no extra render.
 */
export function useStringLock(tuning: Tuning): [number | null, (index: number | null) => void] {
  const [lock, setLock] = useState<{ tuning: Tuning; index: number | null }>({ tuning, index: null });
  const locked = lock.tuning === tuning ? lock.index : null;
  return [locked, (index) => setLock({ tuning, index })];
}

function confirmWithHaptics(): void {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    // No haptics on this device: the tick on screen is enough.
  });
}

/**
 * Which strings have been held in tune since `tuning` was chosen, with a
 * haptic tap as each one lands. Follows the throttled readings rather than
 * the audio frames: ten updates a second is plenty to judge a 600 ms hold.
 */
export function useTunedStrings(pitch: LivePitch, tuning: Tuning): ReadonlySet<number> {
  const [progress, setProgress] = useState<{ tuning: Tuning; tuned: ReadonlySet<number> }>({ tuning, tuned: NO_STRINGS });

  useEffect(() => {
    const tracker = new StringStatusTracker();
    return pitch.subscribeReading((reading) => {
      const change = tracker.push(reading, Date.now());
      if (!change) return;
      setProgress((current) => {
        const tuned = current.tuning === tuning ? current.tuned : NO_STRINGS;
        return { tuning, tuned: applyStatusChange(tuned, change) };
      });
      if (change.tuned) confirmWithHaptics();
    });
  }, [pitch, tuning]);

  return progress.tuning === tuning ? progress.tuned : NO_STRINGS;
}

/** False while the app is in the background, so the microphone is released there. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
}

const KEEP_AWAKE_TAG = 'pontifork-tuner';

/**
 * Keeps the screen on while `active`: both hands are on the instrument while
 * tuning, and a phone that dims halfway through a string is no use. On the
 * web this needs the Wake Lock API, which not every browser has; without it
 * the screen simply follows the system timeout.
 */
export function useKeepAwakeWhile(active: boolean, tag: string = KEEP_AWAKE_TAG): void {
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(tag).catch(() => {
      // The screen may dim mid-tuning; nothing worse.
    });
    return () => {
      deactivateKeepAwake(tag).catch(() => {
        // Never activated: nothing to release.
      });
    };
  }, [active, tag]);
}
