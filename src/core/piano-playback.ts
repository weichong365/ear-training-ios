export type PianoPlaybackConfig = {
  sampleMidi: number;
  playbackRate: number;
};

/**
 * 复盘钢琴扩展到 G3-A5。低音区沿用小程序的两份短采样并变速，
 * 其余音区使用对应音高的离线采样。
 */
export function pianoPlaybackConfig(midi: number): PianoPlaybackConfig | null {
  if (midi >= 55 && midi <= 58) {
    return { sampleMidi: 55, playbackRate: Math.pow(2, (midi - 67) / 12) };
  }
  if (midi === 59) return { sampleMidi: 59, playbackRate: 0.5 };
  if (midi >= 60 && midi <= 81) return { sampleMidi: midi, playbackRate: 1 };
  return null;
}
