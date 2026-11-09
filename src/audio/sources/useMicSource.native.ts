import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { type MicSource, type MicStatus, type SampleSink, TARGET_SAMPLE_RATE, toMono } from './types';

/**
 * Native microphone tap.
 *
 * `expo-audio`'s `AudioStream` hands over real PCM straight from the platform
 * audio unit — AVAudioEngine on iOS, AAudio on Android — so the pitch engine
 * gets the same float samples it gets on the web, without a bespoke native
 * module in between.
 *
 * Buffers arrive as an `ArrayBuffer` on the JS thread. That is a bridge hop
 * the original architecture wanted to avoid with a JSI TurboModule, and it is
 * the right thing to revisit if profiling ever shows it mattering — but the
 * analysis window is 10–43 ms wide, which dwarfs the hop, so it does not
 * dominate the latency budget today.
 */

interface Outcome {
  status: MicStatus;
  error: string | null;
}

const PENDING: Outcome = { status: 'requesting', error: null };

export function useMicSource(onSamples: SampleSink, enabled: boolean): MicSource {
  const [permission, setPermission] = useState<Outcome>(PENDING);
  const [streaming, setStreaming] = useState<Outcome | null>(null);
  const [actualSampleRate, setActualSampleRate] = useState<number>(TARGET_SAMPLE_RATE);

  const sink = useRef(onSamples);
  // Written in an effect, not during render: a ref mutated mid-render is a
  // correctness error under React Compiler, and one stale audio block is
  // harmless.
  useEffect(() => { sink.current = onSamples; });

  const { stream, isStreaming } = useAudioStream({
    sampleRate: TARGET_SAMPLE_RATE,
    channels: 1,
    encoding: 'float32',
    onBuffer: (buffer) => {
      if (buffer.sampleRate > 0 && buffer.sampleRate !== actualSampleRate) {
        setActualSampleRate(buffer.sampleRate);
      }
      const samples = new Float32Array(buffer.data);
      sink.current(buffer.channels > 1 ? toMono(samples, buffer.channels) : samples);
    },
  });

  const granted = permission.status === 'running';

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const isCancelled = (): boolean => cancelled;

    async function ensurePermission(): Promise<void> {
      try {
        const current = await getRecordingPermissionsAsync();
        if (isCancelled()) return;
        if (current.granted) {
          setPermission({ status: 'running', error: null });
          return;
        }

        const requested = await requestRecordingPermissionsAsync();
        if (isCancelled()) return;
        setPermission(requested.granted
          ? { status: 'running', error: null }
          : {
            status: 'denied',
            error: 'Microphone access was refused. Grant it in system settings so Pontifork can hear your instrument.',
          });
      } catch (cause: unknown) {
        if (isCancelled()) return;
        setPermission({
          status: 'error',
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }

    void ensurePermission();

    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !granted) return;

    let cancelled = false;
    const isCancelled = (): boolean => cancelled;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function startStream(isRetry: boolean): Promise<void> {
      try {
        await stream.start();
        if (!isCancelled()) {
          setStreaming({ status: 'running', error: null });
        }
      } catch (cause: unknown) {
        if (isCancelled()) return;
        if (!isRetry) {
          retryTimer = setTimeout(() => {
            void startStream(true);
          }, 200);
          return;
        }
        setStreaming({
          status: 'error',
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }

    void startStream(false);

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      try {
        stream.stop();
      } catch {
        // Already torn down by the platform; nothing useful to do about it.
      }
    };
  }, [enabled, granted, stream]);

  let status: MicStatus = 'idle';
  let error: string | null = null;

  if (enabled) {
    if (permission.status === 'denied' || permission.status === 'error') {
      status = permission.status;
      error = permission.error;
    } else if (isStreaming || streaming?.status === 'running') {
      status = 'running';
    } else if (streaming?.status === 'error') {
      status = 'error';
      error = streaming.error;
    } else {
      status = 'requesting';
    }
  }

  const sampleRate = stream.sampleRate > 0 ? stream.sampleRate : actualSampleRate;

  return {
    status,
    sampleRate,
    error,
    live: status === 'running',
  };
}
