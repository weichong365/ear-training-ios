from PIL import Image
import os, glob

src_dir = r'F:\WorkBuddy\练耳大师\ios-app\app-store-pages\screenshots'
files = sorted(glob.glob(os.path.join(src_dir, '0*.png')))
print(f'原始 {len(files)} 张:', [os.path.basename(f) for f in files])
print()

for f in files:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    if (w, h) == (1284, 2778):
        print(f'  ✓ {os.path.basename(f)} 已是 1284x2778，跳过')
        continue
    new = im.resize((1284, 2778), Image.LANCZOS)
    new.save(f, 'PNG', optimize=True)
    print(f'  ↻ {os.path.basename(f)} {w}x{h} -> 1284x2778')

print()
print('===== 验证 =====')
for f in files:
    im = Image.open(f)
    print(f'  {os.path.basename(f)}: {im.size} {im.mode}')