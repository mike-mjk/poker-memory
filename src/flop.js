import { range } from './range.js';

const rankChars = '23456789TJQKA';
export const suitChars = 'cdhs';
export const deck = [...rankChars].flatMap((symbol, i) => [...suitChars].map(suit => ({ rank: i + 2, suit, code: symbol + suit })));
const byCode = new Map(deck.map(card => [card.code, card]));

export function parseFlop(text) {
  const normalized = text.trim().replace(/10/gi, 'T').replace(/♣/g, 'c').replace(/♦/g, 'd').replace(/♥/g, 'h').replace(/♠/g, 's').replace(/[\s,]+/g, '');
  if (!/^(?:[2-9TJQKA][cdhs]){3}$/i.test(normalized)) throw new Error('Enter three cards, such as Qs 6h 2d. Use c, d, h, s for suits.');
  const cards = normalized.match(/.{2}/g).map(code => byCode.get(code[0].toUpperCase() + code[1].toLowerCase()));
  if (new Set(cards.map(c => c.code)).size !== 3) throw new Error('Each card must be different. The same card cannot appear twice.');
  return cards;
}

export function handName(a, b) {
  const [high, low] = a.rank >= b.rank ? [a, b] : [b, a];
  return rankChars[high.rank - 2] + rankChars[low.rank - 2] + (high.rank === low.rank ? '' : high.suit === low.suit ? 's' : 'o');
}

export function expandRange(frequencies = range) {
  const combos = [];
  for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) {
    const name = handName(deck[i], deck[j]);
    const weight = frequencies.get(name) ?? 0;
    if (weight > 0) combos.push({ cards: [deck[i], deck[j]], name, weight });
  }
  return combos;
}
const openingCombos = expandRange();

function straightHigh(values) {
  const set = new Set(values);
  if (set.has(14)) set.add(1);
  for (let high = 14; high >= 5; high--) if ([0, 1, 2, 3, 4].every(n => set.has(high - n))) return high;
  return 0;
}

export const madeClasses = [
  ['straight-flush', 'Straight flush', 'All five cards form a straight in one suit.'],
  ['quads', 'Four of a kind', 'Four cards of one rank. Includes a hole card matching a tripled flop rank.'],
  ['full-house', 'Full house', 'Three cards of one rank plus two of another.'],
  ['flush', 'Flush', 'All five cards share a suit; excludes straight flushes.'],
  ['straight', 'Straight', 'Five consecutive ranks, including A2345; excludes straight flushes.'],
  ['set', 'Set', 'A pocket pair matches a single board card to make three of a kind.'],
  ['trips', 'Trips — hole card matches board pair', 'One hole card matches a paired board rank; excludes full houses and quads.'],
  ['board-trips', 'Trips on the board only', 'All three flop cards have one rank; neither hole card matches it, and the hole cards are unpaired.'],
  ['two-pair', 'Two pair — both hole ranks paired', 'On an unpaired flop, each of your two different hole ranks matches a board rank.'],
  ['two-pair-pocket', 'Two pair — pocket pair + board pair', 'A pocket pair plus a different paired board rank.'],
  ['two-pair-board', 'Two pair — board pair + other rank', 'The board provides one pair, and one hole card pairs the other board rank.'],
  ['overpair', 'Overpair', 'A pocket pair above the highest flop card, on an unpaired board.'],
  ['pocket-below-top', 'Pocket pair between top and middle', 'A pocket pair below the highest flop rank but above the middle flop rank.'],
  ['pocket-below-middle', 'Pocket pair between middle and bottom', 'A pocket pair below the middle flop rank but above the lowest flop rank.'],
  ['underpair', 'Pocket pair below the board', 'A pocket pair below every flop rank.'],
  ['top-pair', 'Top pair', 'One hole card pairs the highest rank on an unpaired flop; excludes two pair and stronger hands.'],
  ['middle-pair', 'Middle pair', 'One hole card pairs the middle rank on an unpaired flop; excludes two pair and stronger hands.'],
  ['bottom-pair', 'Bottom pair', 'One hole card pairs the lowest rank on an unpaired flop; excludes two pair and stronger hands.'],
  ['board-pair', 'Board pair only', 'Your only pair is the pair already on the flop. Neither hole card makes another pair.'],
  ['unpaired-draw', 'No pair — direct draw', 'High-card hands with a flush draw or a one-card straight draw.'],
  ['unpaired-air', 'No pair — no direct draw', 'High-card hands without a flush draw or one-card straight draw. Backdoors may still exist.'],
].map(([id, label, description]) => ({ id, label, description, view: 'made' }));

