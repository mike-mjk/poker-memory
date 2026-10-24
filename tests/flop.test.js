import test from 'node:test';
import assert from 'node:assert/strict';
import { deck, parseFlop, expandRange, classifyHand, analyzeFlop, madeClasses, drawClasses, boardTexture, randomFlop } from '../src/flop.js';
import { hands, weightedCombos } from '../src/range.js';
const cards = text => text.split(' ').map(code => deck.find(c => c.code === code));
const classify = (hole, flop) => classifyHand(cards(hole), parseFlop(flop));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const allCombos = expandRange(new Map(hands.map(h => [h.name, 1])));

test('parses exact suit cards, normalizes input, and rejects duplicates or incomplete boards', () => {
  assert.deepEqual(parseFlop('q♠, 6♥, 2♦').map(c=>c.code), ['Qs', '6h', '2d']);
  assert.deepEqual(parseFlop('10H9S8D').map(c=>c.code), ['Th', '9s', '8d']);
  for (const input of ['Qs Qs 2d', 'Q 6 2', 'Qs 6h', 'Qs 6h 2d As', '<script>']) assert.throws(()=>parseFlop(input));
});
test('expands all physical combinations and preserves opening weights', () => {
  assert.equal(allCombos.length, 1326);
  const opening = expandRange();
  close(opening.reduce((sum,c)=>sum+c.weight,0), weightedCombos);
  assert.equal(opening.filter(c=>c.name==='Q4s').length, 4);
  assert.equal(opening.filter(c=>c.name==='Q4s').every(c=>c.weight===.51), true);
});
test('board removal preserves fractional weights and renormalizes the surviving range', () => {
  const custom = expandRange(new Map([['Q4s', .51], ['22', .89], ['QQ', 1], ['AQo', 1]]));
  const a = analyzeFlop(parseFlop('Qs 6h 2d'), custom);
  assert.equal(a.physicalCombos, 18);
  close(a.totalWeight, 16.2);
  close(a.buckets.get('set').weight, 5.67);
  close(a.buckets.get('top-pair').weight, 10.53);
  close(a.buckets.get('set').percent, 5.67 / 16.2 * 100);
});
test('unpaired disconnected rainbow board has independently counted full-deck made classes', () => {
  const a=analyzeFlop(parseFlop('Qs 6h 2d'),allCombos);
  assert.equal(a.totalWeight,1176);
  const expected = { set:9, 'two-pair':27, overpair:12, 'pocket-below-top':30, 'pocket-below-middle':18, 'top-pair':120, 'middle-pair':120, 'bottom-pair':120, 'unpaired-draw':48, 'unpaired-air':672 };
  for(const [id,value] of Object.entries(expected)) assert.equal(a.buckets.get(id).weight,value,id);
});
test('paired and tripled boards distinguish board pairs, trips, full houses, and quads', () => {
  const paired=analyzeFlop(parseFlop('Qs Qh 6d'),allCombos);
  const expected={quads:1,'full-house':9,trips:88,'two-pair-pocket':66,'two-pair-board':132,'board-pair':880};
  for(const [id,value] of Object.entries(expected)) assert.equal(paired.buckets.get(id).weight,value,id);
  const trips=analyzeFlop(parseFlop('Qs Qh Qd'),allCombos);
  assert.equal(trips.buckets.get('quads').weight,48);
  assert.equal(trips.buckets.get('full-house').weight,72);
  assert.equal(trips.buckets.get('board-trips').weight,1056);
  assert.equal(paired.buckets.get('top-pair').weight,0);
});
test('made-hand priority handles straights, flushes, wheels, straight flushes and pair subtypes', () => {
  const cases=[['Ah Kh','Qh Jh Th','straight-flush'],['Ah 2h','3h 4h 5h','straight-flush'],['Ah 2c','3h 4d 5s','straight'],['Ah 9h','Qh 6h 2h','flush'],['Qc Qd','Qs 6h 2d','set'],['Qh Ac','Qs Qd 6h','trips'],['Qh 6c','Qs Qd 6h','full-house'],['Ah Ad','Qs Qh 6d','two-pair-pocket'],['Ah 6c','Qs Qh 6d','two-pair-board'],['Ah Ad','Qs 6h 2d','overpair'],['3h 3c','Qs 9h 6d','underpair']];
  for(const [hole,flop,expected] of cases) assert.equal(classify(hole,flop).made,expected,`${hole} / ${flop}`);
});
test('draws distinguish open-ended, double-gutshot, edge gutshots, combo draws and backdoors', () => {
  assert.ok(classify('9h 8h','7h 6h Qc').draws.includes('combo-draw'));
  assert.ok(classify('9h 8h','7h 6h Qc').draws.includes('open-ended'));
  assert.ok(classify('5h 7d','8s 9c Jh').draws.includes('double-gutshot'));
  assert.deepEqual(classify('5h 7d','8s 9c Jh').straightOutRanks.sort((a,b)=>a-b),[6,10]);
  assert.ok(classify('Ah 2d','3c 4s Kh').draws.includes('gutshot'));
  assert.ok(classify('Jh Qd','Kc As 2h').draws.includes('gutshot'));
  assert.ok(classify('2h 3d','4c 5s Kh').draws.includes('open-ended'));
  assert.equal(classify('Ah Kh','Qh 8h 3h').draws.includes('straight-draw'),false);
  assert.equal(classify('Ah Kh','Qh 8h 3h').draws.includes('flush-draw'),false);
  assert.ok(classify('Ah Kh','Qh 8d 3s').draws.includes('backdoor-flush'));
  assert.equal(classify('Ac Kd','Qh 8h 3h').draws.includes('backdoor-flush'),false);
  assert.ok(classify('9h 8h','7h 6h 5c').draws.includes('flush-draw'));
  assert.equal(classify('9h 8h','7h 6h 5c').draws.includes('straight-draw'),false);
});
test('monotone and two-tone full-deck flush counts match suit combinatorics', () => {
  const mono=analyzeFlop(parseFlop('Qh 6h 2h'),allCombos);
  assert.equal(mono.buckets.get('flush').weight,45); // C(10,2)
  assert.equal(mono.buckets.get('flush-draw').weight,390); // 10 * 39
  assert.equal(mono.buckets.get('backdoor-flush').weight,0);
  const two=analyzeFlop(parseFlop('Qh 6h 2d'),allCombos);
  assert.equal(two.buckets.get('flush-draw').weight,55); // C(11,2)
  assert.equal(two.buckets.get('backdoor-flush').weight,484); // 11*38 + C(12,2)
});
test('partitions, draw unions, and suit invariance hold across representative flops', () => {
  for(const flop of ['Qs 6h 2d','Kh 8h 3h','Js Ts 6d','9c 9d 4s','Ac Ad Ah','5h 4c 3h','Ah 2c 2s']) {
    const a=analyzeFlop(parseFlop(flop));
    close(madeClasses.reduce((sum,c)=>sum+a.buckets.get(c.id).weight,0),a.totalWeight);
    close(madeClasses.reduce((sum,c)=>sum+a.buckets.get(c.id).percent,0),100);
    close(a.buckets.get('any-draw').weight+a.buckets.get('no-draw').weight,a.totalWeight);
    close(a.buckets.get('flush-draw').weight+a.buckets.get('straight-draw').weight-a.buckets.get('combo-draw').weight,a.buckets.get('any-draw').weight);
    close(['open-ended','double-gutshot','gutshot'].reduce((sum,id)=>sum+a.buckets.get(id).weight,0),a.buckets.get('straight-draw').weight);
    const suits={c:'d',d:'h',h:'s',s:'c'};
    const remapped=parseFlop(flop).map(c=>deck.find(d=>d.code===c.code[0]+suits[c.suit]));
    const other=analyzeFlop(remapped);
    for(const c of [...madeClasses,...drawClasses]) close(a.buckets.get(c.id).weight,other.buckets.get(c.id).weight);
  }
});
test('texture deals produce valid unique cards with requested rank/suit patterns', () => {
  let state=713;
  const random=()=>{state=(state*1664525+1013904223)>>>0;return state/2**32;};
  for(const texture of ['any','unpaired','rainbow','two-tone','monotone','paired','trips']) for(let i=0;i<10;i++) {
    const flop=randomFlop(texture,random);
    assert.equal(new Set(flop.map(c=>c.code)).size,3);
    const t=boardTexture(flop);
    if(texture==='unpaired'||texture==='rainbow'||texture==='two-tone') assert.equal(t.ranks,'Unpaired');
    if(texture==='rainbow') assert.equal(t.suits,'Rainbow');
    if(texture==='two-tone') assert.equal(t.suits,'Two-tone');
    if(texture==='monotone') assert.equal(t.suits,'Monotone');
    if(texture==='paired') assert.equal(t.ranks,'Paired');
    if(texture==='trips') assert.equal(t.ranks,'Trips');
  }
});
