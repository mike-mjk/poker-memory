import test from 'node:test';
import assert from 'node:assert/strict';
import { averageSamples } from '../src/average-data.js';
import { deck, parseFlop, classifyHand } from '../src/flop.js';
import { buildAverageCatalog, summarizeFrequencies, chooseAverageBatch, batchOptions, scoreAverageBatch, drawProfile, hasBackdoorStraight } from '../src/average-trainer.js';

const catalog=buildAverageCatalog(averageSamples);
const question=(classId,hand,key)=>catalog.get(classId).get(hand).questions.find(q=>q.key===key);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const boardNames=q=>q.points.filter(p=>p.included).map(p=>p.board[2]);

test('dataset uses only complete standard-Xeno AK5–AK2 samples, never Mobius AK6',()=>{
  assert.deepEqual(averageSamples.map(s=>s.spot.board[2]),['5h','4h','3h','2h']);
  assert.ok(averageSamples.every(s=>s.provenance.uses_solver_standard_preflop_ranges && s.data_semantics.range_weights_provided));
  assert.ok(averageSamples.every(s=>s.action.size_fraction_of_pot===.75));
});
test('A8s targets match the agreed means and omit the blocked spades combo',()=>{
  const hand=catalog.get('top-pair').get('A8s');
  assert.deepEqual(hand.questions.map(q=>q.key),['Ac8c','Ad8d','Ah8h']);
  assert.deepEqual(hand.questions.map(q=>q.target),[60,61,87]);
  close(question('top-pair','A8s','Ad8d').mean,60.85);
  assert.equal(hand.questions.every(q=>q.points.every(p=>p.included)),true);
});
test('offsuit A5 and A3 have nine variants and omit their two-pair boards, not average zeros',()=>{
  for(const [name,excluded] of [['A5o','5h'],['A3o','3h']]){
    const hand=catalog.get('top-pair').get(name);
    assert.equal(hand.questions.length,9);
    for(const q of hand.questions){
      assert.equal(q.points.filter(p=>p.included).length,3);
      assert.equal(q.points.find(p=>p.board[2]===excluded).included,false);
      assert.equal(q.points.find(p=>p.board[2]===excluded).frequency,null);
      assert.ok(!q.cards.includes('As'));
    }
  }
  assert.equal(catalog.get('top-pair').get('AJo').questions.length,9);
});
test('same-class J8s and king-pair targets retain suit differences and quantify spread',()=>{
  assert.deepEqual(catalog.get('unpaired').get('J8s').questions.map(q=>q.target),[20,21,49,66]);
  const j=question('middle-pair','KJs','KsJs');
  close(j.mean,46.825);assert.equal(j.target,47);close(j.spread,23.4);
  assert.equal(question('middle-pair','KQs','KsQs').target,55);
});
test('backdoor straight changes are excluded rather than silently averaged',()=>{
  const q=question('unpaired','96s','9c6c');
  assert.deepEqual(boardNames(q),['4h','3h','2h']);
  assert.equal(q.profile.backdoorStraight,false);
  assert.match(q.points[0].reason,/Different draw profile/);
  assert.deepEqual(boardNames(question('unpaired','J6s','Jc6c')),['5h','4h','3h','2h']);
});
test('every catalog target uses at least two boards with identical made and draw profile',()=>{
  const byCode=new Map(deck.map(c=>[c.code,c]));
  for(const hands of catalog.values())for(const hand of hands.values())for(const q of hand.questions){
    const profiles=q.points.filter(p=>p.included).map(p=>drawProfile(q.cards.map(c=>byCode.get(c)),parseFlop(p.board.join(' '))));
    assert.ok(profiles.length>=2);
    assert.equal(new Set(profiles.map(p=>JSON.stringify(p))).size,1,q.key);
    for(const p of q.points.filter(p=>p.included)){
      const sample=averageSamples.find(s=>s.sample_id===p.sampleId);
      const entry=sample.combos.find(c=>c.cards.every(card=>q.cards.includes(card)));
      assert.ok(entry.reach_weight>0&&!entry.blocked_by_board);
    }
  }
});
test('equal-board means are not weighted by node reach weight and are rounded only once',()=>{
  const samples=[['5h',0,.1],['4h',1,1]].map(([low,f,w],i)=>({sample_id:String(i),spot:{board:['As','Kh',low]},combos:[{cards:['Ad','8d'],frequency:f,reach_weight:w}]}));
  const q=buildAverageCatalog(samples).get('top-pair').get('A8s').questions[0];
  assert.equal(q.mean,50);assert.equal(q.target,50);
  assert.equal(summarizeFrequencies([.604,.604,.604,.624]).target,61);
  assert.equal(summarizeFrequencies([.605,.605]).target,61);
  assert.throws(()=>summarizeFrequencies([]));
});
test('related-hand generation supports both rank directions without mixing suited and offsuit',()=>{
  const reverse=batchOptions(catalog,{classId:'unpaired',style:'s',direction:'low',anchor:'6'})[0];
  for(const name of ['Q6s','J6s','T6s'])assert.ok(reverse.hands.some(h=>h.name===name));
  for(const direction of ['high','low','mixed']){
    const batch=chooseAverageBatch(catalog,{classId:'unpaired',style:'s',direction},()=>.31);
    assert.equal(batch.hands.length,3);
    assert.ok(batch.hands.every(h=>h.style==='s'&&h[batch.axis]===batch.rank));
  }
  const off=chooseAverageBatch(catalog,{classId:'top-pair',style:'o',direction:'high',anchor:'A'},()=>.4);
  assert.equal(off.hands.length,3);assert.ok(off.hands.every(h=>h.style==='o'));
  assert.equal(chooseAverageBatch(catalog,{classId:'top-pair',style:'s',direction:'low',anchor:'A'}),null);
});
test('batch scoring requires every answer, accepts zero, and measures exact rounded targets',()=>{
  const batch={hands:[catalog.get('unpaired').get('Q6s')]};
  assert.throws(()=>scoreAverageBatch(batch,{}));
  const answers=Object.fromEntries(batch.hands[0].questions.map(q=>[q.key,0]));
  const result=scoreAverageBatch(batch,answers);
  assert.equal(result.count,3);assert.equal(result.exact,2);close(result.meanError,8/3);
  const correct=Object.fromEntries(batch.hands[0].questions.map(q=>[q.key,q.target]));
  assert.equal(scoreAverageBatch(batch,correct).exact,3);
  assert.throws(()=>scoreAverageBatch(batch,{...correct,Qc6c:1.5}));
});
test('backdoor definition includes runner-runner Broadway but excludes existing gutshots',()=>{
  const get=text=>text.split(' ').map(code=>deck.find(c=>c.code===code));
  const board=parseFlop('As Kh 5h');
  assert.equal(hasBackdoorStraight(get('Jc 8c'),board),true);
  assert.equal(hasBackdoorStraight(get('Qc Jc'),board),false);
  assert.ok(classifyHand(get('Qc Jc'),board).draws.includes('gutshot'));
});
