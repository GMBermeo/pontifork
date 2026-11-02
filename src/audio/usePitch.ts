import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SharedValue, useSharedValue } from 'react-native-reanimated';

import { MicSource, TARGET_SAMPLE_RATE, useMicSource } from './sources';
import { SILENT_READING, TunerTracker, type TunerConfig, type TunerReading } from './tunerTracker';

export interface LivePitch {
  /** Smoothed cents from the target, written on every audio frame. */
  cents: SharedValue<number>;
  /** Input level, 0–1, for the meter. */
  level: SharedValue<number>;
  /** 1 while a note is being tracked. */
  tracking: SharedValue<number>;
  mic: MicSource;
  /** Subscribes to throttled text readings without re-rendering the subscriber's parent. */
  subscribeReading: (listener: (reading: TunerReading) => void) => () => void;
}

/** The latest throttled reading, as React state. */
export function useTunerReading(pitch: LivePitch): TunerReading {
  const [reading, setReading] = useState<TunerReading>(SILENT_READING);
  useEffect(() => pitch.subscribeReading(setReading), [pitch]);
  return reading;
}

export interface UsePitchOptions {
  /** Whether the microphone is open. */
  enabled: boolean;
  config: TunerConfig;
  /** Lowest fundamental to listen for; see `detectionFloorHz`. */
  minFrequency: number;
}

export function usePitch({ enabled, config, minFrequency }: UsePitchOptions): LivePitch {
  const cents = useSharedValue(0);
  const level = useSharedValue(0);
  const tracking = useSharedValue(0);

  const readingRef = useRef<TunerReading>(SILENT_READING);
  const listenersRef = useRef(new Set<(reading: TunerReading) => void>());

  const publishReading = useCallback((next: TunerReading) => {
    readingRef.current = next;
    listenersRef.current.forEach((listener) => listener(next));
  }, []);

  const subscribeReading = useCallback((listener: (reading: TunerReading) => void) => {
    listenersRef.current.add(listener);
    listener(enabled ? readingRef.current : SILENT_READING);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, [enabled]);

  // Rebuilt only when the instrument's range changes, and retuned in place
  // otherwise: a hardware sample rate other than the one asked for is
  // absorbed by the tracker rather than becoming React state.
  const tracker = useMemo(
    () => new TunerTracker({ sampleRate: TARGET_SAMPLE_RATE, minFrequency }),
    [minFrequency],
  );

  const { notes, a4, lockedString } = config;
  useEffect(() => {
    tracker.configure({ notes, a4, lockedString });
  }, [tracker, notes, a4, lockedString]);

  const onSamples = useCallback((samples: Float32Array) => {
    const update = tracker.push(samples, Date.now());
    level.set(update.level);
    tracking.set(update.tracking);
    if (update.cents !== null) cents.set(update.cents);
    if (update.reading) publishReading(update.reading);
  }, [tracker, cents, level, tracking, publishReading]);

  const mic = useMicSource(onSamples, enabled);

  useEffect(() => {
    tracker.reconfigure(mic.sampleRate);
  }, [tracker, mic.sampleRate]);

  useEffect(() => {
    if (enabled) return;
    tracker.reset();
    cents.set(0);
    level.set(0);
    tracking.set(0);
    publishReading(SILENT_READING);
  }, [enabled, tracker, cents, level, tracking, publishReading]);

  return { cents, level, tracking, mic, subscribeReading };
}
