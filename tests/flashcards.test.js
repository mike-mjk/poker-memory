import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCard, createCard, scheduleCard, dueCards, parseBackup, mergeCards, DAY, MINUTE } from '../src/flashcards.js';
const now = 1700000000000;
const card = createCard({deck:'Button RFI',front:'Lowest offsuit zero-gapper?',back:'98o opens; 87o folds.'},'test-card',now);

test('starter card captures the supplied button fact, without inventing a raise frequency', () => {
  assert.match(seedCard.front,/Button RFI/);
  assert.match(seedCard.front,/lowest offsuit zero-gapper/);
  assert.match(seedCard.back,/98o opens; 87o folds/);
  assert.equal(seedCard.reviews,0);
});
test('card creation trims text, rejects empty facts, and initializes an immediately due schedule', () => {
  const c=createCard({deck:' Button RFI ',front:' Q ',back:' A '},'another',now);
  assert.equal(c.front,'Q'); assert.equal(c.notes,''); assert.equal(c.due,now);
  assert.throws(()=>createCard({front:' ',back:'A'},'bad',now));
});
test('Again, Good, and Easy schedule actual future reviews and preserve the fact', () => {
  const again=scheduleCard(card,'again',now);
  assert.equal(again.due,now+MINUTE); assert.equal(again.lapses,1); assert.equal(again.interval,0);
  const good=scheduleCard(card,'good',now);
  assert.equal(good.due,now+DAY); assert.equal(good.interval,1);
  const easy=scheduleCard(card,'easy',now);
  assert.equal(easy.due,now+4*DAY);
  assert.equal(scheduleCard(good,'good',now+DAY).interval,2);
  assert.equal(scheduleCard(easy,'easy',now+4*DAY).interval,12);
  assert.equal(good.front,card.front); assert.equal(good.reviews,1);
  assert.throws(()=>scheduleCard(card,'unknown',now));
});
test('due queue respects deck and time; failed cards return after one minute', () => {
  const failed=scheduleCard(card,'again',now);
  assert.equal(dueCards([failed],'Button RFI',now).length,0);
  assert.equal(dueCards([failed],'Button RFI',now+MINUTE).length,1);
  assert.equal(dueCards([card],'Cutoff RFI',now).length,0);
  const future=scheduleCard(card,'easy',now);
  assert.equal(dueCards([future],'',now+DAY).length,0);
});
test('backups round trip schedules and reject corrupt, duplicate, or non-text data', () => {
  const c=scheduleCard(card,'good',now);
  assert.deepEqual(parseBackup(JSON.stringify({version:1,cards:[c]})),[c]);
  for(const value of [{version:2,cards:[c]},{version:1,cards:[c,c]},{version:1,cards:[{...c,id:undefined}]},{version:1,cards:[{...c,front:''}]},{version:1,cards:[{...c,due:-1}]},{version:1,cards:[{...c,interval:5000}]}]) assert.throws(()=>parseBackup(JSON.stringify(value)));
  assert.deepEqual(parseBackup('{"version":1,"cards":[]}'),[]);
});
test('backup imports preserve unrelated cards and choose the newest version on ID collisions', () => {
  const updated={...card,back:'New answer',updatedAt:now+1};
  const other=createCard({deck:'Other',front:'Q2',back:'A2'},'other',now);
  const result=mergeCards([card],[updated,other]);
  assert.equal(result.added,1); assert.equal(result.updated,1);
  assert.equal(result.cards.length,2); assert.equal(result.cards[0].back,'New answer');
  const older=mergeCards(result.cards,[card]);
  assert.equal(older.kept,1); assert.equal(older.cards[0].back,'New answer');
});
