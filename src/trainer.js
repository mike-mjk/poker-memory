import { hands } from './range.js';
import { categories, categoryHands, categoryStats, familyBoundary } from './categories.js';

export function buildDeck(kind, categoryId = 'all', metric = 'rangePercent', pure = false) {
  const selected = categories.find(c => c.id === categoryId) ?? categories[0];
  if (kind === 'boundary') {
    return categories.filter(c => c.family && (categoryId === 'all' || c.id === categoryId)).map(item => {
      const boundary = familyBoundary(item, pure);
      return { id: `boundary:${item.id}:${pure}`, kind, category: item, boundary, expected: boundary.weakest?.name ?? 'None' };
    });
  }
  if (kind === 'hand') {
    return categoryHands(selected).map(hand => ({ id: `hand:${hand.name}`, kind, hand, expected: Math.round(hand.frequency * 100) }));
  }
  return categories.filter(c => c.id !== 'all' && (categoryId === 'all' || c.id === categoryId)).map(item => ({
    id: `composition:${item.id}:${metric}`, kind: 'composition', category: item, metric,
    expected: categoryStats(item)[metric],
  }));
}

export function checkAnswer(question, input) {
  if (question.kind === 'boundary') return String(input).toLowerCase() === question.expected.toLowerCase();
  if (String(input).trim() === '' || !Number.isFinite(Number(input))) return false;
  const tolerance = question.kind === 'hand' ? 0 : question.metric === 'raisingCombos' ? 0.05 : 0.2;
  return Math.abs(Number(input) - question.expected) <= tolerance + Number.EPSILON * 100;
}

export function nextQuestion(deck, records = {}, previousId = '', random = Math.random) {
  const candidates = deck.length > 1 ? deck.filter(q => q.id !== previousId) : deck;
  if (!candidates.length) return null;
  const weights = candidates.map(q => {
    const record = records[q.id] ?? {};
    return 1 + Math.min(6, (record.wrong ?? 0) * 2) + ((record.seen ?? 0) === 0 ? 2 : 0);
  });
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll < 0) return candidates[i];
  }
  return candidates.at(-1);
}
