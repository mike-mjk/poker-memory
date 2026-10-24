// Personal facts are separate from the supplied range and calculated trainers.
export const DAY = 86400000;
export const MINUTE = 60000;
export const MAX_CARDS = 5000;
export const seedCard = {
  id: 'btn-rfi-offsuit-connector-boundary',
  deck: 'Button RFI',
  front: 'Button RFI: What is the lowest offsuit zero-gapper to open?',
  back: '98o (9–8 offsuit).\n98o opens; 87o folds.',
  notes: 'Boundary supplied from your trainer. Zero-gapper means consecutive ranks.',
  due: 0, interval: 0, reviews: 0, lapses: 0, updatedAt: 0,
};
const textLimits = { deck: 80, front: 500, back: 5000, notes: 3000 };

export function validateCard(card) {
  if (!card || typeof card !== 'object' || typeof card.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(card.id)) throw new Error('A card has an invalid ID.');
  for (const [field, limit] of Object.entries(textLimits)) {
    if (typeof card[field] !== 'string' || card[field].length > limit || (field !== 'notes' && !card[field].trim())) throw new Error(`A card has invalid ${field} text.`);
  }
  for (const field of ['due', 'updatedAt', 'reviews', 'lapses', 'interval']) {
    if (!Number.isSafeInteger(card[field]) || card[field] < 0) throw new Error(`A card has an invalid ${field} value.`);
  }
  if (card.due > 8640000000000000 || card.updatedAt > 8640000000000000 || card.interval > 3650) throw new Error('A card has an out-of-range schedule.');
  return Object.fromEntries(['id', 'deck', 'front', 'back', 'notes', 'due', 'interval', 'reviews', 'lapses', 'updatedAt'].map(key => [key, card[key]]));
}

export function createCard(values, id = crypto.randomUUID(), now = Date.now()) {
  return validateCard({ id, deck: (values.deck || 'General').trim(), front: values.front.trim(), back: values.back.trim(), notes: (values.notes || '').trim(), due: now, interval: 0, reviews: 0, lapses: 0, updatedAt: now });
}

export function scheduleCard(card, rating, now = Date.now()) {
  if (!['again', 'good', 'easy'].includes(rating)) throw new Error('Unknown review rating.');
  const interval = rating === 'again' ? 0 : rating === 'good' ? Math.min(3650, Math.max(1, card.interval * 2)) : Math.min(3650, Math.max(4, card.interval * 3));
  return { ...card, interval, due: now + (rating === 'again' ? MINUTE : interval * DAY), reviews: card.reviews + 1, lapses: card.lapses + Number(rating === 'again'), updatedAt: now };
}

export function dueCards(cards, deck = '', now = Date.now()) {
  return cards.filter(card => (!deck || card.deck === deck) && card.due <= now).sort((a, b) => a.due - b.due || a.updatedAt - b.updatedAt || a.id.localeCompare(b.id));
}

export function parseBackup(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.cards) || parsed.cards.length > MAX_CARDS) throw new Error('Choose a Poker Memory flashcard backup (version 1, up to 5,000 cards).');
  const cards = parsed.cards.map(validateCard);
  if (new Set(cards.map(c => c.id)).size !== cards.length) throw new Error('The backup contains duplicate card IDs.');
  return cards;
}

export function mergeCards(existing, imported) {
  const result = new Map(existing.map(c => [c.id, c]));
  let added = 0, updated = 0, kept = 0;
  for (const card of imported) {
    const current = result.get(card.id);
    if (!current) { result.set(card.id, card); added++; }
    else if (card.updatedAt > current.updatedAt) { result.set(card.id, card); updated++; }
    else kept++;
  }
  if (result.size > MAX_CARDS) throw new Error('Import would exceed the 5,000-card limit.');
  return { cards: [...result.values()], added, updated, kept };
}
