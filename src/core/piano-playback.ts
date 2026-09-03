export type PianoPlaybackConfig = {
  sampleMidi: number;
  playbackRate: number;
};

/**
 * 复盘钢琴音域 G3-A5（MIDI 55~81），全部使用对应音高的离线精确采样，
 * 无需再依赖低音区变速补偿。
 */
export function pianoPlaybackConfig(midi: number): PianoPlaybackConfig | null {
  if (midi >= 55 && midi <= 81) return { sampleMidi: midi, playbackRate: 1 };
  return null;
}
