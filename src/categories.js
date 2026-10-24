import { ranks, hands, weightedCombos } from './range.js';

const familyLabels = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: 'Ten', '9': 'Nine', '8': 'Eight', '7': 'Seven', '6': 'Six', '5': 'Five', '4': 'Four', '3': 'Three', '2': 'Two' };
const unpaired = hand => hand.row !== hand.col;
const suited = hand => hand.name.endsWith('s');
const offsuit = hand => hand.name.endsWith('o');
const gap = hand => Math.abs(hand.row - hand.col) - 1;
const category = (id, name, group, description, matches, extra = {}) => ({ id, name, group, description, matches, ...extra });

export const categories = [
  category('all', 'Entire opening range', 'Overview', 'All 169 starting-hand types. Frequencies are weighted by actual card combinations.', () => true),
  category('pairs', 'Pocket pairs', 'Hand structure', 'All pocket pairs, AA through 22. Each pair has 6 combinations.', h => !unpaired(h)),
  category('suited', 'All suited hands', 'Hand structure', 'All unpaired suited hands. Each hand type has 4 combinations.', suited),
  category('offsuit', 'All offsuit hands', 'Hand structure', 'All unpaired offsuit hands. Each hand type has 12 combinations.', offsuit),
  ...ranks.map(rank => category(`contains-${rank}`, `Has ${rank === 'A' || rank === '8' ? 'an' : 'a'} ${familyLabels[rank].toLowerCase()} (unpaired)`, 'Contains rank, either card', `Unpaired hands containing ${rank === 'A' || rank === '8' ? 'an' : 'a'} ${familyLabels[rank].toLowerCase()}, suited or offsuit, whether it is the higher or lower card. Excludes ${rank}${rank}. These categories overlap: AK counts in both ace and king. This is a preflop share, not a board-conditioned top-pair probability.`, h => unpaired(h) && h.name.slice(0, 2).includes(rank))),
  ...ranks.slice(0, -1).map(rank => category(`suited-${rank}`, `Suited ${rank === '6' ? 'sixes' : familyLabels[rank].toLowerCase() + 's'}`, 'Suited by highest card', `${familyLabels[rank]}-high suited hands with a lower kicker. Higher-card hands belong to their own family; for example, KQs belongs to suited kings, not suited queens.`, h => suited(h) && h.name[0] === rank, { family: true, rank, kind: 's' })),
  ...ranks.slice(0, -1).map(rank => category(`offsuit-${rank}`, `Offsuit ${rank === '6' ? 'sixes' : familyLabels[rank].toLowerCase() + 's'}`, 'Offsuit by highest card', `${familyLabels[rank]}-high offsuit hands with a lower kicker. These families partition the unpaired offsuit hands by highest card.`, h => offsuit(h) && h.name[0] === rank, { family: true, rank, kind: 'o' })),
  ...ranks.slice(0, -1).map(rank => category(`high-${rank}`, `${familyLabels[rank]}-high (unpaired)`, 'Highest card, both suit types', `Unpaired ${familyLabels[rank].toLowerCase()}-high hands, suited and offsuit. Pocket pairs are excluded. “Ace-high” means an unpaired starting hand containing an ace; it is not a postflop hand-strength label here.`, h => unpaired(h) && h.name[0] === rank)),
  category('any-ace', 'Any hand with an ace', 'Overlapping patterns', 'Every starting hand containing an ace, including AA. This overlaps with suited aces, offsuit aces, and pocket pairs.', h => h.name.includes('A')),
  category('suited-broadway', 'Suited Broadway', 'Overlapping patterns', 'Two different ranks from A, K, Q, J, T, suited. Pocket pairs are excluded.', h => suited(h) && Math.max(h.row, h.col) <= 4),
  category('offsuit-broadway', 'Offsuit Broadway', 'Overlapping patterns', 'Two different ranks from A, K, Q, J, T, offsuit. Pocket pairs are excluded.', h => offsuit(h) && Math.max(h.row, h.col) <= 4),
  category('broadway-pairs', 'Broadway pocket pairs', 'Overlapping patterns', 'AA, KK, QQ, JJ, and TT.', h => !unpaired(h) && h.row <= 4),
  ...[0, 1, 2, 3].map(n => category(`suited-gap-${n}`, n === 0 ? 'Suited connectors (zero gaps)' : `Suited ${n === 1 ? 'one' : n === 2 ? 'two' : 'three'}-gappers`, 'Overlapping patterns', `${n === 0 ? 'Consecutive' : `${n} intervening`} ranks, suited, with ace treated as high only. ${n === 0 ? 'Includes AKs through 32s; A2s is not included.' : `For example, ${n === 1 ? 'AQs and 97s' : n === 2 ? 'AJs and T7s' : 'ATs and T6s'}.`} These overlap the highest-card families.`, h => suited(h) && gap(h) === n)),
  category('low-connectors', 'Suited connectors, 9-high or lower', 'Overlapping patterns', '98s, 87s, 76s, 65s, 54s, 43s, 32s. Excludes higher connectors such as T9s.', h => suited(h) && gap(h) === 0 && h.row >= 5),
  category('low-one-gappers', 'Suited one-gappers, 9-high or lower', 'Overlapping patterns', '97s, 86s, 75s, 64s, 53s, 42s. Exactly one rank lies between the two cards.', h => suited(h) && gap(h) === 1 && h.row >= 5),
];

export function categoryHands(item) {
  return hands.filter(item.matches).sort((a, b) => a.row - b.row || a.col - b.col);
}

export function categoryStats(item) {
  const members = categoryHands(item);
  const rawCombos = members.reduce((sum, h) => sum + h.combos, 0);
  const raisingCombos = members.reduce((sum, h) => sum + h.combos * h.frequency, 0);
  return {
    members, rawCombos, raisingCombos,
    rawPercent: rawCombos / 1326 * 100,
    allHandsPercent: raisingCombos / 1326 * 100,
    rangePercent: weightedCombos ? raisingCombos / weightedCombos * 100 : 0,
    raiseRate: rawCombos ? raisingCombos / rawCombos * 100 : 0,
  };
}

// Only highest-card suited/offsuit families have an unambiguous kicker boundary.
export function familyBoundary(item, pure = false) {
  if (!item.family) throw new Error('Boundary requires a highest-card family.');
  const members = categoryHands(item).sort((a, b) => ranks.indexOf(a.name[1]) - ranks.indexOf(b.name[1]));
  const qualifies = h => pure ? h.frequency === 1 : h.frequency > 0;
  const qualifying = members.filter(qualifies);
  const weakest = qualifying.at(-1) ?? null;
  const holes = weakest ? members.filter(h => ranks.indexOf(h.name[1]) < ranks.indexOf(weakest.name[1]) && !qualifies(h)) : [];
  return { weakest, holes, qualifying, members };
}

export function familyForHand(hand) {
  return categories.find(item => item.family && item.matches(hand)) ?? null;
}
