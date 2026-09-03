// Metro 需要静态 require 才能把 22 个离线钢琴定音采样打进 iOS 包。
export const NOTE_ASSETS: Record<number, number> = {
  60: require('../../assets/audio/piano/C4.wav'),
  61: require('../../assets/audio/piano/Cs4.wav'),
  62: require('../../assets/audio/piano/D4.wav'),
  63: require('../../assets/audio/piano/Ds4.wav'),
  64: require('../../assets/audio/piano/E4.wav'),
  65: require('../../assets/audio/piano/F4.wav'),
  66: require('../../assets/audio/piano/Fs4.wav'),
  67: require('../../assets/audio/piano/G4.wav'),
  68: require('../../assets/audio/piano/Gs4.wav'),
  69: require('../../assets/audio/piano/A4.wav'),
  70: require('../../assets/audio/piano/As4.wav'),
  71: require('../../assets/audio/piano/B4.wav'),
  72: require('../../assets/audio/piano/C5.wav'),
  73: require('../../assets/audio/piano/Cs5.wav'),
  74: require('../../assets/audio/piano/D5.wav'),
  75: require('../../assets/audio/piano/Ds5.wav'),
  76: require('../../assets/audio/piano/E5.wav'),
  77: require('../../assets/audio/piano/F5.wav'),
  78: require('../../assets/audio/piano/Fs5.wav'),
  79: require('../../assets/audio/piano/G5.wav'),
  80: require('../../assets/audio/piano/Gs5.wav'),
  81: require('../../assets/audio/piano/A5.wav'),
};

// 低音复盘键盘使用专门的短采样；题目合成仍只加载上面的 C4-A5 精确采样。
export const PIANO_NOTE_ASSETS: Record<number, number> = {
  ...NOTE_ASSETS,
  55: require('../../assets/audio/piano/G3.wav'),
  59: require('../../assets/audio/piano/B3.wav'),
};
