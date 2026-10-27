import { deck, parseFlop, classifyHand, handName, madeClasses } from './flop.js';

const byCode = new Map(deck.map(c => [c.code, c]));
const rankOrder = 'AKQJT98765432';
const suitOrder = 'cdhs';
const canonicalCards = cards => [...cards].sort((a,b) => rankOrder.indexOf(a[0]) - rankOrder.indexOf(b[0]) || suitOrder.indexOf(a[1]) - suitOrder.indexOf(b[1]));
export const averageClasses = [
  { id: 'top-pair', label: 'Top pair' },
  { id: 'middle-pair', label: 'Middle pair' },
  { id: 'unpaired', label: 'No made hand' },
];

export function hasBackdoorStraight(hole, board, result = classifyHand(hole, board)) {
  if (result.draws.includes('straight-draw') || ['straight', 'flush', 'full-house', 'quads', 'straight-flush'].includes(result.made)) return false;
  const values = new Set([...hole, ...board].map(c => c.rank));
  const holeRanks = new Set(hole.map(c => c.rank));
  const boardRanks = new Set(board.map(c => c.rank));
  for (const set of [values, holeRanks, boardRanks]) if (set.has(14)) set.add(1);
  for (let high = 5; high <= 14; high++) {
    const window = [0,1,2,3,4].map(n => high - n);
    if (window.filter(r => !values.has(r)).length === 2 && window.some(r => holeRanks.has(r) && !boardRanks.has(r))) return true;
  }
  return false;
}

