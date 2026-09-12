"""从 Git 原始采样重制 G3-A5：标准频率、干净泛音、包内 1.82s。播放渲染补齐到 1.85s。"""
import io
import os
import subprocess
import wave

import numpy as np

RATE = 16000
SOURCE_FRAMES = 29120
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


def read_original(repo, name):
    data = subprocess.check_output(['git', 'show', f'HEAD:assets/audio/piano/{name}.wav'], cwd=repo)
    with wave.open(io.BytesIO(data), 'rb') as wav:
        assert wav.getframerate() == RATE and wav.getnchannels() == 1 and wav.getsampwidth() == 2
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float64)


def spectral_energy(samples, frequency):
    segment = samples[round(.2 * RATE):round(.8 * RATE)]
    window = np.hanning(segment.size)
    phase = 2 * np.pi * frequency * np.arange(segment.size) / RATE
    value = np.sum(segment * window * np.exp(-1j * phase))
    return float(value.real * value.real + value.imag * value.imag)


def measure_frequency(samples, target):
    frequencies = np.arange(target * .98, target * 1.02, .05)
    peak = max(frequencies, key=lambda value: spectral_energy(samples, value))
    left, right = peak - .08, peak + .08
    for _ in range(22):
        first = left + (right - left) / 3
        second = right - (right - left) / 3
        if spectral_energy(samples, first) < spectral_energy(samples, second):
            left = first
        else:
            right = second
    return (left + right) / 2


def bandlimited_stretch(samples, stretch):
    positions = np.arange(SOURCE_FRAMES, dtype=np.float64) / stretch
    radius = 16
    offsets = np.arange(-radius + 1, radius + 1)
    indices = np.floor(positions).astype(np.int64)[:, None] + offsets
    delta = positions[:, None] - indices
    weights = np.sinc(delta) * np.sinc(delta / radius)
    valid = (indices >= 0) & (indices < samples.size) & (np.abs(delta) < radius)
    weights *= valid
    weights /= np.sum(weights, axis=1, keepdims=True)
    return np.sum(samples[np.clip(indices, 0, samples.size - 1)] * weights, axis=1)


def wav_bytes(samples):
    output = io.BytesIO()
    pcm = np.clip(np.rint(samples), -32768, 32767).astype('<i2')
    with wave.open(output, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    return output.getvalue()


def main():
    repo = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
    root = os.path.dirname(repo)
    destinations = [
        os.path.join(root, 'assets', 'audio', 'piano'),
        os.path.join(repo, 'assets', 'audio', 'piano')
    ]
    for name, target in zip(NAMES, TARGETS):
        original = read_original(repo, name)
        measured = measure_frequency(original, target)
        tuned = bandlimited_stretch(original, measured / target)
        data = wav_bytes(tuned)
        for directory in destinations:
            with open(os.path.join(directory, f'{name}.wav'), 'wb') as output:
                output.write(data)
        result = measure_frequency(tuned, target)
        cents = 1200 * np.log2(result / target)
        print(f'{name}: {measured:.3f}Hz -> {result:.3f}Hz ({cents:+.3f} cents)')


if __name__ == '__main__':
    main()
