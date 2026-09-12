"""最终校准 27 个钢琴采样，满足 verify-sample-range.cjs 契约：
  - 时长 1.85s（29600 帧 @16kHz），尾部 100ms 余弦淡出到 0
  - 音准 ±0.5 cents（bandlimited sinc 重采样到精确目标频率）
  - 消除线性插值重采样引入的基频漂移与 G3 尾部台阶

测频窗口与 verify-sample-range.cjs 的 verifySamplePitch 完全一致：
  [0.05s, 1.5s] Hann 窗 + Goertzel(DFT) 功率 + 三分细化。

用法：python3 finalize-piano-samples.py
"""
import os
import wave

import numpy as np

RATE = 16000
TARGET_FRAMES = 29120          # 1.82s（包内时长；播放渲染 mixNote 用 duration+release 补齐到 1.85s）
FADE_FRAMES = 1600             # 100ms 余弦淡出
MEASURE_START = 0.05           # 与 verify 一致
MEASURE_END = 1.50

NAMES = [
    'G3', 'Gs3', 'A3', 'As3', 'B3', 'C4', 'Cs4', 'D4', 'Ds4', 'E4', 'F4', 'Fs4',
    'G4', 'Gs4', 'A4', 'As4', 'B4', 'C5', 'Cs5', 'D5', 'Ds5', 'E5', 'F5', 'Fs5',
    'G5', 'Gs5', 'A5'
]
TARGETS = [
    196.00, 207.65, 220.00, 233.08, 246.94, 261.63, 277.18, 293.66, 311.13,
    329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88, 523.25,
    554.37, 587.33, 622.25, 659.26, 698.46, 739.99, 783.99, 830.61, 880.00
]


def read_wav(path):
    with wave.open(path, 'rb') as w:
        assert w.getframerate() == RATE and w.getnchannels() == 1 and w.getsampwidth() == 2, path
        raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype='<i2').astype(np.float64)


def write_wav(path, samples):
    pcm = np.clip(np.rint(samples), -32768, 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def spectral_power(segment, frequency):
    """Goertzel(DFT) 单频点功率，等价于 verify 的 goertzelPower。"""
    phase = 2.0 * np.pi * frequency * np.arange(segment.size) / RATE
    value = np.sum(segment * np.exp(-1j * phase))
    return float(value.real * value.real + value.imag * value.imag)


def measure_frequency(samples, target):
    start = int(round(MEASURE_START * RATE))
    length = min(samples.size - start, int(round(MEASURE_END * RATE)))
    segment = samples[start:start + length].copy()
    n = segment.size
    window = 0.5 - 0.5 * np.cos(2.0 * np.pi * np.arange(n) / max(1, n - 1))
    segment *= window

    step = max(0.25, target / 1000.0)
    peak = target
    peak_power = 0.0
    frequency = target * 0.98
    while frequency <= target * 1.02 + 1e-9:
        power = spectral_power(segment, frequency)
        if power > peak_power:
            peak_power = power
            peak = frequency
        frequency += step

    left, right = peak - step, peak + step
    for _ in range(32):
        a = left + (right - left) / 3.0
        b = right - (right - left) / 3.0
        if spectral_power(segment, a) < spectral_power(segment, b):
            left = a
        else:
            right = b
    return (left + right) / 2.0


def pre_fade_tail(samples):
    """对源采样尾部做余弦淡出，消除 generate-low-samples 拉伸后硬截断的台阶。
    在测频窗口 [0.05,1.5] 之外，不影响音准。"""
    out = samples.copy()
    n = out.size
    fade_frames = int(0.10 * RATE)  # 100ms
    t = np.arange(fade_frames) / fade_frames
    fade = 0.5 + 0.5 * np.cos(np.pi * t)  # 1 -> 0
    out[n - fade_frames:] *= fade
    return out


def bandlimited_resample(samples, ratio):
    """bandlimited sinc 重采样。ratio = f_target / f_measured（>1 提音高）。
    输出 M = round(N / ratio) 帧，positions = j * ratio，两侧均不越界。"""
    n = samples.size
    m = int(round(n / ratio))
    positions = np.arange(m, dtype=np.float64) * ratio
    radius = 16
    offsets = np.arange(-radius + 1, radius + 1)
    indices = np.floor(positions).astype(np.int64)[:, None] + offsets
    delta = positions[:, None] - indices
    weights = np.sinc(delta) * np.sinc(delta / radius)
    valid = (indices >= 0) & (indices < n) & (np.abs(delta) < radius)
    weights *= valid
    denom = np.sum(weights, axis=1, keepdims=True)
    denom[denom == 0] = 1.0
    weights /= denom
    return np.sum(samples[np.clip(indices, 0, n - 1)] * weights, axis=1)


def apply_fade_and_pad(samples):
    out = np.zeros(TARGET_FRAMES, dtype=np.float64)
    n_copy = min(samples.size, TARGET_FRAMES)
    out[:n_copy] = samples[:n_copy]
    t = np.arange(FADE_FRAMES) / FADE_FRAMES
    fade = 0.5 + 0.5 * np.cos(np.pi * t)  # 1 -> 0
    out[TARGET_FRAMES - FADE_FRAMES:] *= fade
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.normpath(os.path.join(here, '..', '..'))
    destinations = [
        os.path.join(root, 'ios-app', 'assets', 'audio', 'piano'),
        os.path.join(root, 'assets', 'audio', 'piano'),
    ]
    src_dir = os.path.join(root, 'ios-app', 'assets', 'audio', 'piano')

    for name, target in zip(NAMES, TARGETS):
        src = read_wav(os.path.join(src_dir, f'{name}.wav'))
        src = pre_fade_tail(src)
        measured = measure_frequency(src, target)
        ratio = target / measured
        tuned = bandlimited_resample(src, ratio)
        final = apply_fade_and_pad(tuned)
        cents_before = 1200.0 * np.log2(measured / target)
        for directory in destinations:
            write_wav(os.path.join(directory, f'{name}.wav'), final)
        print(f'{name}: {measured:.4f}Hz ({cents_before:+.3f}c) -> {target:.2f}Hz, '
              f'{src.size}->{tuned.size}->{final.size} frames')


if __name__ == '__main__':
    main()
