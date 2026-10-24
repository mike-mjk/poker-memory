import { hands } from './range.js';

export function scoreAnswers(answers) {
  let correct = 0, wrong = 0, unfilled = 0;
  for (const hand of hands) {
    if (answers[hand.name] === undefined) unfilled++;
    else if (answers[hand.name] === Math.round(hand.frequency * 100)) correct++;
    else wrong++;
  }
  return { correct, wrong, unfilled };
}
