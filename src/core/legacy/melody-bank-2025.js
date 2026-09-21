'use strict';

const DURATIONS = { x: .125, t: 1 / 6, s: .25, u: 1 / 3, j: .375, e: .5, v: 2 / 3, d: .75, q: 1, k: 4 / 3, a: 1.5, h: 2, z: 3, w: 4 };
const KEY_NAMES = { C: 'C大调', F: 'F大调', G: 'G大调' };

// 《2025年音乐艺考模拟试卷》60 套参考答案第 7 题，另加 2024-2025 各省统考真题：
// 甘肃 4 条旋律（第 61-64 条）+ 12 省 22 条旋律（第 65-86 条），来源见 PROVINCE_SOURCE_METADATA。
// 每条依次编码为：拍号、调号、8 小节；只接受音名或 r（休止），拍号字符不参与识别。
const ENCODED_MELODY_BANK = [
  '2/4,F|C4dC4sF4eC4e/C5eA4sG4sF4eC4e/D4sE4sF4sBb4sA4sF4sG4sA4s/C5dD5sC5q/D5sA4sC5sD5sF5q/Bb4sD5sC5sA4sG4q/reA4qC5sA4s/D5sC5sG4sA4sF4q',
  '3/4,C|E4aC4eB3eA3e/A4qB4eA4eE4q/F4qB3eC4eD4eA4e/E4hG#4q/A4qG4eC4eF4q/E4qA3eE4eD4q/B3eD4qF4eE4eG#3e/A3aC4sE4sA4q',
  '4/4,G|G4aA4eB4qG4q/D5qE5eD5eB4h/A4eB4eC5qF#4eG4eA4q/B4w/E4aF#4eG4qB4q/D5qE5eD5eB4h/A4qF#4qC5eB4eA4eB4e/G4w',
  '3/8,G|B4sC5sD5dB4s/A4sC5sE5sD5sG4e/G5dF#5sG5sG5s/D5a/E5sD5sC5dG4s/G5sF#5sG5eE5e/D5dC5sB4e/G4a',
  '6/8,F|F5qE5eD5eC5q/D5eBb4eA4eG4a/A4aF5eE5eA4e/C5aC5a/Bb4aD5dG5sF5sE5s/D5qE5eC5qA4e/G4eBb4eD5eC5eE4eG4e/F4qA4eF4a',
  '2/4,F|D4eG4eA4sG4sF4sG4s/rsA4eBb4sA4q/D5eG4eC5sBb4sA4sG#4s/A4h/E4eA4sBb4sC5dC5s/D4eG4sA4sBb4dBb4s/reF4sG4sA4sC5sBb4sA4s/Bb4sG4eG4sF4ere',
  '3/4,C|C5aB4eC5eA4e/G4aE4eC4q/D4eE4eF4eC5eB4uD4uA4u/G4hG#4q/A4eC4qA4eG4q/F4eG3qE4eD4q/B3eC4eD4eF4eG3uE4uD4u/C4z',
  '3/4,C|G3qC4eD4eE4eA4e/G4aE4eC4q/B3eD4eF4aB4e/A4uD4uA4uG4aG#4e/A4qF4eC5eB4eA4e/G4eA4qD4eF4q/B3eG3eF4aB3e/E4dD4sC4h',
  '3/8,C|G4dE4sF4sA4s/G4sB3sC4dC#4s/D4sD5sC5sB4sE4sF4s/G4a/rsC5sB4sG4sA4e/rsF4sE4sC4sD4e/G4eA4sB4sD5sC5s/C5a',
  '6/8,G|B4qD5eG5qF#5e/A5eG5eF#5eE5eG5eD5e/E5eG4qA4eC5eE5e/D5areE5eF#5e/G5qA5eA5eG5eF#5e/E5qG5eF#5eE5eD5e/C5eB4eA4eD5eF#4eC5e/B4eG4qG4a',
  '2/4,F|D5dA4sF4sE4sD4sC5s/Bb4aA4e/G4sE5eF5sE5sG4sA4sBb4s/A4h/D5dD4sC5sB4sC5sD5s/Bb4dA4sG4q/A4eG4eF4dE4s/D4h',
  '4/4,C|E4aA3eB3qC4q/D4eE4eC4eB3eA3h/D4qF4hA4q/G#4eA4eE4z/F4aE4eD4qA4q/E4eF4eE4eD4eC4h/D4qE4hC4eB3e/A3w',
  '4/4,F|F4qG4eA4eC5qBb4q/A4eG4qE4eC4h/D4qG4hBb4eA4e/G4eF4eG4z/D5qC5hBb4eG4e/A4qE4eF4eD4h/E4hBb4qA4eG4e/F4w',
  '3/8,C|A4dC5sB4sA4s/B4qE4e/A4sB4sC5dD5s/E5a/D5dE5sD5sC5s/B4sA4sD4eF4e/E4dG#4sB4sC5s/A4a',
  '6/8,G|B4aA4sG4sA4sB4sC5sD5s/E5aD5a/F#5qA5eG5eE5eB4e/D5qE5eD5a/E5qA4eC5eD5eE5e/D5eG4eC5eB4a/A4qD5eF#4qA4e/G4aG4a',
  '2/4,F|A4aBb4e/A4eF4eE4eD4e/C#4eD4qE4e/A3qD4eE4e/F4dE4sF4eA4e/G4eBb4eD5q/C#5aE5e/D5h',
  '3/4,C|G4qE4eC4eB3eA3e/F4aE4eD4q/A4eC5eF4aE4e/D4uB4uA4uG4h/A4eG#4eA4eF4eD4q/G4eF#4eG4eE4eC4q/B3eD4qF4eG3uE4uD4u/C4z',
  '4/4,F|F4qA4aBb4eC5eD5e/C5zA4q/A4eBb4qG4eA4qF4q/E4eD4eC4z/D4qD5qBb4aC5e/D5hreBb4eA4eG4e/C5qE4qA4qG4eA4e/F4w',
  '3/8,F|F5dE5sD5sA4s/Bb4dA4sG4e/F4sG4sA4sF5srsE5s/D5qA4e/D5sF5sBb4sG4sA4e/A4sC5sF4sD4sE4e/G4sC5sD5eE5sG5s/F5a',
  '6/8,C|C5eA4eC5eB4eA4eG#4e/A4aF4a/E4eD4eC4eB3qA3e/A4eG#4eA4eB4a/C5eA4eB4eD5a/A4eE4eF4eD4a/E4qC5eB4qE4e/A4qG#4eA4a',
  '2/4,G|B4eG4sF#4sE4eB3e/E4aF#4sG4s/A4dB4sC5sB4sC5sE5s/B4h/E5eE4eD5dE5s/C5eE4eA4q/F#4eB4qD#5e/E5h',
  '3/4,C|E4aG3eA3eG3e/C4aD4eE4eC5e/B4qD5eB4eA4eC5e/G4hF#4eG4e/A4aC5eG4eD4e/F4aE4eD4q/B3eC4eD4eG3eF4dB3s/C4z',
  '4/4,C|E4aD4eC4dB3sA3eG3e/A3qD4qF4h/E4qE4dF4sG4eF4eE4eD4e/C4qG3qC4h/A4aA4eG4qF4q/E4eF4eE4eA3eC4h/B3qE4qD4qD4eE4e/C4w',
  '3/8,G|G4dB4sD5e/G5sF#5sG5sE5sD5e/E5sG4sG4eA4sE5s/D5qB4e/G5eF#5sE5sD5e/E5sD5sC5sB4sA4e/D5eE4sC5sB4sA4s/G4a',
  '6/8,C|A4aB4qC5e/F4eC5eB4eA4qB4e/F4eD4eC4aD4e/E4aE4a/D4qE4eF4eA4eG4e/G4eC4eD4eE4a/C5eB4eA4eE4qB4e/A4aA4a',
  '2/4,G|E4eF#4sG4sB4dG4s/A4sG4sF#4sE4sB3q/E4sF#4eG4sA4sD4sD5sC5s/B4h/C5dB4sA4eE5e/B4dA4sG4q/F#4eB4ersA4sG4sB3s/E4h',
  '2/4,C|G4eG4sA4sG4eG4sA4s/C5sA4sC5sD5sE5q/D5eD5sC5sB4eA4sG4s/A4h/A4eA4sC5sD5eE5e/G5eA5sG5sE5q/D5eD5sE5sD5eC5e/C5h',
  '4/4,G|G4aD4eG4eF#4eG4eA4e/B4w/A4qB4eC5eB4qA4eG4e/A4w/A4eE4qA4eC5eB4eC5eD5e/E5zE5q/D5aE5eD5eC5eB4eA4e/G4qD4qG4h',
  '3/8,C|G4eE4sD4sC4e/B3sC4sD4sE4sF4sA4s/C5dB4sA4sD4s/G4a/C5sG4sC5sE5sD5sC5s/B4sD5sC5sB4sA4e/D4sE4sF4sA4sB4sD5s/C5a',
  '6/8,C|E4eF4eE4eC5qB4e/A4eG#4eA4eB4qE4e/E4dF4sE4eA4qG4e/G4eC4eD4eE4a/A4dB4sC5eE5qD5sC5s/B4qA4eE4qG#4e/A4eG#4eA4eD5eC5eB4e/A4aA4a',
  '2/4,F|A4eC5qD5e/F4eE4sD4sC4q/Bb4dG4sBb4sC5sD5e/C5sB4sC5a/D5qBb4eD5e/C5uBb4uA4uG4q/C4eBb4ersE4sA4sG4s/F4h',
  '3/4,C|E4aC4eG3eG#3e/A3eC4qA4eG4q/F4eC4eF4eC5eB4uE4uF4u/G4hG#4q/A4eC5eF4dE4sD4q/G4eB3eA3dG3sE4q/reD4eF4eG3eB3uE4uD4u/C4aD4eC4q',
  '4/4,G|B4eC5eD5hG4q/E5eC5qE5eD5h/D5uA4uG4uF#4qG4qB4eD5e/A4w/E4aF#4eG4qE5q/D5qC5eA4eB4h/F#4dG4sA4eC5eB4qA4q/G4w',
  '3/8,C|G4dE4sF4sA4s/G4eA4sB4sC5e/D5sC5sB4eD5sA4s/G4a/C5jB4xA4sC5sF4e/B4sA4sG4sB4sE4e/D4sE4sF4eG4sB4s/C5a',
  '6/8,G|G4aA4eB4eC5e/D5eG5eF#5eD5a/E5eC5eB4sA4sB4qC5e/D5aD5eE5eF#5e/A5qG5qF#5q/D5eC#5eD5eB4a/C5qE4eF#4eG4eA4e/G4eC5eB4eG4a',
  '2/4,G|E4dG4sF#4eB3e/E4sG4sA4sC5sB4q/C5dB4sA4eE5e/B4h/C5sB4sC5qA4e/F#4eC5eB4q/F#4sB4eG4sF#4eB3e/E4h',
  '3/4,C|E4aC5eB4eA4e/G#4eA4qF4eE4q/B3eC4eG4aA4e/F4uB4uA4uE4h/A4eC5eF4aE4e/D4eA4eE4qA3q/B3qD4qF4q/B3eC4eA3h',
  '4/4,C|C4aD4eE4qA4q/G4eE4qD4eC4h/D4eE4eF4qB3eC4ereE4e/D4w/F4aE4eD4qA4q/G4eC4qD4eE4h/G3eA3eB3eC4eF4qE4q/C4w',
  '3/8,C|C5dB4sA4sC5s/B4dG#4sE4e/A3sB3sC4dD4s/E4a/A4dG#4sA4sC5s/E5eC5sB4sA4e/B4dE4sG#4sB4s/A4a',
  '6/8,C|C4eD4eE4eC5a/B4eA4eG#4sB4sE4a/A4eF4eE4eD4qA3e/C4sB3sC4eD4eE4a/D4eE4eF4eD5a/C5eB4eC5sD5sE5a/D5eC5eB4eE4eG#4eB4e/A4aG#4eA4q',
  '2/4,G|B4eG4sE4sC5dB4s/A4sF#4eD4sB4q/C5dB4sA4sC5sE5e/B4aD#5e/E5eE4sD5sC5q/A4sF#4sG4sA4sB4q/C5dA4sF#4eB4e/E4h',
  '3/4,C|E4aC4eB3eA3e/F4aE4eD4q/B3eC4eD4aG3e/G4eA4eE4h/A4eC4eA4aG4e/F4eA3eF4aE4e/D4eC#4eD4eF4eB3uE4uD4u/A3z',
  '4/4,C|G4aD5eC5qB4eA4e/G4w/A4eC5qF5eE5aD5e/G4w/A4aC5eG4qF4q/E4eD4eE4eG4eD4h/reF4qE4eG4qA4q/G4qD4eE4eC4h',
  '3/8,F|A4dD4sBb4sA4s/G4eF4sG4sA4e/F5sE5sD5eD5sE5s/A4a/Bb4sA4sG4sA4sF4e/A4sG4sF4sG4sE4e/Bb4sA4sF5sE5sC#5sE5s/D5a',
  '6/8,C|G4qE4eF4qA4e/G4eA4sB4sC5eG4a/A4eD4eC5eB4qA4e/G4aG4a/A4eC5eB4eA4eG4eF4e/G4dB4sA4sG4sE4a/D4eA3eG4eF4dE4sD4sE4s/C4qE4eC4a',
  '2/4,F|C4qF4dA4s/C5aB4e/D5eBb4qC5sD5s/C5h/D5dF4sBb4eD5e/C5eB4sC5sA4q/G4eBb4qE4e/F4h',
  '3/4,C|C5aB4eC5eE4e/F4hD4q/B4aC5eD5eF4e/E4hG#4q/A4eA3eA4aG4e/F4eA3eF4eE4eD4q/B3eE4qG#4eB4eE4e/A4z',
  '4/4,C|G4qA4eC5eA4qG4q/E4eG4eD4eE4eC4h/A3qA4hD4q/E4eF4eG4z/C5qA4qF4qG4eA4e/A4qA4eG4eE4h/D4qC4eD4eE4qG4q/E4eD4eC4z',
  '3/8,G|G4eA4sG4sB4e/D5sG5sF#5sE5sD5e/C5sB4sA4eE5e/D5qB4sD5s/G4dA4sF#5sE5s/D5sE5sB4sD5sG5e/D5dA4sB4sA4s/G4a',
  '6/8,C|A4aE5a/D5eC5eB4eA4a/E4eA4eG#4eA4qB4e/A4areA4eB4e/D5aC5eB4q/B4eA4eF4sE4sD4a/E4qE5eD5eC5eB4e/A4aA4a',
  '2/4,F|F4eA4sBb4sC5dBb4s/A4eC5eG4eC4e/F4sG4sA4sBb4sC5sB4sC5e/A4sF5eE5sD5q/C5qD4eC5e/A4eF4eG4dD4s/C4eF4sA4sC5eBb4e/A4uC4uG4uF4q',
  '3/4,C|C5aB4eC5eE4e/G4aA4eF4q/D4qB4aC5e/D5eF4eE4aG#4e/A4aA3eG4eA4e/F4aE4eD4q/B3eC4eD4eF4qG3e/E4dD4sC4h',
  '4/4,G|A4qD5eE5eC5qB4q/D5qA4hB4q/D5qE5eD5eC5qB4eA4e/D5zE4q/A4aG4eA4qD5eE5e/C5eC5eB4qD5qA4q/D5aF#4eE4qG4q/G4w',
  '3/8,F|A4sBb4sC5eA4e/Bb4sF5sE5sD5sC5e/D5sE4sF4sG4sA4sBb4s/C5a/D5sE5sF5eE5sD5s/C5sA4sG4sD4sE4e/Bb4dA4sG4sA4s/F4a',
  '6/8,G|D5aG5eD5eB4e/G4aF#4a/E4qE5eD5qA4e/B4eC5eD5eB4a/E5aA5qG5e/D5eE5eF#5eB4a/A4dB4sD5sE5sC5eB4eA4e/G4eB4eD5eG4a',
  '2/4,F|C5eBb4sA4sG4eD5e/E4eC5eA4sG4sF4e/Bb4sE4eF4sG4eD5e/C5aA4sC5s/D5eF4qBb4sD5s/C5eBb4sA4sG4eD4e/E4eC4e~C4sBb4sA4sG4s/F4h',
  '3/4,C|E4eF4eE4aC4e/B3eA3eG#3h/A3eC4eE4eA4eG#4uA4uB4u/E4hG#4q/A4qF4eD4qA4e/G#4qA4eE4qC4e/B3eC4eD4eF4eE4uB3uC4u/A3z',
  '4/4,G|B3hE4aD#4e/E4eF#4eG4eA4eB4h/E5aF#5eC5qA4q/B4w/B4aB4eC5qB4q/G4qF#4eE4eF#4qB3q/G4aF#4eE4qD#4q/E4w',
  '3/8,C|C5eB4sA4sG4e/rsA4sF4sE4sD4e/E4dC5sB4sE4s/G4a/F4dA4sD5sC5s/A4sB4sG4eE4e/D4sF4sA4sG4sB3sD4s/C4a',
  '6/8,F|C5aA4eG4eF4e/E4eF4eG4eC4a/F4qE4eD5eG4eBb4e/C5areA4eC5e/F5eC5eF5eA5eG5eF5e/E5eF5eG5eF5eE5eD5e/E4sF4sG4sA4sBb4sD5sE5qG5e/F5aF5a',
  '2/4,F|D5aC5e/A4dC5sF4sG4sD4e/F4eD4sF4sG4sA4sC5sD5s/C5sG4sA4a/A4aD5e/F4sD4eF4sA4eG4e/F4sG4sA4eC5dF4s/D4h',
  '3/4,G|G4eD4eB4aG4e/A4eG4eF#4qD4q/F#4aA4eC5uA4uE5u/D5dB4sD5h/E5uE4uE4uC5dB4sA4q/D5uG4uG4uB4dA4sG4q/C5sB4sA4qD4eB4dC5s/B4dA4sG4h',
  '2/4,G|B4dD5sE5eG5e/D5sE5sB4qD5e/G4eE4eA4eD5sB4s/A4aD5e/A4eA4sB4sG4eE4e/D4dE4sG4eA4sB4s/D5eB4eA4dE4s/G4h',
  '3/4,F|D4aF4eA4q/Bb4eA4eG4eF4eE4q/F4eG4eA4eD5qC#5sBb4s/A4z/Bb4dA4sG4eD5eBb4q/Bb4dA4sF4eD5eA4q/G4eF4eE4eC#5eF5eE5e/D5z',
// 以下为 omr-score-to-code 提取的省级统考真题（2024-2025 各省统考第 6/7 题，每条 8 小节）。
  '3/4,G|G4eD4eE4dF#4sG4eA4e/B4qC5eE5eD5q/E5aG4eF#4eG4e/A4qC5eB4eA4q/reE4eC5eA4eB4q/reA4eB4eG4eF#4q/D4aC5eB4eD5e/A4uF#4uA4uG4h',
  '6/8,F|Bb4qF5eE5qC#5e/D5dBb4sA4sG4sA4a/G4qD5eBb4qG4e/A4dG4sF4eE4a/F4eD4sE4sF4eG4qBb4e/A4eD5eF5eE5a/G5qF5eE5qA4e/C#5eD5eE5eD5a',
  '3/4,F|C4aA4eG4eF4e/E4sD4sE4sF4sG4qC4q/D4aBb4eA4uG4uF4u/D4eE4eG4eA4eG4q/C4aA4eG4eF4e/E4sF4sG4sA4sBb4qD4q/C4aD4eE4eBb4e/A4eG4eF4h',
  '6/8,G|E4qB4eG4eF#4eE4e/D#4sE4sF#4sG4sA4sC5sB4a/E5qD#5eE5qC5e/B4dA4sG4eF#4a/E4qB4eG4eF#4eG4e/A4sE5sD#5sE5sG5sE5sF#5a/E5qB4eA4qG4e/F#4dE4sD#4eE4a',
  '3/4,G|E4qF#4qG4eA4e/B4aC5eB4q/A4qB4dA4sG4eA4e/F#4z/E4qE5qB4eA4e/G4eG4qA4eB4eC5e/B4dA4sG4uA4uF#4uA4uG4uD#4u/E4z',
  '3/4,G|B4aC5eA4q/B4eA4eG4qG4eD5e/D#5eE5eE5aC5e/B4qA4h/C5aE5eD5q/B4eF#5eE5qA4eE5e/E5dD5sD5eC5eB4sD5sA4e/G4z',
  '3/4,F|C4aA4eG4eF4e/E4eF4qD4eC4q/D4aBb4eA4eG4e/F4uE4uF4uG4h/C4aA4eG4eF4e/E4eF4qG4eD4q/E4aBb4eA4eD4e/C4uD4uE4uF4h',
  '3/4,G|B4dC5sB4qG4eE4e/A4hF#4q/A4qC5eB4eA4eF#4e/G4eF#4sG4sE4h/B4eE5ereD#5ereE5e/C5eB4eA4aF#4e/G4eB4ereD#4ereG4e/F#4uG4uF#4uE4h',
  '2/4,F|A4aBb4e/C5sC5eF5sE5eC5e/D5qD5uEb5uD5u/C5aF4sE4s/D4dBb4sA4eF4e/G4qreA4sBb4s/C5eG4eBb4sA4sG4sA4s/F4eF4a',
  '2/4,G|G4eG4sA4sB4eE5e/D5sB4sG4eA4q/B4eF#4sA4sG4eE4e/F#4qB3q/B4eA4sB4sG4eE4e/A4eA4sB4sC5q/C5eB4sA4sB4eD#5e/E5qE4q',
  '2/4,G|D5eB4sD5sG4q/B4eB4sD5sE4eG4e/A4eB4sD5sA4q/D5dB4sA4eG4e/E4eE4sG4sD4q/A4eD5sB4sA4sB4sD4sE4s/G4qB4sD5sA4sB4s/A4sG4sE4sG4sD4q',
  '4/4,G|D4qG4eB4eA4eG4eF#4eG4e/A4aF#4eD4h/E4eF#4eG4eA4eC5aA4e/D5aC5eB4h/D4qG4eB4eA4eG4eF#4eG4e/A4eB4eC5eD5eE5h/D5eC5eB4eC5eD5eE4qF#4e/G4qF#4qG4h',
  '3/4,G|E4qG4aF#4e/E4eG4eB4eC5eB4q/A4qC5eB4eA4q/B4dG4sF#4h/E4qG4aF#4e/D4eG4eB4eE5eE5eD5e/C5eB4eA4qG4eF#4e/D#4qE4h',
  '2/4,G|G4aB4e/C5sB4sC5sE5sD5q/C5dB4sA4sG4sF#4sE4s/D4h/G4aE4e/C5sB4sA4sG4sA4q/D5dC5sA4sF#4eD4s/G4h',
  '3/4,F|F4aD4eD4sE4sF4e/E4dC5sBb4eA4a/G4qD4qE4sF4sG4e/A4dE4sF4eG4a/Bb4qF4qD5q/C5qBb4eA4eG4q/F4eF5qE5sD5sC5dE4s/Bb4uA4uG4uF4h',
  '2/4,F|C5eF5qD5sC5s/D5sF5sC5a/A4dF4sG4sF4sG4sA4s/C5h/reF5qD5sC5s/D5eD4qF4sG4s/A4eG4sA4sC5eD4e/G4eF4a',
  '3/4,F|E4aF4eE4q/A4eD5eC5qB4q/E5aE4eC5eD5e/B4hG#4q/E5aA4eE5q/D5dC5sB4qE4q/D4uE4uF4uA4eB4qG#4e/D4eE4eA4h',
  '3/4,G|D5qC5qB4q/A4aB4eC5q/B4eC5eB4eG4eF#4eG4e/A4aF#4eD4q/E4aF#4eG4eC5e/A4qC5eD5eE5q/D5eC5qA4eE4eF#4e/G4z',
  '3/4,G|G4qB4qD5q/C5aB4eA4q/F#4eA4qC5eE5q/D5z/G4qB4qD5q/C5aB4eA4q/E4qC5qB4eA4e/G4z',
  '6/8,G|B4aG4eF#4eE4e/G4qB4eE4qA4sE4s/E5dD#5sC5eA4eB4eC5e/B4eA4eG4sA4sB4a/G5eE5eF#5eG5eF#5eE5e/A4dB4sC5eC5a/E5eA4eC5eB4eG4dF#4s/E4qD#4eE4a',
  '3/4,G|F#4aA4eD5eA4e/F#4qE4dD4sB4q/G4sA4sB4sC5sD5eF#5eE5dD5s/D5qC5h/A4aD5eC5uB4uA4u/G4qD4eG4eB4eD5e/C5eF#5eA4eD5eC5dE4s/G4hrq',
  '6/8,F|A4qD5eF5eE5eC#5e/D5dG4sA4eBb4a/A4eE4eF4eG4qD4e/F4aE4a/A4qD5eF4eF5eE5e/D5dG4sA4eBb4eC#5eD5e/E5qG4eBb4eA4eE4e/F4sG4sA4qD4a',
];

