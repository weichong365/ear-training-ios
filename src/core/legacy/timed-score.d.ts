declare const timedScoreCore: {
  scoreTimedDictation: (
    kind: string,
    points: number,
    meterCorrect: boolean,
    keyCorrect: boolean,
    correctBars: number,
  ) => number;
};

export = timedScoreCore;
