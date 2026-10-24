import test from 'node:test';
import assert from 'node:assert/strict';
import { categories, categoryStats, categoryHands, familyBoundary } from '../src/categories.js';
import { ranks, hands, weightedCombos } from '../src/range.js';
import { buildDeck, checkAnswer, nextQuestion } from '../src/trainer.js';
const cat = id => categories.find(c => c.id === id);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('suited aces have 48 raising combos, with distinct correct denominators', () => {
  const s = categoryStats(cat('suited-A'));
  assert.equal(s.rawCombos, 48);
  assert.equal(s.raisingCombos, 48);
  close(s.allHandsPercent, 48 / 1326 * 100);
  close(s.rangePercent, 48 / 451.3 * 100);
  assert.equal(s.raiseRate, 100);
});
test('mixed hands contribute fractionally and folds count only toward category capacity', () => {
  const s = categoryStats(cat('suited-Q'));
  assert.equal(s.rawCombos, 40);
  close(s.raisingCombos, 7 * 4 + 4 * .51);
  close(categoryStats(cat('pairs')).raisingCombos, 12 * 6 + 6 * .89);
  close(weightedCombos, 451.3);
});
test('highest-card families and pairs partition all hands and all opening weight exactly once', () => {
  const partition = categories.filter(c => c.family || c.id === 'pairs');
  for (const hand of hands) assert.equal(partition.filter(c => c.matches(hand)).length, 1, hand.name);
  close(partition.reduce((sum, c) => sum + categoryStats(c).raisingCombos, 0), weightedCombos);
  close(partition.reduce((sum, c) => sum + categoryStats(c).rangePercent, 0), 100);
});
test('ace categories distinguish unpaired aces from AA and overlapping Broadway', () => {
  const high = categoryStats(cat('high-A'));
  const any = categoryStats(cat('any-ace'));
  assert.equal(any.rawCombos - high.rawCombos, 6);
  assert.equal(any.raisingCombos - high.raisingCombos, 6);
  assert.equal(high.raisingCombos, 144);
  assert.equal(categoryStats(cat('suited-broadway')).rawCombos, 40);
  assert.equal(categoryStats(cat('offsuit-broadway')).rawCombos, 120);
});
test('contains-rank categories include either card and exclude every pocket pair', () => {
  for (const rank of ranks) {
    const item = cat(`contains-${rank}`);
    const stats = categoryStats(item);
    assert.equal(stats.members.length, 24, rank);
    assert.equal(stats.rawCombos, 192, rank);
    assert.equal(item.matches(hands.find(h => h.name === rank + rank)), false);
  }
  const names = id => categoryHands(cat(id)).map(h => h.name);
  for (const hand of ['AKs', 'AKo', 'KQs', 'KQo', 'K2s', 'K2o']) assert.ok(names('contains-K').includes(hand), hand);
  for (const hand of ['AQs', 'AQo', 'KQs', 'KQo', 'QJs', 'QJo']) assert.ok(names('contains-Q').includes(hand), hand);
  assert.ok(!names('high-K').includes('AKs'));
  assert.deepEqual(names('contains-A'), names('high-A'));
  close(categoryStats(cat('contains-K')).raisingCombos - categoryStats(cat('high-K')).raisingCombos, 16);
  close(categoryStats(cat('contains-Q')).raisingCombos - categoryStats(cat('high-Q')).raisingCombos, 32);
  close(categoryStats(cat('contains-Q')).raisingCombos, 86.04);
  // Each unpaired hand belongs to exactly two contains-rank categories.
  const containing = categories.filter(c => c.id.startsWith('contains-'));
  for (const hand of hands) assert.equal(containing.filter(c => c.matches(hand)).length, hand.row === hand.col ? 0 : 2, hand.name);
});
test('contains-rank categories are available in composition and individual-hand training', () => {
  const queen = buildDeck('composition', 'contains-Q', 'rangePercent');
  assert.equal(queen.length, 1);
  close(queen[0].expected, 86.04 / weightedCombos * 100);
  assert.ok(buildDeck('hand', 'contains-Q').some(q => q.hand.name === 'AQs'));
  assert.equal(buildDeck('hand', 'contains-Q').some(q => q.hand.name === 'QQ'), false);
  assert.equal(buildDeck('boundary').some(q => q.category.id === 'contains-Q'), false);
});
test('connectors and gappers use ace-high rank distance, with clear lower subsets', () => {
  const names = id => categoryHands(cat(id)).map(h => h.name);
  assert.ok(names('suited-gap-0').includes('AKs'));
  assert.ok(!names('suited-gap-0').includes('A2s'));
  assert.ok(names('suited-gap-1').includes('97s'));
  assert.ok(names('suited-gap-2').includes('T7s'));
  assert.deepEqual(names('low-connectors'), ['98s', '87s', '76s', '65s', '54s', '43s', '32s']);
});
test('boundaries distinguish pure and mixed raises, preserve holes, and handle all-fold families', () => {
  assert.equal(familyBoundary(cat('suited-T')).weakest.name, 'T7s');
  assert.equal(familyBoundary(cat('suited-Q')).weakest.name, 'Q4s');
  assert.equal(familyBoundary(cat('suited-Q'), true).weakest.name, 'Q5s');
  const ace = familyBoundary(cat('offsuit-A'));
  assert.equal(ace.weakest.name, 'A5o');
  assert.deepEqual(ace.holes.map(h => h.name), ['A6o']);
  assert.equal(familyBoundary(cat('suited-3')).weakest, null);
  assert.equal(familyBoundary(cat('offsuit-T'), true).weakest, null);
});
test('trainer scopes decks, grades percentages vs exact frequencies, and handles None', () => {
  const q = buildDeck('composition', 'suited-A', 'rangePercent')[0];
  assert.equal(buildDeck('composition', 'suited-A').length, 1);
  assert.equal(checkAnswer(q, '10.64'), true);
  assert.equal(checkAnswer(q, '3.62'), false);
  assert.equal(checkAnswer(q, ''), false);
  assert.equal(checkAnswer(q, 'NaN'), false);
  const ten = buildDeck('boundary', 'suited-T')[0];
  assert.equal(checkAnswer(ten, 'T7s'), true);
  assert.equal(checkAnswer(ten, 'T5s'), false);
  assert.equal(buildDeck('boundary', 'suited-3')[0].expected, 'None');
  const j9 = buildDeck('hand').find(q => q.hand.name === 'J9o');
  assert.equal(checkAnswer(j9, '17'), true);
  assert.equal(checkAnswer(j9, '17.1'), false);
  assert.equal(buildDeck('hand', 'suited-A').length, 12);
});
test('trainer avoids immediate repeats, including single-question decks and empty decks', () => {
  const deck = buildDeck('boundary');
  assert.notEqual(nextQuestion(deck, {}, deck[0].id, () => 0).id, deck[0].id);
  assert.equal(nextQuestion([deck[0]], {}, deck[0].id).id, deck[0].id);
  assert.equal(nextQuestion([], {}), null);
});
