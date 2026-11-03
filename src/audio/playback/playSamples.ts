/**
 * Type anchor and last-resort fallback for the platform players
 * (`playSamples.native.ts`, `playSamples.web.ts`). Metro picks one of those;
 * TypeScript does not follow platform extensions, so it reads this one, and a
 * platform nobody anticipated plays nothing rather than failing to build.
 */
export function playSamples(_samples: Float32Array, _sampleRate: number): void {
  // No player on this platform: stay silent.
}
