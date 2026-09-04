const assert = require('node:assert/strict');

const { PROVINCE_FRAMEWORKS, getProvinceFramework } = require('../src/core/legacy/province-frameworks.js');
const { buildChoicePaper } = require('../src/core/legacy/choice-paper.js');
const questionCore = require('../src/core/legacy/question.js');
const pcm = require('../src/core/legacy/pcm-renderer.js');

const provinceIds = Object.keys(PROVINCE_FRAMEWORKS).filter((id) => id !== 'national');

function expandedSections(sections) {
  return sections.flatMap((section) => {
    if (!section.items?.length || !['group', 'interval'].includes(section.key)) return [section];
    return section.items.map((item) => ({
      ...section,
      ...item,
      key: section.key,
      sourceSectionKey: item.key,
      sourceSectionTitle: item.title || section.title,
      items: undefined,
    }));
  });
}

function flattenGenerated(result) {
  return [
    ...result.singles,
    ...result.groups,
    ...result.intervals,
    ...(result.connectionQuestion ? [result.connectionQuestion] : []),
    ...result.chords,
    ...result.rhythmQuestions,
    ...result.melodyQuestions,
  ];
}

provinceIds.forEach((id) => {
  const sourceId = PROVINCE_FRAMEWORKS[id] ? id : 'national';
  const variants = PROVINCE_FRAMEWORKS[sourceId].variants;
  variants.forEach((_, variantIndex) => {
    const framework = getProvinceFramework(sourceId, () => (variantIndex + 0.1) / variants.length);
    const expected = framework.sections.reduce((sum, section) => sum + Number(section.count || 0), 0);
    for (let sample = 0; sample < 10; sample += 1) {
      if (framework.template === 'choice') {
        const paper = buildChoicePaper({ ...framework, province: framework.label, name: framework.title });
        assert.equal(paper.choiceQuestions.length, expected, `${id}/${framework.year} 选择题量错误`);
        if (Number.isFinite(framework.fullScore)) {
          const paperScore = Math.round(paper.choiceQuestions.reduce((sum, question) => sum + Number(question.points || 0), 0) * 100) / 100;
          assert.equal(paperScore, framework.fullScore, `${id}/${framework.year} 选择卷题目分值之和与满分不一致`);
        }
        paper.choiceQuestions.forEach((question) => {
          assert.equal(question.options.length, 4, `${question.title} 不是四选一`);
          const optionKeys = question.options.map((option) => JSON.stringify({ text: option.text || '', events: option.events || [] }));
          assert.equal(new Set(optionKeys).size, 4, `${question.title} 出现重复选项`);
          assert.ok(question.correctIndex >= 0 && question.correctIndex < 4, `${question.title} 正确选项索引错误`);
          assert.doesNotThrow(() => pcm.buildQuestionTimeline(question.audio), `${question.title} 无法生成播放时间轴`);
        });
        continue;
      }

      const questions = flattenGenerated(questionCore.generateExamFromSections(expandedSections(framework.sections)));
      assert.equal(questions.length, expected, `${id}/${framework.year} 听写题量错误`);
      if (Number.isFinite(framework.fullScore)) {
        const paperScore = Math.round(questions.reduce((sum, question) => sum + Number(question.examPoints || 0), 0) * 100) / 100;
        assert.equal(paperScore, framework.fullScore, `${id}/${framework.year} 听写卷题目分值之和与满分不一致`);
      }
      questions.forEach((question) => {
        assert.ok(question.repeatCount > 0, `${question.typeName} 缺少播放次数`);
        assert.ok(question.answerText, `${question.typeName} 缺少答案文本`);
        assert.doesNotThrow(() => pcm.buildQuestionTimeline(question), `${question.typeName} 无法生成播放时间轴`);
        if (question.type === 'chord') {
          const notes = pcm.buildQuestionTimeline(question).events.filter((event) => event.type === 'note' && event.start > 1);
          assert.equal(new Set(notes.map((event) => event.start)).size, 1, '和弦三个音没有同时起音');
        }
      });
    }
  });
});

console.log(`${provinceIds.length} 省专属试卷测试通过：逐年份 10 次抽样的题量、四选一去重、答案、时间轴和和弦同步均正常。`);
