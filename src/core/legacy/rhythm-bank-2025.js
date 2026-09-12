const DURATION_BY_TOKEN = {
  x: 0.125,
  s: 0.25,
  t: 1 / 3,
  e: 0.5,
  d: 0.75,
  q: 1,
  a: 1.5,
  h: 2,
  w3: 3,
  w: 4,
};

// 《2025年音乐艺考模拟试卷》60 套参考答案第 6 题。
// x/s/t/e/d/q/a/h/w3/w 表示时值，r 表示休止，~ 表示连至下一音。
const ENCODED_RHYTHM_BANK = [
'6/8|essessee/dsssqe/edsdse/dseeee~/esseresse/eqa',
'4/4|essqsseq/eedsea/essssessssses/dseereeess/ssesdsesee~/eedsh',
'3/8|ssee/ssds/dsss/eess/ssds/eq',
'3/4|qssessss/dsssqe/aesse/dssse~ses/rsse~sseq/eeh',
'2/4|sesq/ssqe/dssse/ssssess/eqss/h',
'6/8|eeeesd/sssesa/sseesese/edsdsss/essedse/qea',
'4/4|qsseessee/dssesssssq/tttdsssqe/dssdessq/reereeeqe/sdsseh',
'3/8|qss/ssess/ssess/ssds/eree/ssq',
'3/4|esssesq/tttssesd/ssssea/qsseses/asssse/sesh',
'2/4|eesse/dsttt/sessse/sssssd/reqe/h',
'6/8|sseesde/eressrsese/qessq/eeessq/ssresseee/ereea',
'4/4|aeressree/ssareeree/reqedsrses/sdssssrqee/essssressreq/sdqh',
'3/8|eree/eress/ssress/ssds/qss/ssq',
'3/4|sssssesress/reereeere/ssssrssssree/reqeq/eqqe/dsh',
'2/4|ssqe/reesse/ressee/resssse/sdttt/qq',
'6/8|ssesseses/ssreereee/reeereses/eeessee/ereessq/qssa',
'4/4|reqssessq/reqqqe/tttessressree/rssssressereq/dsdseeree/sseeeh',
'3/8|ssq/qe/ssee/resse/rssssss/eq',
'3/4|eqeee/esssesree/rsessseq/ssssrssssress/dsqsse/w3',
'2/4|eeree/ssssrssss/sesrses/essds/eqss/ssa',
'6/8|edseress/dsedse~/esdeq/eeeeree/esdssq~/eeea',
'4/4|dsesssseq~/eeqqrq/ree~esssesq/eqeae/tttsseressq/rsdessh',
'3/8|eee/esse/ssssss/eee/sees/rssq',
'3/4|eeeqe~/essreeere/eqerssss~/eesseq/rsessseq/eeh',
'2/4|ssss~ds/eqe~/ssssses/ssqe~/essses/eeq',
'6/8|ssdseds/seeseee~/qss~eds/eesseree/eess~esse/sseea',
'4/4|esssdtttq~/essressea/ess~sseqrq/sessdqq/dssssssdq/w',
'3/8|ssee~/sese/esse/ssree/ssress/a',
'3/4|dsdsree~/esssesee~/dsea/seseeq/essqsse/dsh',
'2/4|dssse~/sessd/rsse~sse/ssqe/essq/dsq',
'6/8|eeeesd/sseesese/ssseseree/ssreeeee/ssee~sese/qssa',
'4/4|qsseessee/tttdsssqe/dssesssssq/sdssesesq/sessseqee/reeressh',
'3/8|sssse/ssess/ssssss/ssds/esse/a',
'3/4|qeeess/dssseq/assses/dssdq/reessssq/sseh',
'2/4|sseee/sdq/dsssss/eqss/sseee/h',
'6/8|esseeee/edsssq/esssseq/sseesese/eeeeress/qea',
'4/4|qessdsq/eqesesq/ttteedssse/sesreeressq/ttteeesssd/aeh',
'3/8|eds/sdss/ssess/sesss/sese/ssq',
'3/4|qtttee/sseeqe/qass/eqqe/rsdessq/dsh',
'2/4|sseee/tttee/dsess/tttds/ssqss/h',
'6/8|qedse/ssqqe/eresseds/esseeee/ereessee/ssreereq',
'4/4|aeeeq/ssqereeq/ssqssreeq/ttteeessds/qessereress/rsesreeh',
'3/8|dse/dse/ssrssss/resse/reds/eq',
'3/4|eqqe~/sssssseses/sessdq/ttteeds/eqqss/w3',
'2/4|dsee/rsesee/reeess/ressds/essssss/qq',
'6/8|sseeessss/dseesd/ereessree/eqssq/eeeesse/ssqa',
'4/4|reqeessq/reqqqss/ttteeressree/rssssreeereq/eqssqrq/esssseh',
'3/8|eree/eress/ssree/dse/reds/eq',
'3/4|eqssee/esssesree/rsesrsseq/eqqe/qtttds/essh',
'2/4|sdq/tttq/reeere/rssssee/sseq/sdq',
'6/8|ssreeresse~/eqeress/resse~esse/reeessee/seeseq/eqa',
'4/4|aeass/ssadsee/eqqqe/ssessss~eeq/reeessrsesq/w',
'3/8|ssds/eses~/eee/esse/ssree/a',
'3/4|dstttq/eqqss/rsdeettt/sseereree/seseeds/sseh',
'2/4|sesress/ess~ee/eqss/sseds/tttee/ea',
'6/8|edsssee/esseeq~/eee~esse/resdeq/eeeeds/ssreea',
'4/4|dsessssssq~/dsqqrq/ree~essssssq/eqssae/sdsdeeq/sseqh',
'3/8|dse/sdss~/eee~/esse/eds/eq',
'3/4|sessse~ee/eqeee/sessssssse~/seseeq/rseseeds/sdh',
'2/4|ssqe/eqe~/essds/sesess/reessss/h',
];

function decodeEvent(encoded) {
  let token = encoded;
  const tieToNext = token.endsWith('~');
  if (tieToNext) token = token.slice(0, -1);
  const rest = token.startsWith('r');
  if (rest) token = token.slice(1);
  return { duration: DURATION_BY_TOKEN[token], rest, tieToNext };
}

function decodeRecord(encoded, index) {
  const separator = encoded.indexOf('|');
  const meter = encoded.slice(0, separator);
  const bars = encoded.slice(separator + 1).split('/').map(function (bar) {
    return (bar.match(/r?(?:w3|[xstedqahw])~?/g) || []).map(decodeEvent);
  });
  return {
    id: `paper-${String(index + 1).padStart(2, '0')}`,
    sourcePaper: index + 1,
    meter,
    bars,
  };
}

const RHYTHM_BANK_2025 = ENCODED_RHYTHM_BANK.map(decodeRecord);

module.exports = {
  RHYTHM_BANK_2025,
};
