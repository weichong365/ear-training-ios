"""
把钢琴采样库从 20kHz 统一重采样到 16kHz，以压缩小程序主包体积。
比率 5:4（20000 -> 16000），线性插值；输出 29120 样本（包内 1.82s），
规格保持 mono / PCM16。一次性处理两端目录：
  - ios-app/assets/audio/piano/  （iOS App，27 个）
  - assets/audio/piano/          （小程序，27 个）

用法：python3 resample-piano-16k.py
"""
import struct
import os

SRC_RATE = 20000
DST_RATE = 16000
TARGET_LEN = 29120


def read_pcm(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[0:4] == b'RIFF' and data[8:12] == b'WAVE', f'{path}: not a wav'
    sr = struct.unpack('<I', data[24:28])[0]
    ch = struct.unpack('<H', data[22:24])[0]
    bits = struct.unpack('<H', data[34:36])[0]
    assert sr == SRC_RATE and ch == 1 and bits == 16, \
        f'{path}: unexpected format sr={sr} ch={ch} bits={bits}'
    off = 12
    while off + 8 <= len(data):
        cid = data[off:off + 4]
        sz = struct.unpack('<I', data[off + 4:off + 8])[0]
        body = off + 8
        if cid == b'data':
            raw = data[body:body + sz]
            n = len(raw) // 2
            return [struct.unpack('<h', raw[i * 2:i * 2 + 2])[0] for i in range(n)]
        off = body + sz + (sz % 2)
    raise RuntimeError(f'{path}: no data chunk')


def write_wav(path, samples):
    data = bytearray()
    for s in samples:
        v = max(-32768, min(32767, int(round(s))))
        data += struct.pack('<h', v)
    with open(path, 'wb') as f:
        f.write(b'RIFF')
        f.write(struct.pack('<I', 36 + len(data)))
        f.write(b'WAVE')
        f.write(b'fmt ')
        f.write(struct.pack('<I', 16))
        f.write(struct.pack('<H', 1))            # PCM
        f.write(struct.pack('<H', 1))            # mono
        f.write(struct.pack('<I', DST_RATE))
        f.write(struct.pack('<I', DST_RATE * 2))  # byte rate
        f.write(struct.pack('<H', 2))            # block align
        f.write(struct.pack('<H', 16))           # bits
        f.write(b'data')
        f.write(struct.pack('<I', len(data)))
        f.write(data)


def resample(src):
    n = len(src)
    out = []
    for j in range(TARGET_LEN):
        pos = j * SRC_RATE / DST_RATE  # 源位置（20000/16000 = 1.25）
        i0 = int(pos)
        frac = pos - i0
        i1 = i0 + 1
        if i0 >= n:
            v = 0
        elif i1 >= n:
            v = src[i0]
        else:
            v = src[i0] * (1 - frac) + src[i1] * frac
        out.append(v)
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.normpath(os.path.join(here, '..', '..'))
    dirs = [
        os.path.join(root, 'ios-app', 'assets', 'audio', 'piano'),
        os.path.join(root, 'assets', 'audio', 'piano'),
    ]
    total = 0
    for d in dirs:
        label = 'iOS' if 'ios-app' in d else '小程序'
        for fname in sorted(os.listdir(d)):
            if not fname.endswith('.wav'):
                continue
            p = os.path.join(d, fname)
            src = read_pcm(p)
            out = resample(src)
            write_wav(p, out)
            total += 1
            print(f'[{label}] {fname}: {len(src)} -> {len(out)} samples, {os.path.getsize(p)}B')
    print(f'共处理 {total} 个采样')


if __name__ == '__main__':
    main()