export function drawProfile(hole, board, result = classifyHand(hole, board)) {
  return {
    made: result.made,
    flush: result.draws.includes('flush-draw'),
    backdoorFlush: result.draws.includes('backdoor-flush'),
    straight: ['open-ended','double-gutshot','gutshot'].find(id => result.draws.includes(id)) ?? null,
    backdoorStraight: hasBackdoorStraight(hole, board, result),
  };
}
export function profileLabel(profile) {
  const labels = [];
  if (profile.flush) labels.push('Flush draw');
  if (profile.backdoorFlush) labels.push('Backdoor flush draw');
  if (profile.straight) labels.push({ 'open-ended':'Open-ender', 'double-gutshot':'Double gutshot', gutshot:'Gutshot' }[profile.straight]);
  if (profile.backdoorStraight) labels.push('Backdoor straight');
  return labels.join(' · ') || 'No draw, including no backdoors';
}
export function summarizeFrequencies(values) {
  if (!values.length || values.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new Error('Averages require valid action frequencies.');
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length * 100;
  return { mean, target: Math.round(mean + 1e-10), spread: Math.round((Math.max(...values) - Math.min(...values)) * 100 * 1e9) / 1e9 };
}

// Build once. Each exact combo is split by meaning, retaining its largest stable
// board subset (at least two boards). Different draw profiles are never averaged.
export function buildAverageCatalog(samples) {
  if (samples.length < 2) throw new Error('At least two boards are required.');
  const maps = samples.map(sample => new Map(sample.combos.map(c => [canonicalCards(c.cards).join(''), c])));
  const boards = samples.map(sample => parseFlop(sample.spot.board.join(' ')));
  const catalog = new Map(averageClasses.map(c => [c.id, new Map()]));
  for (const [key, first] of maps[0]) {
    const cards = canonicalCards(first.cards);
    const hole = cards.map(code => byCode.get(code));
    const hand = handName(...hole);
    if (hole[0].rank === hole[1].rank) continue;
    const observations = maps.map((map, index) => {
      const entry = map.get(key);
      const board = boards[index];
      const blocked = cards.some(code => board.some(c => c.code === code));
      if (!entry || blocked || !(entry.reach_weight > 0)) return { index, reason: blocked ? 'Board-blocked' : 'Not in this node range' };
      const result = classifyHand(hole, board);
      const profile = drawProfile(hole, board, result);
      const baseClass = result.made.startsWith('unpaired-') ? 'unpaired' : result.made;
      return { index, frequency: entry.frequency, reachWeight: entry.reach_weight, profile, baseClass, signature: JSON.stringify(profile) };
    });
    for (const classId of catalog.keys()) {
      const profiles = new Map();
      for (const o of observations) if (o.baseClass === classId) {
        if (!profiles.has(o.signature)) profiles.set(o.signature, []);
        profiles.get(o.signature).push(o);
      }
      const chosen = [...profiles.values()].sort((a,b) => b.length - a.length || a[0].index - b[0].index)[0];
      if (!chosen || chosen.length < 2) continue;
      const included = new Set(chosen.map(o => o.index));
      const points = observations.map(o => ({
        sampleId: samples[o.index].sample_id,
        board: samples[o.index].spot.board,
        included: included.has(o.index),
        frequency: included.has(o.index) ? o.frequency : null,
        reason: included.has(o.index) ? null : o.reason ?? (o.baseClass !== classId ? madeClasses.find(c => c.id === o.profile.made)?.label ?? o.profile.made : 'Different draw profile: ' + profileLabel(o.profile)),
      }));
      const stats = summarizeFrequencies(chosen.map(o => o.frequency));
      const question = { key, cards, hand, classId, profile: chosen[0].profile, points, ...stats };
      const hands = catalog.get(classId);
      if (!hands.has(hand)) hands.set(hand, { name: hand, high: hand[0], low: hand[1], style: hand[2], classId, questions: [] });
      hands.get(hand).questions.push(question);
    }
  }
  for (const hands of catalog.values()) for (const hand of hands.values()) {
    hand.questions.sort((a,b) => suitOrder.indexOf(a.cards[0][1]) - suitOrder.indexOf(b.cards[0][1]) || suitOrder.indexOf(a.cards[1][1]) - suitOrder.indexOf(b.cards[1][1]));
  }
  return catalog;
}

export function batchOptions(catalog, { classId = 'top-pair', style = 's', direction = 'high', anchor = '' } = {}) {
  const pool = [...(catalog.get(classId)?.values() ?? [])].filter(h => h.style === style);
  const groups = [];
  for (const axis of direction === 'mixed' ? ['high','low'] : [direction]) {
    for (const rank of rankOrder) {
      const hands = pool.filter(h => h[axis] === rank);
      if (hands.length && (!anchor || anchor === rank)) groups.push({ axis, rank, hands });
    }
  }
  // Prefer full three-hand batches when any are available under the selection.
  const full = groups.filter(g => g.hands.length >= 3);
  return full.length ? full : groups;
}
export function chooseAverageBatch(catalog, options, random = Math.random, previous = '') {
  const candidates = batchOptions(catalog, options);
  if (!candidates.length) return null;
  const group = candidates[Math.floor(random() * candidates.length)];
  let selected;
  for (let attempt = 0; attempt < 8; attempt++) {
    const pool = [...group.hands];
    selected = [];
    while (pool.length && selected.length < 3) selected.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    selected.sort((a,b) => rankOrder.indexOf(a.high) - rankOrder.indexOf(b.high) || rankOrder.indexOf(a.low) - rankOrder.indexOf(b.low));
    if (selected.map(h => h.name).join(',') !== previous) break;
  }
  return { axis: group.axis, rank: group.rank, hands: selected };
}
export function scoreAverageBatch(batch, answers) {
  const questions = batch.hands.flatMap(h => h.questions);
  if (questions.some(q => !Number.isInteger(answers[q.key]) || answers[q.key] < 0 || answers[q.key] > 100)) throw new Error('Answer every combo with a whole percentage from 0 to 100.');
  const results = questions.map(q => ({ key: q.key, target: q.target, answer: answers[q.key], error: Math.abs(answers[q.key] - q.target) }));
  return { results, exact: results.filter(r => r.error === 0).length, count: results.length, meanError: results.reduce((sum,r) => sum+r.error, 0)/results.length };
}
