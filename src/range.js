export const ranks = 'AKQJT98765432'.split('');

// User-provided Club WPT Gold, 8-max, cutoff raise-first-in range.
export const rangeText = 'AA,AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,A3s,A2s,AKo,KK,KQs,KJs,KTs,K9s,K8s,K7s,K6s,K5s,K4s,K3s,K2s,AQo,KQo,QQ,QJs,QTs,Q9s,Q8s,Q7s,Q6s,Q5s,Q4s:0.51,AJo,KJo,QJo,JJ,JTs,J9s,J8s,J7s,J6s:0.62,ATo,KTo,QTo,JTo,TT,T9s,T8s,T7s,A9o,K9o,J9o:0.17,T9o:0.95,99,98s,97s,A8o,88,87s,86s,A7o,77,76s,66,65s,A5o,55,54s,44,33,22:0.89';

export function parseRange(text) {
  return new Map(text.split(',').map(entry => {
    const [hand, frequency = '1'] = entry.trim().split(':');
    const value = Number(frequency);
    if (!/^(?:([AKQJT98765432])\1|[AKQJT98765432]{2}[so])$/.test(hand) || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Invalid range entry: ${entry}`);
    }
    return [hand, value];
  }));
}

export const range = parseRange(rangeText);
export const hands = ranks.flatMap((a, row) => ranks.map((b, col) => {
  const name = row === col ? a + b : row < col ? a + b + 's' : b + a + 'o';
  return { name, row, col, frequency: range.get(name) ?? 0, combos: row === col ? 6 : row < col ? 4 : 12 };
}));
export const weightedCombos = hands.reduce((sum, hand) => sum + hand.combos * hand.frequency, 0);
export const openingPercent = weightedCombos / 1326 * 100;