const PROVINCE_SOURCE_METADATA = [
  { sourceProvince: '甘肃', sourceYear: 2024, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2024年甘肃练耳真题第6题（1）' },
  { sourceProvince: '甘肃', sourceYear: 2024, sourceQuestion: 6, sourceItem: 2, sourceLabel: '2024年甘肃练耳真题第6题（2）' },
  { sourceProvince: '甘肃', sourceYear: 2025, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2025年甘肃练耳真题第6题（1）' },
  { sourceProvince: '甘肃', sourceYear: 2025, sourceQuestion: 6, sourceItem: 2, sourceLabel: '2025年甘肃练耳真题第6题（2）' },
  { sourceProvince: '山东', sourceYear: 2024, sourceQuestion: 7, sourceItem: 1, sourceLabel: '2024年山东练耳真题第7题（1）' },
  { sourceProvince: '山东', sourceYear: 2024, sourceQuestion: 7, sourceItem: 2, sourceLabel: '2024年山东练耳真题第7题（2）' },
  { sourceProvince: '山东', sourceYear: 2025, sourceQuestion: 7, sourceItem: 1, sourceLabel: '2025年山东练耳真题第7题（1）' },
  { sourceProvince: '山东', sourceYear: 2025, sourceQuestion: 7, sourceItem: 2, sourceLabel: '2025年山东练耳真题第7题（2）' },
  { sourceProvince: '山西', sourceYear: 2024, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2024年山西练耳真题第6题（1）' },
  { sourceProvince: '广西', sourceYear: 2024, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2024年广西练耳真题第6题（1）' },
  { sourceProvince: '广西', sourceYear: 2025, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2025年广西练耳真题第6题（1）' },
  { sourceProvince: '江西', sourceYear: 2024, sourceQuestion: 7, sourceItem: 1, sourceLabel: '2024年江西练耳真题第7题（1）' },
  { sourceProvince: '江西', sourceYear: 2025, sourceQuestion: 7, sourceItem: 1, sourceLabel: '2025年江西练耳真题第7题（1）' },
  { sourceProvince: '河北', sourceYear: 2024, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2024年河北练耳真题（器乐卷）第6题（1）' },
  { sourceProvince: '河北', sourceYear: 2024, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2024年河北练耳真题（声乐卷）第6题（1）' },
  { sourceProvince: '河北', sourceYear: 2025, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2025年河北练耳真题（器乐卷）第6题（1）' },
  { sourceProvince: '湖北', sourceYear: 2025, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2025年湖北练耳真题第6题（1）' },
  { sourceProvince: '湖南', sourceYear: 2024, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2024年湖南练耳真题第6题（1）' },
  { sourceProvince: '湖南', sourceYear: 2025, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2025年湖南练耳真题第6题（1）' },
  { sourceProvince: '重庆', sourceYear: 2025, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2025年重庆练耳真题第6题（1）' },
  { sourceProvince: '重庆', sourceYear: 2025, sourceQuestion: 6, sourceItem: 2, sourceLabel: '2025年重庆练耳真题第6题（2）' },
  { sourceProvince: '陕西', sourceYear: 2024, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2024年陕西练耳真题第6题（1）' },
  { sourceProvince: '陕西', sourceYear: 2025, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2025年陕西练耳真题第6题（1）' },
  { sourceProvince: '黑龙江', sourceYear: 2024, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2024年黑龙江练耳真题第6题（1）' },
  { sourceProvince: '黑龙江', sourceYear: 2024, sourceQuestion: 6, sourceItem: 2, sourceLabel: '2024年黑龙江练耳真题第6题（2）' },
  { sourceProvince: '黑龙江', sourceYear: 2025, sourceQuestion: 6, sourceItem: 1, sourceLabel: '2025年黑龙江练耳真题第6题（1）' },
];

function toMidi(spelling) {
  const match = spelling.match(/^([A-G])([#b]?)(\d)$/);
  const pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
  const alter = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + pc + alter;
}

function decodeBar(encoded) {
  const events = [];
  const pattern = /([A-G](?:#|b)?\d|r)([xtsujevdaqkhzw])(~?)/g;
  let match;
  while ((match = pattern.exec(encoded))) {
    const rest = match[1] === 'r';
    const event = { duration: DURATIONS[match[2]], rest };
    if (!rest) {
      event.spelling = match[1];
      event.midi = toMidi(match[1]);
    }
    if (match[3]) event.tieToNext = true;
    events.push(event);
  }
  events.forEach(function (event, index) {
    if (event.tieToNext && events[index + 1]) events[index + 1].tieFromPrevious = true;
  });
  return events;
}

const MELODY_BANK_2025 = ENCODED_MELODY_BANK.map(function (encoded, index) {
  const parts = encoded.split('|');
  const header = parts[0].split(',');
  const keySignature = header[1];
  return {
    id: `melody-2025-${String(index + 1).padStart(2, '0')}`,
    sourcePaper: index + 1,
    ...(PROVINCE_SOURCE_METADATA[index - 60] || {}),
    meter: header[0],
    keySignature,
    keyName: KEY_NAMES[keySignature],
    bars: parts[1].split('/').map(decodeBar),
  };
});

module.exports = { MELODY_BANK_2025 };
