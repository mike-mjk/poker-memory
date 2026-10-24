import test from 'node:test';
import assert from 'node:assert/strict';
import { hands, range, weightedCombos, parseRange } from '../src/range.js';
import { scoreAnswers } from '../src/practice.js';

test('matrix represents all 169 starting hands and 1326 combinations', () => {
  assert.equal(hands.length, 169);
  assert.equal(new Set(hands.map(h => h.name)).size, 169);
  assert.equal(hands.reduce((sum, h) => sum + h.combos, 0), 1326);
  assert.equal(hands[1].name, 'AKs');
  assert.equal(hands[13].name, 'AKo');
});
test('preserves all supplied mixed frequencies and folds absent hands', () => {
  const mixed = Object.fromEntries([...range].filter(([, value]) => value < 1));
  assert.deepEqual(mixed, { Q4s: .51, J6s: .62, J9o: .17, T9o: .95, '22': .89 });
  for (const name of ['Q3s', 'Q9o', 'A6o', 'T6s']) assert.equal(hands.find(h => h.name === name).frequency, 0);
  assert.equal(range.get('AA'), 1);
  assert.equal(range.get('A5o'), 1);
  assert.ok(weightedCombos > 0 && weightedCombos < 1326);
});
test('score distinguishes missing hands, incorrect hands, and explicit folds', () => {
  assert.deepEqual(scoreAnswers({}), { correct: 0, wrong: 0, unfilled: 169 });
  assert.deepEqual(scoreAnswers({ AA: 100, Q3s: 0, Q4s: 50 }), { correct: 2, wrong: 1, unfilled: 166 });
  const correct = Object.fromEntries(hands.map(h => [h.name, Math.round(h.frequency * 100)]));
  assert.deepEqual(scoreAnswers(correct), { correct: 169, wrong: 0, unfilled: 0 });
});
test('rejects malformed frequencies', () => {
  assert.throws(() => parseRange('AA:1.5'));
  assert.throws(() => parseRange('AA:no'));
});
