// 模拟考试听记：拍号是小节分的前提，调号独立计分。
function scoreTimedDictation(kind, points, meterCorrect, keyCorrect, correctBars) {
  const melody = kind === 'melody';
  const bars = melody ? 8 : 6;
  const keyScore = melody && keyCorrect ? 1 : 0;
  const score = keyScore + (meterCorrect ? 2 + (points - (melody ? 3 : 2)) * correctBars / bars : 0);
  return Math.round(score * 100) / 100;
}

module.exports = { scoreTimedDictation };
