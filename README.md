# Poker Memory

A local preflop range matrix for the supplied Club WPT Gold 8-max cutoff raise-first-in range.

## Run locally

Install Node.js 20.19+ or 22.12+ (Node 24 works), then run:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite in your browser. Stop with Ctrl+C.

## Open without a development server

Run `npm run build`, then open `dist/poker-memory.html` directly in Chrome,
Firefox, Safari, or Edge. This standalone file includes the app code and styling;
it does not need Node.js or a server to run. You can copy it to another computer.
Browser storage for local files varies by browser, so use the development server
if you need a stable origin for saved practice progress. ChatGPT's visualization
viewer is not required to use this file.

## Use

- **Strategy:** inspect the supplied range. Red means raise, blue means fold; mixed cells split horizontally in proportion to their raise frequency. Click a hand for its exact percentages.
- **Fill in:** start with an unanswered matrix. Choose Raise, Fold, Mixed (enter a raise percentage), or Erase, then click or drag over hands. Keyboard users can tab to a hand and press Enter or Space.
- **Check range:** scores exact percentages and marks incorrect and unanswered cells. Hover or focus a marked hand for the correct answer.
- **Undo:** reverts the previous stroke or clear. **Clear:** resets practice answers. Switching to Strategy preserves your practice.

Practice progress is saved in this browser's local storage, separately from the supplied reference range. No accounts, server, external fonts, or API credentials are needed. Touch users can tap cells; drag painting works with a mouse.

The range is transcribed from the user-provided list in `src/range.js`; it has not been independently checked against Club WPT Gold. Unlisted hands fold. The opening percentage weights pairs by 6 combinations, suited hands by 4, and offsuit hands by 12.

```sh
npm test
npm run build
```

## Category exploration

The **Categories** tab highlights a category on the matrix and reports:

- Weighted raising combinations (including the precise mixed frequencies).
- Those raising combinations as a percentage of all 1,326 starting combinations.
- Those raising combinations as a percentage of the 451.30-combination opening range.
- The category's full possible combinations and its internal raise rate, separately
  from how much of it is opened.

For example, suited aces contribute 48 opening combinations: 3.62% of all deals,
10.64% of this raising range. Suited queens contribute 30.04 combinations because
Q4s raises only 51% and Q3s/Q2s fold.

Categories include suited/offsuit highest-card families, unpaired highest-card
families, any ace (including AA), pocket pairs, suited/offsuit Broadway, and suited
connectors and gappers. Definitions appear with each category. Broadway excludes
pairs. Gaps count ranks between cards with ace high only (A2s is not a connector).

These categories overlap. For a complete non-overlapping partition, use the suited
highest-card families, offsuit highest-card families, and pocket pairs. Highlighted
cells include both opening and folding members, so you can see the edge of a family.

**Contains rank, either card** adds unpaired “Has an ace”, “Has a king”, etc.,
through “Has a two”. These include both suit types and either card position:
“Has a king” includes AK as well as KQ, while king-high excludes AK. Pocket
pairs are excluded, so “Has a queen” excludes QQ. The existing “Any hand with
an ace” category still includes AA. Each unpaired hand belongs to two of the
new categories, so their percentages must not be added as a partition.

These categories work in composition and individual-hand training. On a Q-6-2
flop, the preflop “Has a queen” share is a starting point, not the final top-pair
frequency: remove blocked combinations, update the surviving range denominator,
and distinguish top pair from two pair (Q6/Q2) and other made hands.

Highest-card families show both their lowest hand with any raise frequency and
lowest 100%-raise hand. Exceptions are shown explicitly: A5o opens, but A6o folds;
Q4s mixes, while Q5s always raises. Do not infer a continuous range from a single
boundary.

## Interactive trainer

**Trainer** has three decks, each with a category filter:

- **Category composition:** estimate a category's share of the raising range, its
  raising share of all possible deals, or its weighted raising combos. Percentage
  estimates within 0.2 percentage points count; combination answers allow 0.05.
- **Opening boundaries:** recall the lowest hand that raises at any frequency,
  or the lowest pure raise. Only highest-card suited/offsuit families are eligible.
  Choose None for families with no qualifying open.
- **Individual hands:** recall the exact raise frequency and connect it to its
  family's opening boundary in the explanation.

Submit an answer to track accuracy, or reveal it without scoring. Missed and unseen
questions receive additional practice weight. History is stored locally, separately
from the fill-in matrix. No live requests or account are needed.

The **Categories** and **Trainer** tabs use preflop figures. Use **Flops** for
board-conditioned composition with card removal.

Category definitions and calculations live in `src/categories.js`; reusable deck
and grading logic lives in `src/trainer.js`. The UI is in `src/learning.js`.

## Flop explorer and estimation practice

