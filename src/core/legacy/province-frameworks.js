'use strict';

/**
 * 各省听音考试卷面结构。
 *
 * points 表示该 section 的总分；资料未注明时为 null。
 * cue 使用以下稳定值：none、standardTone、countIn、tempoCue、
 * standardTone+countIn、standardTone+tonicChord+tempoCue、mixed。
 */
var PROVINCE_FRAMEWORKS = {
  national: {
    id: 'national',
    label: '全国通用模板',
    template: 'staff',
    sourceYears: [],
    sourceConfirmed: false,
    variants: [{
      year: '通用',
      title: '全国音乐类专业招生考试模拟训练',
      fullScore: 30,
      sections: [
        { key: 'single', title: '单音', count: 5, repeats: 3, points: 5, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '旋律音组：三音组、五音组', count: 4, repeats: 3, points: 4, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
        { key: 'interval', title: '旋律音程与和声音程', count: 4, repeats: 3, points: 4, cue: 'standardTone', melodicCount: 2, harmonicCount: 2, answerMode: 'staff' },
        { key: 'connection', title: '音程连接', count: 1, repeats: 3, points: 5, cue: 'standardTone', intervalCount: 5, answerMode: 'staff' },
        { key: 'chord', title: '和弦', count: 5, repeats: 3, points: 5, cue: 'standardTone', answerMode: 'staff' },
        { key: 'rhythm', title: '听写节奏', count: 1, repeats: 3, points: 3, cue: 'countIn', bars: 4, systems: 2, answerMode: 'rhythmStaff' },
        { key: 'melody', title: '听写单声部旋律', count: 1, repeats: 4, points: 4, cue: 'standardTone+countIn', bars: 8, systems: 4, answerMode: 'melodyStaff' }
      ]
    }]
  },

  guangxi: {
    id: 'guangxi',
    label: '广西',
    template: 'staff',
    sourceYears: ['2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2025',
      title: '广西艺术统考听音模拟训练',
      fullScore: 30,
      sections: [
        { key: 'single', title: '听记单音', count: 5, repeats: 3, points: 2.5, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '听记音组', count: 4, repeats: 3, points: 4, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
        { key: 'interval', title: '听记音程', count: 4, repeats: 3, points: 2, cue: 'standardTone', melodicCount: 2, harmonicCount: 2, answerMode: 'staff' },
        { key: 'chord', title: '听记和弦', count: 4, repeats: 3, points: 3, cue: 'standardTone', answerMode: 'staff' },
        { key: 'rhythm', title: '节奏', count: 1, repeats: 4, points: 4, cue: 'countIn', bars: 8, systems: 2, meter: '2/4', answerMode: 'rhythmStaff' },
        { key: 'melody', title: '单声部旋律', count: 1, repeats: 6, points: 14.5, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'F', answerMode: 'melodyStaff' }
      ]
    }]
  },

  jiangsu: {
    id: 'jiangsu',
    label: '江苏',
    template: 'jiangsu',
    sourceYears: ['2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2025',
      title: '江苏省音乐类专业招生考试模拟训练',
      fullScore: 100,
      sections: [
        { key: 'single', title: '听写单音', count: 5, repeats: 3, points: 2.5, cue: 'standardTone', answerMode: 'staff' },
        {
          key: 'group', title: '听写旋律音组', count: 5, repeats: 3, points: 9.5, cue: 'standardTone',
          groupSizes: [3, 3, 3, 5, 5], answerMode: 'staff',
          items: [
            { key: 'threeNoteGroups', title: '三音组', count: 3, repeats: 3, points: 1.5, cue: 'standardTone', groupSizes: [3, 3, 3], answerMode: 'staff' },
            { key: 'fiveNoteGroups', title: '五音组', count: 2, repeats: 3, points: 8, cue: 'standardTone', groupSizes: [5, 5], answerMode: 'staff' }
          ]
        },
        {
          key: 'interval', title: '听写旋律音程与和声音程', count: 8, repeats: 3, points: 14, cue: 'standardTone',
          melodicCount: 2, harmonicCount: 6, answerMode: 'mixed', qualityRequired: true,
          items: [
            { key: 'intervalQuality', title: '听记音程的性质', count: 4, repeats: 3, points: 6, cue: 'standardTone', melodicCount: 2, harmonicCount: 2, answerMode: 'choiceFill', qualityRequired: true },
            { key: 'intervalPitch', title: '听写音程的音高', count: 4, repeats: 3, points: 8, cue: 'standardTone', melodicCount: 0, harmonicCount: 4, answerMode: 'staff' }
          ]
        },
        { key: 'chord', title: '听写和弦', count: 6, repeats: 3, points: 18, cue: 'standardTone', answerMode: 'staff' },
        {
          key: 'rhythm', title: '听写节奏', count: 2, repeats: 4, points: 24, cue: 'tempoCue', answerMode: 'rhythmStaff',
          items: [
            { key: 'rhythm1', title: '节奏 1', count: 1, repeats: 4, points: 12, cue: 'tempoCue', bars: 4, systems: 2, meter: '2/4', answerMode: 'rhythmStaff' },
            { key: 'rhythm2', title: '节奏 2', count: 1, repeats: 4, points: 12, cue: 'tempoCue', bars: 4, systems: 2, meter: '3/4', answerMode: 'rhythmStaff' }
          ]
        },
        {
          key: 'melody', title: '听写单声部旋律', count: 2, repeats: 5, points: 32, cue: 'standardTone+countIn', answerMode: 'melodyStaff',
          items: [
            { key: 'melody1', title: '旋律 1', count: 1, repeats: 5, points: 16, cue: 'standardTone+countIn', bars: 4, systems: 2, meter: '3/4', answerMode: 'melodyStaff' },
            { key: 'melody2', title: '旋律 2', count: 1, repeats: 5, points: 16, cue: 'standardTone+countIn', bars: 4, systems: 2, meter: '6/8', answerMode: 'melodyStaff' }
          ]
        }
      ]
    }]
  },

  chongqing: {
    id: 'chongqing',
    label: '重庆',
    template: 'staff',
    sourceYears: ['2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2025',
      title: '重庆市音乐统考练耳模拟训练',
      fullScore: null,
      sections: [
        { key: 'single', title: '单音', count: 8, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '旋律音组', count: 4, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
        { key: 'interval', title: '旋律音程与和声音程', count: 6, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', melodicCount: 3, harmonicCount: 3, answerMode: 'staff' },
        { key: 'chord', title: '和弦', count: 6, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', answerMode: 'staff' },
        { key: 'rhythm', title: '节奏', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'countIn', bars: 8, systems: 2, meter: '6/8', answerMode: 'rhythmStaff' },
        {
          key: 'melody', title: '单声部旋律', count: 2, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone+countIn', answerMode: 'melodyStaff',
          items: [
            { key: 'melody1', title: '旋律 1', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '2/4', keySignature: 'F', answerMode: 'melodyStaff' },
            { key: 'melody2', title: '旋律 2', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'C', answerMode: 'melodyStaff' }
          ]
        }
      ]
    }]
  },

  gansu: {
    id: 'gansu',
    label: '甘肃',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2024-2025',
      title: '甘肃省音乐统考练耳模拟训练',
      fullScore: null,
      sections: [
        { key: 'single', title: '单音', count: 5, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '旋律音组', count: 3, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', groupSizes: [3, 3, 5], answerMode: 'staff' },
        { key: 'interval', title: '旋律音程与和声音程', count: 7, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', melodicCount: 2, harmonicCount: 5, answerMode: 'staff' },
        { key: 'chord', title: '和弦', count: 5, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', answerMode: 'staff' },
        {
          key: 'rhythm', title: '节奏', count: 2, repeats: 3, repeatSource: 'fallback', points: null, cue: 'countIn', answerMode: 'rhythmStaff',
          items: [
            { key: 'rhythm1', title: '节奏 1', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'countIn', bars: 8, systems: 2, meter: '2/4', answerMode: 'rhythmStaff' },
            { key: 'rhythm2', title: '节奏 2', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'countIn', bars: 8, systems: 2, meter: '3/4', answerMode: 'rhythmStaff' }
          ]
        },
        {
          key: 'melody', title: '单声部旋律', count: 2, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone+countIn', answerMode: 'melodyStaff',
          items: [
            { key: 'melody1', title: '旋律 1', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '2/4', keySignature: 'G', answerMode: 'melodyStaff' },
            { key: 'melody2', title: '旋律 2', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'F', answerMode: 'melodyStaff' }
          ]
        }
      ]
    }]
  },

  hebei: {
    id: 'hebei',
    label: '河北',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2024-2025',
      title: '河北省音乐统考练耳模拟训练',
      fullScore: null,
      sections: [
        { key: 'single', title: '单音', count: 5, repeats: 2, points: null, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '旋律音组', count: 4, repeats: 2, points: null, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
        { key: 'interval', title: '和声音程与旋律音程', count: 5, repeats: 3, points: null, cue: 'standardTone', melodicCount: 2, harmonicCount: 3, answerMode: 'staff+quality', qualityRequired: true },
        { key: 'chord', title: '和弦', count: 5, repeats: 3, points: null, cue: 'standardTone', answerMode: 'staff+quality', qualityRequired: true },
        { key: 'rhythm', title: '节奏', count: 1, repeats: 3, points: null, cue: 'countIn', bars: 8, systems: 2, answerMode: 'rhythmStaff' },
        { key: 'melody', title: '单声部旋律', count: 1, repeats: 4, points: null, cue: 'standardTone+countIn', bars: 8, systems: 2, answerMode: 'melodyStaff' }
      ]
    }]
  },

  henan: {
    id: 'henan',
    label: '河南',
    template: 'choice',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2024-2025',
      title: '河南省音乐统考听音选择模拟训练',
      fullScore: 120,
      sourceIncomplete: true,
      sections: [
        { key: 'choiceAural', title: '听音选择（一）', count: 16, repeats: 2, points: 80, cue: 'mixed', answerMode: 'choice' },
        { key: 'choiceRhythmMelody', title: '听音选择（二）', count: 8, repeats: 2, points: 40, cue: 'mixed', answerMode: 'choice' }
      ],
      choiceGroups: [
        {
          key: 'choiceAural', title: '听音选择（一）', count: 16, repeats: 2, points: 80, cue: 'mixed',
          items: [
            { key: 'single', title: '单音', count: 4, repeats: 2, points: 20, cue: 'standardTone', answerMode: 'choice' },
            { key: 'group', title: '音组', count: 4, repeats: 2, points: 20, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'choice' },
            { key: 'melodicIntervalPitch', title: '旋律音程音高', count: 1, repeats: 2, points: 5, cue: 'standardTone', answerMode: 'choice' },
            { key: 'melodicIntervalQuality', title: '旋律音程性质', count: 1, repeats: 2, points: 5, cue: 'none', answerMode: 'choice', qualityRequired: true },
            { key: 'harmonicIntervalPitch', title: '和声音程音高', count: 1, repeats: 2, points: 5, cue: 'standardTone', answerMode: 'choice' },
            { key: 'harmonicIntervalQuality', title: '和声音程性质', count: 1, repeats: 2, points: 5, cue: 'none', answerMode: 'choice', qualityRequired: true },
            { key: 'chordPitch', title: '和弦音高', count: 3, repeats: 2, points: 15, cue: 'standardTone', answerMode: 'choice' },
            { key: 'chordQuality', title: '和弦性质', count: 1, repeats: 2, points: 5, cue: 'none', answerMode: 'choice', qualityRequired: true }
          ]
        },
        {
          key: 'choiceRhythmMelody', title: '听音选择（二）', count: 8, repeats: 2, points: 40, cue: 'countIn',
          items: [
            { key: 'rhythm', title: '节奏', count: 4, repeats: 2, points: 20, cue: 'countIn', answerMode: 'choice' },
            { key: 'melody', title: '旋律', count: 4, repeats: 2, points: 20, cue: 'countIn', answerMode: 'choice' }
          ]
        }
      ]
    }]
  },

  heilongjiang: {
    id: 'heilongjiang',
    label: '黑龙江',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [
      {
        year: '2024',
        title: '2024 年黑龙江省音乐统考练耳模拟训练',
        fullScore: 100,
        sections: [
          { key: 'single', title: '单音', count: 5, repeats: 3, points: 5, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '旋律音组', count: 2, repeats: 3, points: 10, cue: 'standardTone', groupSizes: [5, 5], answerMode: 'staff' },
          { key: 'interval', title: '和声音程', count: 5, repeats: 3, points: 10, cue: 'standardTone', melodicCount: 0, harmonicCount: 5, answerMode: 'staff' },
          { key: 'chord', title: '和弦', count: 5, repeats: 3, points: 15, cue: 'standardTone', answerMode: 'staff' },
          { key: 'rhythm', title: '节奏', count: 1, repeats: 4, points: 12, cue: 'countIn', bars: 6, systems: 2, meter: '3/4', answerMode: 'rhythmStaff' },
          {
            key: 'melody', title: '单声部旋律', count: 2, repeats: 6, points: 48, cue: 'standardTone+countIn', answerMode: 'melodyStaff',
            items: [
              { key: 'melody1', title: '旋律 1', count: 1, repeats: 6, points: 24, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '6/8', keySignature: 'G', answerMode: 'melodyStaff' },
              { key: 'melody2', title: '旋律 2', count: 1, repeats: 6, points: 24, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'G', answerMode: 'melodyStaff' }
            ]
          }
        ]
      },
      {
        year: '2025',
        title: '2025 年黑龙江省音乐统考练耳模拟训练',
        fullScore: 100,
        sections: [
          { key: 'single', title: '单音', count: 5, repeats: 3, points: 5, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '旋律音组', count: 4, repeats: 3, points: 16, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
          { key: 'interval', title: '旋律音程与和声音程', count: 4, repeats: 3, points: 8, cue: 'standardTone', melodicCount: 2, harmonicCount: 2, answerMode: 'staff' },
          { key: 'chord', title: '和弦', count: 5, repeats: 3, points: 15, cue: 'standardTone', answerMode: 'staff' },
          {
            key: 'rhythm', title: '节奏', count: 2, repeats: 4, points: 23, cue: 'countIn', answerMode: 'rhythmStaff',
            items: [
              { key: 'rhythm1', title: '节奏 1', count: 1, repeats: 4, points: null, cue: 'countIn', bars: 6, systems: 2, meter: '2/4', answerMode: 'rhythmStaff' },
              { key: 'rhythm2', title: '节奏 2', count: 1, repeats: 4, points: null, cue: 'countIn', bars: 6, systems: 2, meter: '3/4', answerMode: 'rhythmStaff' }
            ]
          },
          { key: 'melody', title: '单声部旋律', count: 1, repeats: 6, points: 33, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '6/8', keySignature: 'F', answerMode: 'melodyStaff' }
        ]
      }
    ]
  },

  hubei: {
    id: 'hubei',
    label: '湖北',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2024-2025',
      title: '湖北省音乐统考练耳模拟训练',
      fullScore: 26,
      sections: [
        { key: 'single', title: '单音', count: 2, repeats: 2, points: 2, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '旋律音组', count: 2, repeats: 3, points: 4, cue: 'standardTone', groupSizes: [3, 5], answerMode: 'staff' },
        { key: 'interval', title: '旋律音程与和声音程', count: 2, repeats: 3, points: 4, cue: 'standardTone', melodicCount: 1, harmonicCount: 1, answerMode: 'staff' },
        { key: 'chord', title: '和弦', count: 2, repeats: 3, points: 4, cue: 'standardTone', answerMode: 'staff' },
        { key: 'rhythm', title: '节奏', count: 1, repeats: 5, points: 4, cue: 'countIn', bars: 4, systems: 1, meter: '3/4', answerMode: 'rhythmStaff' },
        { key: 'melody', title: '单声部旋律', count: 1, repeats: 6, points: 8, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '4/4', keySignature: 'G', answerMode: 'melodyStaff' }
      ]
    }]
  },

  hunan: {
    id: 'hunan',
    label: '湖南',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [
      {
        year: '2024',
        title: '2024 年湖南省音乐统考练耳模拟训练',
        fullScore: null,
        sections: [
          { key: 'single', title: '单音', count: 5, repeats: 3, points: null, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '旋律音组', count: 4, repeats: 3, points: null, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
          { key: 'interval', title: '旋律音程与和声音程', count: 5, repeats: 3, points: null, cue: 'standardTone', melodicCount: 3, harmonicCount: 2, answerMode: 'staff' },
          { key: 'chord', title: '和弦', count: 5, repeats: 3, points: null, cue: 'standardTone', answerMode: 'staff' },
          { key: 'rhythm', title: '节奏', count: 1, repeats: 4, points: null, cue: 'countIn', bars: 4, systems: 1, meter: '3/4', answerMode: 'rhythmStaff' },
          { key: 'melody', title: '单声部旋律', count: 1, repeats: 5, points: null, cue: 'standardTone+tonicChord+countIn', bars: 8, systems: 2, meter: '2/4', keySignature: 'G', answerMode: 'melodyStaff' }
        ]
      },
      {
        year: '2025',
        title: '2025 年湖南省音乐统考练耳模拟训练',
        fullScore: null,
        sections: [
          { key: 'single', title: '单音', count: 5, repeats: 3, points: null, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '旋律音组', count: 4, repeats: 3, points: null, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
          { key: 'interval', title: '旋律音程与和声音程', count: 5, repeats: 3, points: null, cue: 'standardTone', melodicCount: 3, harmonicCount: 2, answerMode: 'staff' },
          { key: 'chord', title: '和弦', count: 5, repeats: 3, points: null, cue: 'standardTone', answerMode: 'staff' },
          { key: 'rhythm', title: '节奏', count: 1, repeats: 4, points: null, cue: 'countIn', bars: 4, systems: 1, meter: '4/4', answerMode: 'rhythmStaff' },
          { key: 'melody', title: '单声部旋律', count: 1, repeats: 5, points: null, cue: 'standardTone+tonicChord+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'F', answerMode: 'melodyStaff' }
        ]
      }
    ]
  },

  jiangxi: {
    id: 'jiangxi',
    label: '江西',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [
      {
        year: '2024',
        title: '2024 年江西省音乐统考练耳模拟训练',
        fullScore: 100,
        sections: [
          { key: 'single', title: '单音', count: 5, repeats: 3, points: 5, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '旋律音组', count: 4, repeats: 3, points: 16, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
          { key: 'interval', title: '旋律音程与和声音程', count: 5, repeats: 3, points: 15, cue: 'standardTone', melodicCount: 2, harmonicCount: 3, answerMode: 'staff' },
          { key: 'connection', title: '和声音程连接', count: 1, repeats: 3, points: 10, cue: 'standardTone', intervalCount: 5, answerMode: 'staff' },
          { key: 'chord', title: '和弦', count: 5, repeats: 3, points: 15, cue: 'standardTone', answerMode: 'staff' },
          { key: 'rhythm', title: '节奏', count: 1, repeats: 4, points: 15, cue: 'countIn', bars: 4, systems: 1, meter: '2/4', answerMode: 'rhythmStaff' },
          { key: 'melody', title: '单声部旋律', count: 1, repeats: 6, points: 24, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'G', answerMode: 'melodyStaff' }
        ]
      },
      {
        year: '2025',
        title: '2025 年江西省音乐统考练耳模拟训练',
        fullScore: 100,
        sections: [
          { key: 'single', title: '单音', count: 5, repeats: 3, points: 5, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '旋律音组', count: 4, repeats: 3, points: 16, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
          { key: 'interval', title: '旋律音程与和声音程', count: 5, repeats: 3, points: 15, cue: 'standardTone', melodicCount: 2, harmonicCount: 3, answerMode: 'staff' },
          { key: 'connection', title: '和声音程连接', count: 1, repeats: 3, points: 10, cue: 'standardTone', intervalCount: 5, answerMode: 'staff' },
          { key: 'chord', title: '和弦', count: 5, repeats: 3, points: 15, cue: 'standardTone', answerMode: 'staff' },
          { key: 'rhythm', title: '节奏', count: 1, repeats: 4, points: 15, cue: 'countIn', bars: 4, systems: 1, meter: '2/4', answerMode: 'rhythmStaff' },
          { key: 'melody', title: '单声部旋律', count: 1, repeats: 6, points: 24, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'F', answerMode: 'melodyStaff' }
        ]
      }
    ]
  },

  liaoning: {
    id: 'liaoning',
    label: '辽宁',
    template: 'staff',
    sourceYears: ['2025', '2026'],
    sourceConfirmed: true,
    variants: [{
      year: '2025-2026',
      title: '辽宁省音乐统考练耳模拟训练',
      fullScore: 100,
      sections: [
        { key: 'single', title: '单音听记', count: 8, repeats: 3, points: 8, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '音组听记', count: 2, repeats: 3, points: 8, cue: 'standardTone', groupSizes: [3, 5], answerMode: 'staff' },
        { key: 'interval', title: '旋律音程听记', count: 3, repeats: 3, points: 6, cue: 'standardTone', melodicCount: 3, harmonicCount: 0, answerMode: 'staff+quality', qualityRequired: true },
        { key: 'interval', title: '和声音程听记', count: 8, repeats: 3, points: 16, cue: 'standardTone', melodicCount: 0, harmonicCount: 8, answerMode: 'staff+quality', qualityRequired: true },
        { key: 'chord', title: '和弦听记', count: 8, repeats: 3, points: 16, cue: 'standardTone', answerMode: 'staff+quality', qualityRequired: true },
        { key: 'rhythm', title: '节奏听记', count: 1, repeats: 5, points: 20, cue: 'countIn', bars: 8, systems: 2, meter: '2/4', answerMode: 'rhythmStaff' },
        { key: 'melody', title: '旋律听记', count: 1, repeats: 6, points: 26, cue: 'standardTone+tonicChord+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'G', answerMode: 'melodyStaff' }
      ]
    }]
  },

  neimenggu: {
    id: 'neimenggu',
    label: '内蒙古',
    template: 'staff',
    sourceYears: ['2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2025',
      title: '内蒙古音乐统考练耳模拟训练',
      fullScore: 100,
      sections: [
        { key: 'single', title: '单音听记', count: 10, repeats: 3, points: 10, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '音组听记', count: 4, repeats: 3, points: 16, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
        { key: 'interval', title: '音程听记', count: 8, repeats: 3, points: 16, cue: 'standardTone', melodicCount: 4, harmonicCount: 4, answerMode: 'staff+quality', qualityRequired: true },
        { key: 'chordQuality', title: '和弦听记（记录性质）', count: 6, repeats: 3, points: 12, cue: 'standardTone', answerMode: 'qualityFill', qualityRequired: true },
        {
          key: 'rhythm', title: '节奏听记', count: 2, repeats: 5, points: 22, cue: 'countIn', answerMode: 'rhythmStaff',
          items: [
            { key: 'rhythm1', title: '节奏 1', count: 1, repeats: 5, points: 11, cue: 'countIn', bars: 4, systems: 1, meter: '2/4', answerMode: 'rhythmStaff' },
            { key: 'rhythm2', title: '节奏 2', count: 1, repeats: 5, points: 11, cue: 'countIn', bars: 4, systems: 1, meter: '3/4', answerMode: 'rhythmStaff' }
          ]
        },
        {
          key: 'melody', title: '旋律听记', count: 2, repeats: 6, points: 24, cue: 'standardTone+countIn', answerMode: 'melodyStaff',
          items: [
            { key: 'melody1', title: '旋律 1', count: 1, repeats: 6, points: 12, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'F', answerMode: 'melodyStaff' },
            { key: 'melody2', title: '旋律 2', count: 1, repeats: 6, points: 12, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '6/8', keySignature: 'C', answerMode: 'melodyStaff' }
          ]
        }
      ]
    }]
  },

  shandong: {
    id: 'shandong',
    label: '山东',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [
      {
        year: '2024',
        title: '2024 年山东省音乐统考听写模拟训练',
        fullScore: 100,
        sections: [
          { key: 'single', title: '单音听写', count: 5, repeats: 3, points: 5, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '音组听写', count: 3, repeats: 3, points: 11, cue: 'standardTone', groupSizes: [3, 3, 5], answerMode: 'staff' },
          { key: 'interval', title: '和声音程听写，并标记性质', count: 4, repeats: 3, points: 12, cue: 'standardTone', melodicCount: 0, harmonicCount: 4, answerMode: 'staff+quality', qualityRequired: true },
          { key: 'chordQuality', title: '和弦性质听写，只记性质不记音高', count: 4, repeats: 3, points: 8, cue: 'none', answerMode: 'qualityFill', qualityRequired: true },
          { key: 'chordPitch', title: '和弦音高听写，只记音高不记性质', count: 4, repeats: 3, points: 8, cue: 'standardTone', answerMode: 'staff' },
          {
            key: 'rhythm', title: '节奏听写', count: 2, repeats: 4, points: 26, cue: 'tempoCue', answerMode: 'rhythmStaff',
            items: [
              { key: 'rhythm1', title: '节奏 1', count: 1, repeats: 4, points: 14, cue: 'tempoCue', bars: 4, systems: 1, meter: '2/4', answerMode: 'rhythmStaff' },
              { key: 'rhythm2', title: '节奏 2', count: 1, repeats: 4, points: 12, cue: 'tempoCue', bars: 4, systems: 1, meter: '3/4', answerMode: 'rhythmStaff' }
            ]
          },
          {
            key: 'melody', title: '单声部旋律听写', count: 2, repeats: 4, points: 30, cue: 'standardTone+tonicChord+tempoCue', answerMode: 'melodyStaff',
            items: [
              { key: 'melody1', title: '旋律 1', count: 1, repeats: 4, points: 15, cue: 'standardTone+tonicChord+tempoCue', bars: 8, systems: 2, meter: '3/4', keySignature: 'G', answerMode: 'melodyStaff' },
              { key: 'melody2', title: '旋律 2', count: 1, repeats: 4, points: 15, cue: 'standardTone+tonicChord+tempoCue', bars: 8, systems: 2, meter: '6/8', keySignature: 'F', answerMode: 'melodyStaff' }
            ]
          }
        ]
      },
      {
        year: '2025',
        title: '2025 年山东省音乐统考听写模拟训练',
        fullScore: 100,
        sections: [
          { key: 'single', title: '单音听写', count: 5, repeats: 3, points: 5, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '音组听写', count: 3, repeats: 3, points: 11, cue: 'standardTone', groupSizes: [3, 3, 5], answerMode: 'staff' },
          { key: 'interval', title: '和声音程听写，并标记性质', count: 4, repeats: 3, points: 12, cue: 'standardTone', melodicCount: 0, harmonicCount: 4, answerMode: 'staff+quality', qualityRequired: true },
          { key: 'chordQuality', title: '和弦性质听写，只记性质不记音高', count: 4, repeats: 3, points: 8, cue: 'none', answerMode: 'qualityFill', qualityRequired: true },
          { key: 'chordPitch', title: '和弦音高听写，只记音高不记性质', count: 4, repeats: 3, points: 8, cue: 'standardTone', answerMode: 'staff' },
          {
            key: 'rhythm', title: '节奏听写', count: 2, repeats: 4, points: 26, cue: 'tempoCue', answerMode: 'rhythmStaff',
            items: [
              { key: 'rhythm1', title: '节奏 1', count: 1, repeats: 4, points: 14, cue: 'tempoCue', bars: 4, systems: 1, meter: '2/4', answerMode: 'rhythmStaff' },
              { key: 'rhythm2', title: '节奏 2', count: 1, repeats: 4, points: 12, cue: 'tempoCue', bars: 4, systems: 1, meter: '6/8', answerMode: 'rhythmStaff' }
            ]
          },
          {
            key: 'melody', title: '单声部旋律听写', count: 2, repeats: 4, points: 30, cue: 'standardTone+tonicChord+tempoCue', answerMode: 'melodyStaff',
            items: [
              { key: 'melody1', title: '旋律 1', count: 1, repeats: 4, points: 15, cue: 'standardTone+tonicChord+tempoCue', bars: 8, systems: 2, meter: '3/4', keySignature: 'F', answerMode: 'melodyStaff' },
              { key: 'melody2', title: '旋律 2', count: 1, repeats: 4, points: 15, cue: 'standardTone+tonicChord+tempoCue', bars: 8, systems: 2, meter: '6/8', keySignature: 'G', answerMode: 'melodyStaff' }
            ]
          }
        ]
      }
    ]
  },

  shanxi: {
    id: 'shanxi',
    label: '山西',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    variants: [
      {
        year: '2024',
        title: '2024 年山西省音乐统考练耳模拟训练',
        fullScore: 100,
        sections: [
          { key: 'single', title: '单音听记', count: 14, repeats: 3, points: 14, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '音组听记', count: 4, repeats: 4, points: 16, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
          { key: 'interval', title: '音程听记', count: 8, repeats: 4, points: 16, cue: 'standardTone', melodicCount: 4, harmonicCount: 4, answerMode: 'staff' },
          { key: 'chord', title: '和弦听记', count: 6, repeats: 4, points: 18, cue: 'standardTone', answerMode: 'staff' },
          { key: 'rhythm', title: '节奏听记', count: 1, repeats: 6, points: 12, cue: 'countIn', bars: 8, systems: 2, meter: '4/4', answerMode: 'rhythmStaff' },
          { key: 'melody', title: '旋律听记', count: 1, repeats: 6, points: 24, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'G', answerMode: 'melodyStaff' }
        ]
      },
      {
        year: '2025',
        title: '2025 年山西省音乐统考练耳模拟训练',
        fullScore: 100,
        sections: [
          { key: 'single', title: '单音听记', count: 14, repeats: 3, points: 14, cue: 'standardTone', answerMode: 'staff' },
          { key: 'group', title: '音组听记', count: 4, repeats: 4, points: 16, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
          { key: 'interval', title: '音程听记', count: 8, repeats: 4, points: 16, cue: 'standardTone', melodicCount: 4, harmonicCount: 4, answerMode: 'staff' },
          { key: 'chord', title: '和弦听记', count: 6, repeats: 4, points: 18, cue: 'standardTone', answerMode: 'staff' },
          { key: 'rhythm', title: '节奏听记', count: 1, repeats: 6, points: 12, cue: 'countIn', bars: 8, systems: 2, meter: '2/4', answerMode: 'rhythmStaff' },
          { key: 'melody', title: '旋律听记', count: 1, repeats: 6, points: 24, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '4/4', keySignature: 'F', answerMode: 'melodyStaff' }
        ]
      }
    ]
  },

  shaanxi: {
    id: 'shaanxi',
    label: '陕西',
    template: 'staff',
    sourceYears: ['2024', '2025'],
    sourceConfirmed: true,
    sourceConflict: true,
    variants: [{
      year: '2024-2025',
      title: '陕西省音乐统考练耳模拟训练',
      fullScore: null,
      sourceConflict: true,
      sections: [
        { key: 'single', title: '单音', count: 5, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', answerMode: 'staff' },
        { key: 'group', title: '旋律音组', count: 4, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', groupSizes: [3, 3, 5, 5], answerMode: 'staff' },
        { key: 'interval', title: '旋律音程与和声音程', count: 5, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', melodicCount: 3, harmonicCount: 2, answerMode: 'staff+quality', qualityRequired: true },
        { key: 'chord', title: '和弦', count: 4, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone', answerMode: 'staff+quality', qualityRequired: true },
        { key: 'rhythm', title: '节奏', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'countIn', bars: 4, systems: 1, meter: '2/4', answerMode: 'rhythmStaff' },
        { key: 'melody', title: '单声部旋律', count: 1, repeats: 3, repeatSource: 'fallback', points: null, cue: 'standardTone+countIn', bars: 8, systems: 2, meter: '3/4', keySignature: 'G', answerMode: 'melodyStaff' }
      ]
    }]
  },

  zhejiang: {
    id: 'zhejiang',
    label: '浙江',
    template: 'choice',
    sourceYears: ['2025'],
    sourceConfirmed: true,
    variants: [{
      year: '2025',
      title: '2025 年浙江省音乐统考练耳选择模拟训练',
      fullScore: null,
      sourceIncomplete: true,
      sections: [
        { key: 'choice', title: '听觉选择题', count: 15, repeats: 3, points: null, cue: 'mixed', answerMode: 'choice' }
      ],
      choiceGroups: [{
        key: 'choice',
        title: '听觉选择题',
        count: 15,
        repeats: 3,
        points: null,
        cue: 'mixed',
        items: [
          { key: 'noteGroup1', title: '选择所听到的三音组', count: 1, repeats: 3, points: null, cue: 'standardTone', groupSizes: [3], answerMode: 'choiceStaff' },
          { key: 'noteGroup2', title: '选择所听到的三音组', count: 1, repeats: 3, points: null, cue: 'standardTone', groupSizes: [3], answerMode: 'choiceStaff' },
          { key: 'intervalQuality', title: '选择所听到的音程性质', count: 1, repeats: 3, points: null, cue: 'none', answerMode: 'choiceText', qualityRequired: true },
          { key: 'intervalPitch', title: '选择所听到的音程', count: 1, repeats: 3, points: null, cue: 'standardTone', answerMode: 'choiceStaff' },
          { key: 'chordQuality', title: '选择所听到的和弦性质', count: 1, repeats: 3, points: null, cue: 'none', answerMode: 'choiceText', qualityRequired: true },
          { key: 'chordPitch', title: '选择所听到的三和弦', count: 1, repeats: 3, points: null, cue: 'standardTone', answerMode: 'choiceStaff' },
          { key: 'rhythmPattern', title: '选择所听到的节奏', count: 1, repeats: 3, points: null, cue: 'countIn', bars: 4, answerMode: 'choiceStaff' },
          { key: 'rhythmMeter', title: '选择所听节奏的拍号', count: 1, repeats: 3, points: null, cue: 'countIn', answerMode: 'choiceText' },
          { key: 'westernScale', title: '选择所听西洋音阶的调式调性', count: 1, repeats: 3, points: null, cue: 'standardTone', answerMode: 'choiceText' },
          { key: 'pentatonicScale', title: '选择所听五声民族音阶的调式调性', count: 1, repeats: 3, points: null, cue: 'standardTone', answerMode: 'choiceText' },
          { key: 'rhythmOrder', title: '选择所听节奏的排列顺序', count: 1, repeats: 3, points: null, cue: 'countIn', answerMode: 'choiceOrder' },
          { key: 'melodyMeter', title: '选择所听旋律的拍号', count: 1, repeats: 3, points: null, cue: 'countIn', answerMode: 'choiceText' },
          { key: 'missingRhythmBar', title: '选择所听到的空缺节奏小节', count: 1, repeats: 3, points: null, cue: 'countIn', answerMode: 'choiceStaff' },
          { key: 'missingMelodyBar', title: '选择空白小节所缺的旋律片段', count: 1, repeats: 3, points: null, cue: 'countIn', answerMode: 'choiceStaff' },
          { key: 'melodyOrder', title: '选择所听到的旋律顺序排列', count: 1, repeats: 3, points: null, cue: 'countIn', answerMode: 'choiceOrder' }
        ]
      }]
    }]
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getProvinceFramework(id, random) {
  var framework = PROVINCE_FRAMEWORKS[id];
  var variants;
  var value;
  var index;
  var resolved;

  if (!framework) return null;
  variants = framework.variants || [];
  if (!variants.length) return null;
  random = typeof random === 'function' ? random : Math.random;
  value = Number(random());
  if (!isFinite(value)) value = 0;
  value = Math.max(0, Math.min(0.999999999, value));
  index = Math.floor(value * variants.length);
  resolved = clone(variants[index]);
  resolved.id = framework.id;
  resolved.label = framework.label;
  resolved.template = framework.template;
  resolved.sourceYears = framework.sourceYears.slice();
  resolved.sourceConfirmed = framework.sourceConfirmed === true;
  resolved.variantIndex = index;
  if (framework.sourceConflict === true) resolved.sourceConflict = true;
  return resolved;
}

function hasSourceFramework(id) {
  return !!(PROVINCE_FRAMEWORKS[id] && PROVINCE_FRAMEWORKS[id].sourceConfirmed === true);
}

module.exports = {
  PROVINCE_FRAMEWORKS: PROVINCE_FRAMEWORKS,
  provinceFrameworks: PROVINCE_FRAMEWORKS,
  getProvinceFramework: getProvinceFramework,
  hasSourceFramework: hasSourceFramework
};
