/**
 * Playback in the browser: the Web Audio API, which takes the samples as they
 * are. A new chord stops the last one, as a player's hand would.
 */

let context: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;

export function playSamples(samples: Float32Array, sampleRate: number): void {
  if (typeof AudioContext === 'undefined') return;
  context ??= new AudioContext();
  // Browsers start a context suspended until a gesture; this call is one.
  context.resume().catch(() => {
    // Still suspended: this chord is silent, and the next tap tries again.
  });
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  playing?.stop();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  playing = source;
}
