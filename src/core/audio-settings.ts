export const DEFAULT_AUDIO_VOLUME = 78;

export function parseStoredVolume(rawValue: unknown, fallback = DEFAULT_AUDIO_VOLUME) {
  if (rawValue === '' || rawValue === null || typeof rawValue === 'undefined') return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}
