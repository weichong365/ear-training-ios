"""
把 C4.wav 向下重采样，生成 G3~B3（MIDI 55~59）的 5 个精确钢琴采样。
采样规格与现有库一致：16kHz / mono / PCM16 / 1.82s（29120 样本）。
重采样采用线性插值（向下移调 = 拉伸时间轴，无需抗混叠）。
"""
import struct
import math
import os

SAMPLE_RATE = 16000
TARGET_LEN = 29120  # 1.82s，与 C4-A5 精确采样等长

def read_pcm(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[0:4] == b'RIFF' and data[8:12] == b'WAVE', 'not a wav'
    sr = struct.unpack('<I', data[24:28])[0]
    ch = struct.unpack('<H', data[22:24])[0]
    bits = struct.unpack('<H', data[34:36])[0]
    assert sr == SAMPLE_RATE and ch == 1 and bits == 16, 'unexpected format'
    off = 12
    while off + 8 <= len(data):
        cid = data[off:off+4]
        sz = struct.unpack('<I', data[off+4:off+8])[0]
        body = off + 8
        if cid == b'data':
            raw = data[body:body+sz]
            n = len(raw) // 2
            return [struct.unpack('<h', raw[i*2:i*2+2])[0] for i in range(n)]
        off = body + sz + (sz % 2)
    raise RuntimeError('no data chunk')

def write_wav(path, samples):
    n = len(samples)
    data = bytearray()
    for s in samples:
        v = max(-32768, min(32767, int(s)))
        data += struct.pack('<h', v)
    with open(path, 'wb') as f:
        f.write(b'RIFF')
        f.write(struct.pack('<I', 36 + len(data)))
        f.write(b'WAVE')
        f.write(b'fmt ')
        f.write(struct.pack('<I', 16))
        f.write(struct.pack('<H', 1))       # PCM
        f.write(struct.pack('<H', 1))       # mono
        f.write(struct.pack('<I', SAMPLE_RATE))
        f.write(struct.pack('<I', SAMPLE_RATE * 2))  # byte rate
        f.write(struct.pack('<H', 2))       # block align
        f.write(struct.pack('<H', 16))      # bits
        f.write(b'data')
        f.write(struct.pack('<I', len(data)))
        f.write(data)

def resample_down(src, semitones):
    """向下移调 semitones 个半音（时间轴拉伸），输出截断到 TARGET_LEN。"""
    ratio = 2 ** (semitones / 12)  # >1
    n = len(src)
    out = []
    for j in range(TARGET_LEN):
        pos = j / ratio
        i0 = int(pos)
        frac = pos - i0
        i1 = i0 + 1
        if i1 >= n:
            v = src[min(i0, n - 1)]
        else:
            v = src[i0] * (1 - frac) + src[i1] * frac
        out.append(v)
    return out

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    piano_dir = os.path.normpath(os.path.join(here, '..', 'assets', 'audio', 'piano'))
    src_path = os.path.join(piano_dir, 'C4.wav')
    src = read_pcm(src_path)

    # semitones below C4 (60) -> target midi & filename
    targets = [
        (1, 59, 'B3.wav'),
        (2, 58, 'As3.wav'),
        (3, 57, 'A3.wav'),
        (4, 56, 'Gs3.wav'),
        (5, 55, 'G3.wav'),
    ]
    for semitones, midi, fname in targets:
        out = resample_down(src, semitones)
        out_path = os.path.join(piano_dir, fname)
        write_wav(out_path, out)
        print(f'wrote {fname} (MIDI {midi}, -{semitones}st)  {len(out)} samples')

if __name__ == '__main__':
    main()