export const drawClasses = [
  ['any-draw', 'Any direct draw', 'At least a flush draw or a one-card straight draw. Counts each combo once.'],
  ['flush-draw', 'Flush draw', 'Exactly four cards of one suit across the flop and your hand. One more suited card makes a flush.'],
  ['straight-draw', 'Any straight draw', 'A one-card rank can complete a straight, and your current made hand is weaker than a straight.'],
  ['open-ended', 'Open-ended straight draw', 'Four consecutive ranks can complete at either end. 2345 can complete with A or 6.'],
  ['double-gutshot', 'Double gutshot', 'Two different ranks can complete a straight, without an open-ended four-rank run.'],
  ['gutshot', 'Gutshot / one-rank straight draw', 'Only one rank completes a straight. Includes the one-sided A234 and JQKA edge cases.'],
  ['combo-draw', 'Flush + straight draw', 'Both a flush draw and a one-card straight draw. The shared combinations are counted once here.'],
  ['no-draw', 'No direct draw', 'No flush draw and no one-card straight draw; may include made hands and backdoors.'],
  ['backdoor-flush', 'Backdoor flush draw', 'Exactly three cards of a suit, including at least one hole card; needs that suit on both turn and river.'],
].map(([id, label, description]) => ({ id, label, description, view: 'draw' }));

export function classifyHand(hole, board) {
  const cards = [...hole, ...board];
  const counts = new Map();
  const suits = new Map();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
  }
  const multiplicities = [...counts.values()].sort((a, b) => b - a);
  const straight = straightHigh(cards.map(c => c.rank));
  const flush = [...suits.values()].includes(5);
  const pocket = hole[0].rank === hole[1].rank;
  const boardRanks = [...new Set(board.map(c => c.rank))].sort((a, b) => b - a);
  let made;
  if (flush && straight) made = 'straight-flush';
  else if (multiplicities[0] === 4) made = 'quads';
  else if (multiplicities[0] === 3 && multiplicities[1] === 2) made = 'full-house';
  else if (flush) made = 'flush';
  else if (straight) made = 'straight';
  else if (multiplicities[0] === 3) made = pocket ? 'set' : boardRanks.length === 1 ? 'board-trips' : 'trips';
  else if (multiplicities[0] === 2 && multiplicities[1] === 2) made = pocket ? 'two-pair-pocket' : boardRanks.length === 3 ? 'two-pair' : 'two-pair-board';
  else if (multiplicities[0] === 2) {
    if (pocket) made = hole[0].rank > boardRanks[0] ? 'overpair' : hole[0].rank > boardRanks[1] ? 'pocket-below-top' : hole[0].rank > boardRanks[2] ? 'pocket-below-middle' : 'underpair';
    else if (boardRanks.length < 3) made = 'board-pair';
    else {
      const pairedRank = [...counts].find(([, count]) => count === 2)[0];
      made = ['top-pair', 'middle-pair', 'bottom-pair'][boardRanks.indexOf(pairedRank)];
    }
  } else made = 'unpaired';

  const fd = [...suits.values()].includes(4);
  const backdoorFlush = [...suits].some(([suit, count]) => count === 3 && hole.some(c => c.suit === suit));
  const straightOutRanks = new Set();
  // A made flush or stronger cannot improve to a plain straight.
  if (!['straight-flush', 'quads', 'full-house', 'flush', 'straight'].includes(made)) {
    const values = new Set(cards.map(c => c.rank));
    if (values.has(14)) values.add(1);
    for (let high = 5; high <= 14; high++) {
      const missing = [0, 1, 2, 3, 4].map(n => high - n).filter(rank => !values.has(rank));
      if (missing.length === 1) straightOutRanks.add(missing[0] === 1 ? 14 : missing[0]);
    }
  }
  let straightDraw = null;
  if (straightOutRanks.size) {
    const values = new Set(cards.map(c => c.rank));
    let openEnded = false;
    for (let low = 2; low <= 10; low++) {
      if ([0, 1, 2, 3].every(n => values.has(low + n)) && straightOutRanks.has(low === 2 ? 14 : low - 1) && straightOutRanks.has(low + 4)) openEnded = true;
    }
    straightDraw = openEnded ? 'open-ended' : straightOutRanks.size > 1 ? 'double-gutshot' : 'gutshot';
  }
  const directDraw = fd || Boolean(straightDraw);
  if (made === 'unpaired') made = directDraw ? 'unpaired-draw' : 'unpaired-air';
  const draws = [directDraw ? 'any-draw' : 'no-draw'];
  if (fd) draws.push('flush-draw');
  if (straightDraw) draws.push('straight-draw', straightDraw);
  if (fd && straightDraw) draws.push('combo-draw');
  if (backdoorFlush) draws.push('backdoor-flush');
  return { made, draws, straightOutRanks: [...straightOutRanks] };
}

