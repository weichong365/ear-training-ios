/**
 * 端到端验证：各省 → tier 接线后，生成的题目特征是否真正落入对应档。
 * 数据来源：练耳统考·题型扩充 08 各省难度映射.md
 */
'use strict';

const path = require('path');
const frameworkCore = require('../src/core/legacy/province-frameworks.js');
const questionCore = require('../src/core/legacy/question.js');

const NATURAL_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const pcOf = (m) => ((m % 12) + 12) % 12;

// 与 src/core/provinces.ts PROVINCE_TIER_BY_SECTION 严格同步
const TIER_MAP = {
  national:       { single: 3, group: 3, interval: 3, connection: 3, chord: 3, rhythm: 3, melody: 3 },
  guangxi:        { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  jiangsu:        { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  chongqing:      { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  gansu:          { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  hebei:          { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  heilongjiang:   { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  hubei:          { single: 2, group: 2, interval: 2, chord: 2, rhythm: 2, melody: 2 },
  hunan:          { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  jiangxi:        { single: 3, group: 3, interval: 3, connection: 3, chord: 3, rhythm: 3, melody: 3 },
  liaoning:       { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  neimenggu:      { single: 3, group: 3, interval: 3, chordQuality: 3, rhythm: 3, melody: 3 },
  shandong:       { single: 3, group: 3, interval: 3, chordQuality: 3, chordPitch: 3, rhythm: 3, melody: 3 },
  shanxi:         { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  shaanxi:        { single: 3, group: 3, interval: 3, chord: 3, rhythm: 3, melody: 3 },
  henan:          { choiceAural: 3, choiceRhythmMelody: 3 },
  zhejiang:       { choice: 3 },
};

const frameworkMap = frameworkCore.PROVINCE_FRAMEWORKS;

let fail = 0;
const results = [];

for (const [id, fw] of Object.entries(frameworkMap)) {
  if (!fw.variants || !fw.variants.length) continue;
  // 选择题模板走 choicePaper，不走 generateExamFromSections，本脚本不覆盖
  if (fw.template === 'choice') {
    results.push({ id, expectTier: TIER_MAP[id]?.choiceAural || TIER_MAP[id]?.choice || 3, naturalRatio: 'N/A', chordQualities: '-', intervalsSemity: '-', melodyKeySigs: '-', ok: true, reasons: '选择题模板（跳过生成题实测）' });
    continue;
  }
  const variant = fw.variants[0];
  const sections = variant.sections || [];
  const expandedSections = [];
  for (const section of sections) {
    if (section.items && ['group', 'interval'].includes(section.key)) {
      for (const item of section.items) {
        expandedSections.push({
          ...section,
          ...item,
          key: section.key, // 保留父 section 类型（group/interval）
          sourceSectionKey: item.key,
          sourceSectionTitle: item.title || section.title,
          items: undefined,
        });
      }
    } else {
      expandedSections.push({ ...section });
    }
  }

  const tierMap = TIER_MAP[id] || TIER_MAP.national;
  const sectionsWithTier = expandedSections.map((section) => {
    const tier = section.tier || tierMap[section.sourceSectionKey || section.key] || tierMap[section.key];
    return { ...section, tier };
  });

  // 抽样 N 次生成题目
  const N = 30;
  const aggregated = {
    singles: { naturals: 0, total: 0 },
    chords: new Set(),
    intervals: new Set(),
    melodiesKeySig: new Set(),
    rhythmsBpm: [],
  };

  for (let i = 0; i < N; i++) {
    const generated = questionCore.generateExamFromSections(sectionsWithTier);
    const all = [
      ...generated.singles,
      ...generated.groups,
      ...generated.intervals,
      ...(generated.connectionQuestion ? [generated.connectionQuestion] : []),
      ...generated.chords,
      ...generated.rhythmQuestions,
      ...generated.melodyQuestions,
    ];
    for (const q of all) {
      if (q.type === 'single') {
        aggregated.singles.total++;
        const midi = Array.isArray(q.midis) ? q.midis[0] : (q.midi ?? q.answer);
        if (typeof midi === 'number' && NATURAL_PCS.has(pcOf(midi))) aggregated.singles.naturals++;
      } else if (q.type === 'chord') {
        const name = q.chordName || q.chordSymbol || '';
        if (name) aggregated.chords.add(name);
        else if (q.quality) aggregated.chords.add(q.quality);
        else if (q.chordQuality) aggregated.chords.add(q.chordQuality);
      } else if (q.type === 'interval') {
        if (typeof q.semitones === 'number') aggregated.intervals.add(q.semitones);
      } else if (q.type === 'intervalConnection') {
        if (Array.isArray(q.links)) for (const link of q.links) {
          if (typeof link.semitones === 'number') aggregated.intervals.add(link.semitones);
        }
      } else if (q.type === 'melody') {
        if (q.keySignature) aggregated.melodiesKeySig.add(q.keySignature);
      } else if (q.type === 'rhythm') {
        if (q.bpm) aggregated.rhythmsBpm.push(q.bpm);
      }
    }
  }

  const naturalRatio = aggregated.singles.total ? aggregated.singles.naturals / aggregated.singles.total : null;
  const expectTier = id === 'hubei' ? 2 : 3;
  let ok = true;
  const reasons = [];
  if (naturalRatio !== null) {
    if (expectTier === 3 && naturalRatio > 0.85) {
      ok = false;
      reasons.push(`tier3 期望含变化音，但自然音占比 ${naturalRatio.toFixed(2)} 偏高`);
    }
    if (expectTier === 2 && naturalRatio < 0.7) {
      ok = false;
      reasons.push(`tier2 期望自然音为主，但占比 ${naturalRatio.toFixed(2)} 偏低`);
    }
  }
  if (expectTier === 3 && aggregated.chords.size < 2) {
    reasons.push(`tier3 期望和弦种类 ≥2，实际 ${aggregated.chords.size}`);
  }
  if (!ok) fail++;

  results.push({
    id,
    expectTier,
    naturalRatio: naturalRatio !== null ? naturalRatio.toFixed(2) : 'N/A',
    chordQualities: [...aggregated.chords].join(','),
    intervalsSemity: [...aggregated.intervals].join(','),
    melodyKeySigs: [...aggregated.melodiesKeySig].join(','),
    ok,
    reasons: reasons.length ? reasons.join('; ') : 'OK',
  });
}

console.log('\n=== 各省 tier 接线端到端验证 ===');
for (const r of results) {
  console.log(
    `${r.ok ? '✓' : '✗'} ${r.id.padEnd(14)} tier${r.expectTier} | 自然音占比 ${r.naturalRatio} | 和弦种类=${r.chordQualities || '-'} | 旋律调号=${r.melodyKeySigs || '-'} | ${r.reasons}`
  );
}
console.log(`\n通过 ${results.length - fail}/${results.length}`);
process.exit(fail ? 1 : 0);