Open **Flops**. Enter three exact cards, such as `Qs 6h 2d`, or deal a random
flop. Suit letters are `c` (clubs), `d` (diamonds), `h` (hearts), and `s` (spades).
Unicode suit symbols and `10` instead of `T` also work. Duplicate cards are rejected.
The texture selector can deal unpaired, rainbow, two-tone, monotone, paired, or
tripled boards. Presets give quick examples of each major texture.

The engine expands the opening range into physical two-card combinations, removes
every holding blocked by the board, preserves each remaining holding's raise
frequency, and renormalizes all class percentages by the surviving weighted range.
For example, Qs 6h 2d leaves 412.50 weighted combinations; 61.53 (14.92%) are top
pair. The original range has 451.30 weighted combinations before card removal.

**Explore** has two views:

- **Made hands:** one exclusive class per holding. Includes straight flushes,
  quads, full houses, flushes, straights, sets, hole-card trips, board-only trips,
  three kinds of two pair, overpairs, pocket pairs between board ranks,
  underpairs, top/middle/bottom pair, board-pair-only hands, and no-pair hands
  with or without a direct draw. These sum to 100%. Zero-frequency classes are
  hidden by default and can be shown.
- **Draws:** flush draws, open-ended straight draws, double gutshots, one-rank
  straight draws, combined flush/straight draws, and their union. Backdoor flush
  draws are listed separately. These rows overlap, so they do not sum to 100%.

Click a class to inspect its definition, formula, hand-type breakdown, and actual
suited card examples. The table reports surviving physical holdings separately
from fractional frequency-weighted combinations.

**Estimate** hides the distribution and asks for a class's percentage of the
surviving range. Choose a specific class or random nonzero classes. Answers within
one percentage point count as correct. Reveal an answer without scoring, practice
another class on the same board, or deal a new flop. The full breakdown is available
after answering. Flop practice totals are saved separately in browser storage.

Definitions in this first version:

- Top/middle/bottom pair apply to unpaired boards and exclude stronger made hands.
  On paired boards, board-pair-only hands, trips, and the two-pair subtypes are
  separate classes. A pocket pair plus a board pair is two pair, not an overpair.
- A direct straight draw needs a single additional rank, and the current made
  hand must be weaker than a straight. A234 and JQKA are one-rank draws; 2345 has
  two ends (ace or six). A straight can still have a flush draw.
- A backdoor flush draw requires three cards of one suit, with at least one hole
  card in that suit. Backdoor straight draws are not counted. “No direct draw”
  can still have backdoor potential.
- These are composition figures, not equity or guaranteed clean-out counts. No
  opponent range or postflop action is modeled. Random flops are uniform within
  the selected texture, not weighted by the likelihood of reaching them after
  opening a hand from this range.

Calculation logic lives in `src/flop.js`, independently from the UI in
`src/flop-ui.js`. Tests include independently counted full-deck distributions,
mixed-frequency blockers, paired/tripled/monotone/two-tone boards, draw unions,
and invariance under suit relabeling.

## Personal flashcards

**Flashcards** is a separate collection of user-written questions and answers,
independent of all generated range/category/flop drills. It starts with the
user-supplied fact:

- Front: “Button RFI: What is the lowest offsuit zero-gapper to open?”
- Back: “98o (9–8 offsuit). 98o opens; 87o folds.”

This does not add a button range to the calculation engine or assert a specific
raise frequency; it preserves the boundary the user supplied from their trainer.

Use **New card** to write a front, back, deck name, and optional notes/source.
Cards can be edited, searched, filtered by deck, or deleted with an undo option.
Editing a fact resets its interval and makes it immediately due, preserving its
review/lapse counts. Deleting all cards is supported; the starter is not silently
recreated on reload.

Review the question, choose **Show answer**, and self-rate:

- **Again:** due in one minute; resets the interval and adds a lapse.
- **Good:** due in one day initially, then doubles the previous interval.
- **Easy:** due in four days initially, then triples the previous interval.

Intervals cap at 3,650 days. This is a simple spaced-review schedule, not Anki's
scheduler. Due cards are reviewed first. **Practice ahead** allows another pass
when caught up; rating early also updates the schedule. Cards rated Again appear
when due (the active view refreshes periodically, or use Check due cards).

The collection and schedules are saved in a separate local-storage key. Export
JSON backups before changing the HTML filename, browser, or computer. **Import
backup** merges cards by ID: newer versions replace older matching IDs, and
unrelated current cards are preserved. Duplicate IDs, invalid records, oversized
backups, and unsupported formats are rejected before changing the collection.
If saved data is unreadable, it is protected; importing a valid backup archives
the unreadable bytes under a recovery key before restoring normal saves.

Model/backup logic lives in `src/flashcards.js`; UI code lives in
`src/flashcard-ui.js`. Scheduling, round-trip backups, merge behavior, due queues,
and the starter fact have automated tests.