export function boardTexture(board) {
  const uniqueRanks = new Set(board.map(c => c.rank)).size;
  const uniqueSuits = new Set(board.map(c => c.suit)).size;
  return { ranks: uniqueRanks === 3 ? 'Unpaired' : uniqueRanks === 2 ? 'Paired' : 'Trips', suits: uniqueSuits === 1 ? 'Monotone' : uniqueSuits === 2 ? 'Two-tone' : 'Rainbow' };
}

export function analyzeFlop(board, combos = openingCombos) {
  if (board.length !== 3 || new Set(board.map(c => c.code)).size !== 3 || board.some(c => !byCode.has(c.code))) throw new Error('A flop requires three distinct valid cards.');
  const blocked = new Set(board.map(c => c.code));
  const buckets = new Map([...madeClasses, ...drawClasses].map(c => [c.id, { ...c, weight: 0, combos: [] }]));
  let totalWeight = 0;
  let physicalCombos = 0;
  for (const combo of combos) {
    if (combo.cards.some(c => blocked.has(c.code))) continue;
    const result = classifyHand(combo.cards, board);
    totalWeight += combo.weight;
    physicalCombos++;
    for (const id of [result.made, ...result.draws]) {
      const bucket = buckets.get(id);
      bucket.weight += combo.weight;
      bucket.combos.push(combo);
    }
  }
  for (const bucket of buckets.values()) bucket.percent = totalWeight ? bucket.weight / totalWeight * 100 : 0;
  return { board, texture: boardTexture(board), totalWeight, physicalCombos, buckets };
}

export function randomFlop(texture = 'any', random = Math.random) {
  const shuffle = values => {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  if (texture === 'trips') {
    const rank = Math.floor(random() * 13) + 2;
    return shuffle(deck.filter(c => c.rank === rank)).slice(0, 3);
  }
  if (texture === 'paired') {
    const [rank, other] = shuffle([...rankChars]);
    return [...shuffle(deck.filter(c => c.code[0] === rank)).slice(0, 2), shuffle(deck.filter(c => c.code[0] === other))[0]];
  }
  if (texture === 'monotone') {
    const suit = suitChars[Math.floor(random() * 4)];
    return shuffle(deck.filter(c => c.suit === suit)).slice(0, 3);
  }
  for (let attempt = 0; attempt < 2000; attempt++) {
    const board = shuffle(deck).slice(0, 3);
    const t = boardTexture(board);
    if (texture === 'any' || t.ranks === 'Unpaired' && (texture === 'unpaired' || texture === 'rainbow' && t.suits === 'Rainbow' || texture === 'two-tone' && t.suits === 'Two-tone')) return board;
  }
  throw new Error('Could not deal that texture. Please try again.');
}
