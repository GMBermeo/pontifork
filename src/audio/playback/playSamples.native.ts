import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { encodeWav } from '../chordSynth';

/**
 * Playback on iOS and Android. expo-audio streams the microphone in but has
 * no way to play raw samples out, so the chord is written as a short WAV in
 * the cache and played from there. Two files take turns, so writing the next
 * chord never touches the one still sounding.
 */

let player: AudioPlayer | null = null;
let turn = 0;
let modeSet = false;

export function playSamples(samples: Float32Array, sampleRate: number): void {
  if (!modeSet) {
    modeSet = true;
    // Sound even with the ringer switch off: the player asked for it by tapping.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
      // Then it follows the ringer switch, which is still sound most of the time.
    });
  }
  turn = (turn + 1) % 2;
  const file = new File(Paths.cache, `pontifork-chord-${turn}.wav`);
  try {
    file.writeSync(encodeWav(samples, sampleRate));
  } catch {
    return;
  }
  player?.remove();
  player = createAudioPlayer({ uri: file.uri });
  player.play();
}
