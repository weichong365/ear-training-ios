/** 纯函数判题器，页面与自动化测试共用。 */

function sameOrdered(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => samePitch(value, expected[index]));
}

// 五线谱上的升降号属于记谱方式；判题按实际音高（MIDI）比较，允许等音异名。
function samePitch(actual, expected) {
  const left = Number(actual);
  const right = Number(expected);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function sameUnordered(actual, expected) {
  if (actual.length !== expected.length) return false;
  const a = actual.slice().sort((x, y) => x - y);
  const b = expected.slice().sort((x, y) => x - y);
  return sameOrdered(a, b);
}

function judgeQuestion(question, answer) {
  if (!question) return { correct: false };
  switch (question.type) {
    case 'single':
      return { correct: samePitch(answer, question.midis[0]) };
    case 'rhythm':
      return { correct: answer === question.answer };
    case 'chord': {
      const rootOk = answer && answer.rootPc === question.rootPc;
      const nameOk = answer && answer.name === question.chordName;
      const inversionOk = answer && answer.inversion === question.inversion;
      return {
        correct: !!(rootOk && nameOk && inversionOk),
        parts: { rootOk: !!rootOk, nameOk: !!nameOk, inversionOk: !!inversionOk }
      };
    }
    case 'interval':
      return { correct: question.harmonic ? sameUnordered(answer || [], question.answer) : sameOrdered(answer || [], question.answer) };
    case 'intervalConnection':
      return {
        correct: Array.isArray(answer)
          && answer.length === question.answer.length
          && answer.every((chord, index) => sameUnordered(chord || [], question.answer[index]))
      };
    case 'melody':
      return { correct: sameOrdered(answer || [], question.answer) };
    default:
      return { correct: false };
  }
}

module.exports = { judgeQuestion, samePitch, sameOrdered, sameUnordered };
