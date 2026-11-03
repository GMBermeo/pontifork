import { useEffect, useRef, useState } from 'react';

import { type MicSource, type MicStatus, type SampleSink, TARGET_SAMPLE_RATE } from './types';

/**
 * Web microphone tap.
 *
 * The browser's audio graph runs on its own thread, and the only sanctioned
 * way onto it is an `AudioWorklet`. The processor below does nothing clever —
 * it batches 256 samples and hands them over — but batching matters: posting
 * every 128-frame render quantum would double the message rate for no benefit,
 * and posting much larger blocks would add latency the pitch engine has
 * already budgeted away.
 *
 * The constraints are the important part. Echo cancellation, noise suppression
 * and automatic gain are all designed for speech and all actively destroy a
 * string held for tuning: AGC pumps the level between bow strokes and plucks,
 * and noise suppression treats a sustained low note as stationary noise and
 * attenuates it.
 */
const PROCESSOR_SOURCE = `
class PontiforkTapProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._block = new Float32Array(256);
    this._filled = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this._block[this._filled++] = channel[i];
      if (this._filled === this._block.length) {
        const out = this._block;
        // Transfer rather than copy — the worklet allocates a fresh block.
        this.port.postMessage(out, [out.buffer]);
        this._block = new Float32Array(256);
        this._filled = 0;
      }
    }
    return true;
  }
}
registerProcessor('pontifork-tap', PontiforkTapProcessor);
`;

interface Outcome {
  status: MicStatus;
  sampleRate: number;
  error: string | null;
}

const PENDING: Outcome = { status: 'requesting', sampleRate: TARGET_SAMPLE_RATE, error: null };

export function useMicSource(onSamples: SampleSink, enabled: boolean): MicSource {
  // Only the *resolved* outcome is stored. "Idle" and "requesting" are facts
  // about `enabled` and about not having heard back yet, so they are derived —
  // which keeps every setState here inside an async continuation rather than
  // synchronously inside an effect.
  const [outcome, setOutcome] = useState<Outcome>(PENDING);

  // The sink changes identity across renders; hold it in a ref so the audio
  // graph is never torn down just because a component re-rendered.
  const sink = useRef(onSamples);
  useEffect(() => { sink.current = onSamples; });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    // Read through a call: after an `await` the flag may have changed, which
    // a plain read's narrowing cannot know.
    const isCancelled = (): boolean => cancelled;
    let context: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let node: AudioWorkletNode | null = null;
    let objectUrl: string | null = null;

    async function start(): Promise<void> {
      // An insecure origin (plain HTTP on a LAN address) has no
      // `navigator.mediaDevices` at all, whatever the DOM types say.
      const devices = typeof navigator === 'undefined' ? undefined : (navigator as Partial<Navigator>).mediaDevices;
      if (!devices) {
        setOutcome({
          status: 'unavailable',
          sampleRate: TARGET_SAMPLE_RATE,
          error: 'This browser does not expose microphone input.',
        });
        return;
      }

      try {
        stream = await devices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
          },
        });
        if (isCancelled()) return;

        context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE, latencyHint: 'interactive' });
        // Chrome may hand back a context that is suspended until a gesture.
        if (context.state === 'suspended') await context.resume();
        if (isCancelled()) return;

        const blob = new Blob([PROCESSOR_SOURCE], { type: 'application/javascript' });
        objectUrl = URL.createObjectURL(blob);
        await context.audioWorklet.addModule(objectUrl);
        if (isCancelled()) return;

        node = new AudioWorkletNode(context, 'pontifork-tap', { numberOfOutputs: 0 });
        node.port.onmessage = (event: MessageEvent<Float32Array>) => {
          sink.current(event.data);
        };
        context.createMediaStreamSource(stream).connect(node);

        setOutcome({ status: 'running', sampleRate: context.sampleRate, error: null });
      } catch (cause) {
        if (isCancelled()) return;
        const name = errorName(cause);
        const denied = name === 'NotAllowedError' || name === 'SecurityError';
        setOutcome({
          status: denied ? 'denied' : 'error',
          sampleRate: TARGET_SAMPLE_RATE,
          error: denied ? 'Microphone access was refused.' : errorMessage(cause),
        });
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (node) node.port.onmessage = null;
      node?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      context?.close().catch(() => {
        // Already closed.
      });
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled]);

  const status: MicStatus = enabled ? outcome.status : 'idle';
  return {
    status,
    sampleRate: outcome.sampleRate,
    error: enabled ? outcome.error : null,
    live: status === 'running',
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** A DOMException's or Error's name (`NotAllowedError`), or null for anything else. */
function errorName(cause: unknown): string | null {
  return typeof cause === 'object' && cause !== null && 'name' in cause && typeof cause.name === 'string' ? cause.name : null;
}
