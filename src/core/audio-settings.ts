// 全局默认音量（0-100）。所有页面的音量条都用这个值，改一处即可全站生效。
// ⚠️ 需与小程序 utils/audio-settings.js 的 DEFAULT_AUDIO_VOLUME 保持一致。
export const DEFAULT_AUDIO_VOLUME = 80;

export function parseStoredVolume(rawValue: unknown, fallback = DEFAULT_AUDIO_VOLUME) {
  if (rawValue === '' || rawValue === null || typeof rawValue === 'undefined') return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

export function normalizeAudioVolume(volume: number) {
  return parseStoredVolume(volume) / 100;
}
