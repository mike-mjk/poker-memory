import { hands, weightedCombos } from './range.js';
import { categories, categoryStats, familyBoundary, familyForHand } from './categories.js';
import { buildDeck, checkAnswer, nextQuestion } from './trainer.js';

const fmt = value => value.toFixed(2).replace(/\.00$/, '');
const pct = value => `${fmt(value)}%`;
const frequency = hand => `${hand.name} (${Math.round(hand.frequency * 100)}%)`;
const historyKey = 'poker-memory:category-trainer:v1';
const metricNames = { rangePercent: 'Share of the raising range', allHandsPercent: 'Raising share of all possible deals', raisingCombos: 'Weighted raising combinations' };

export function initLearning({ onCategory, onTrain }) {
  let selected = categories.find(c => c.id === 'suited-A');
  let kind = 'composition';
  let metric = 'rangePercent';
  let pure = false;
  let categoryId = 'all';
  let question = null;
  let previous = '';
  let revealed = false;
  let records = {};
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [id, value] of Object.entries(saved)) {
        if (value && ['seen', 'correct', 'wrong', 'reveals'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)) records[id] = value;
      }
    }
  } catch { /* An unavailable store does not prevent practice. */ }

  const browser = document.querySelector('#category-browser');
  const details = document.querySelector('#category-details');
  const trainer = document.querySelector('#trainer-panel');
  browser.innerHTML = `<label for="category-search">Find a category</label><input id="category-search" type="search" placeholder="Aces, Broadway, connectors…"><p class="category-hint">Choose a lens to highlight its hands.</p><div id="category-list"></div>`;
  trainer.innerHTML = `<div class="trainer-settings"><div><h2>Range trainer</h2><p>Learn the proportions. Know the boundaries.</p></div><div class="trainer-selects"><label>Practice<select id="practice-kind"><option value="composition">Category composition</option><option value="boundary">Opening boundaries</option><option value="hand">Individual hands</option></select></label><label>Category<select id="practice-category"></select></label><label id="metric-label">Measure<select id="practice-metric"><option value="rangePercent">% of raising range</option><option value="allHandsPercent">% of all possible deals</option><option value="raisingCombos">Raising combinations</option></select></label><label id="boundary-label" hidden>Boundary<select id="boundary-rule"><option value="any">Any raise frequency</option><option value="pure">100% raises only</option></select></label></div></div><div class="trainer-layout"><section id="flashcard" class="flashcard" aria-live="polite"></section><aside class="trainer-guide"><h3>What you’re learning</h3><div id="trainer-guide-text"></div><div id="trainer-progress"></div><p>Unseen questions and previous mistakes appear more often. Revealing an answer does not count as a correct attempt.</p><p>All figures are preflop and use the supplied CO range. Board cards and card removal are not applied here.</p></aside></div>`;

  function saveRecords() {
    try { localStorage.setItem(historyKey, JSON.stringify(records)); }
    catch { document.querySelector('#trainer-storage').textContent = 'Progress lasts this session; browser storage is unavailable.'; }
  }

  function renderList() {
    const search = document.querySelector('#category-search').value.toLowerCase().trim();
    const filtered = categories.filter(c => `${c.name} ${c.description}`.toLowerCase().includes(search));
    const groups = [...new Set(filtered.map(c => c.group))];
    document.querySelector('#category-list').innerHTML = groups.map(group => `<section class="category-group"><h3>${group}</h3>${filtered.filter(c => c.group === group).map(c => `<button class="category-option ${selected.id === c.id ? 'active' : ''}" data-category="${c.id}" aria-pressed="${selected.id === c.id}"><span>${c.name}</span><small>${pct(categoryStats(c).rangePercent)}</small></button>`).join('')}</section>`).join('') || '<p class="empty-state">No categories match. Try “suited” or “ace”.</p>';
    for (const button of browser.querySelectorAll('[data-category]')) button.addEventListener('click', () => selectCategory(button.dataset.category));
  }

  function boundaryHTML(item) {
    const any = familyBoundary(item);
    const full = familyBoundary(item, true);
    return `<div class="boundary-card"><h3>Know the edge</h3><div class="edge-values"><p>Lowest hand with any raise<strong>${any.weakest ? frequency(any.weakest) : 'None — all fold'}</strong></p><p>Lowest hand always raised<strong>${full.weakest ? frequency(full.weakest) : 'None'}</strong></p></div>${any.holes.length ? `<p class="warning">There’s a gap: ${any.holes.map(h => h.name).join(', ')} ${any.holes.length === 1 ? 'folds' : 'fold'} above the lowest open. A boundary alone doesn’t describe this family.</p>` : '<p class="muted">No skipped hands above the lowest open in this family.</p>'}${full.holes.length ? `<p class="muted">For the 100%-raise boundary, ${full.holes.map(frequency).join(', ')} ${full.holes.length === 1 ? 'is' : 'are'} an exception above the lowest pure open.</p>` : ''}</div>`;
  }

  function renderCategory() {
    const stats = categoryStats(selected);
    details.innerHTML = `<div class="category-title"><div><p class="eyebrow">RANGE COMPOSITION</p><h2>${selected.name}</h2></div><button id="train-category" class="primary-button">Train this category →</button></div><p class="description">${selected.description}</p><div class="stat-cards"><div><span>Raising combinations</span><strong>${fmt(stats.raisingCombos)}</strong><small>of ${stats.rawCombos} possible combos in this category</small></div><div><span>Of all possible deals</span><strong>${pct(stats.allHandsPercent)}</strong><small>${fmt(stats.raisingCombos)} ÷ 1,326</small></div><div><span>Of your raising range</span><strong>${pct(stats.rangePercent)}</strong><small>${fmt(stats.raisingCombos)} ÷ ${fmt(weightedCombos)}</small></div></div><div class="proportion-visual"><span>Within your raising range</span><div role="img" aria-label="${selected.name} makes up ${pct(stats.rangePercent)} of the raising range"><i style="width:${stats.rangePercent}%"></i></div><b>${pct(stats.rangePercent)}</b></div><p class="math-note">Before applying the opening strategy, this entire category has ${stats.rawCombos} combos (${pct(stats.rawPercent)} of all deals). You raise ${pct(stats.raiseRate)} of those combos, after mixed frequencies.</p>${selected.family ? boundaryHTML(selected) : ''}<details class="combo-breakdown"><summary>See the hand-by-hand calculation (${stats.members.length} hand types)</summary><div class="breakdown-scroll"><table><thead><tr><th>Hand</th><th>Possible combos</th><th>Raise frequency</th><th>Raising combos</th></tr></thead><tbody>${stats.members.map(h => `<tr><th scope="row">${h.name}</th><td>${h.combos}</td><td>${Math.round(h.frequency * 100)}%</td><td>${fmt(h.combos * h.frequency)}</td></tr>`).join('')}</tbody></table></div></details><p class="overlap-note">Categories are lenses, and can overlap. Only the highest-card suited families + highest-card offsuit families + pocket pairs form a complete, non-overlapping partition. These are preflop figures, before board-card removal.</p><div class="matrix-caption"><span>Highlighted: all hands in this category</span><span>Red = raise · Blue = fold · Split = mixed</span></div>`;
    document.querySelector('#train-category').addEventListener('click', () => {
      kind = 'composition';
      categoryId = selected.id;
      document.querySelector('#practice-kind').value = kind;
      populateCategorySelect();
      onTrain();
      startQuestion();
    });
  }

  function selectCategory(id) {
    selected = categories.find(c => c.id === id) ?? selected;
    renderList();
    renderCategory();
    onCategory(selected);
  }

  function populateCategorySelect() {
    const available = kind === 'boundary' ? categories.filter(c => c.family) : categories.filter(c => c.id !== 'all');
    if (!available.some(c => c.id === categoryId)) categoryId = 'all';
    document.querySelector('#practice-category').innerHTML = `<option value="all">${kind === 'boundary' ? 'All suited / offsuit families' : kind === 'hand' ? 'All 169 hands' : 'All categories'}</option>` + available.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.querySelector('#practice-category').value = categoryId;
    document.querySelector('#metric-label').hidden = kind !== 'composition';
    document.querySelector('#boundary-label').hidden = kind !== 'boundary';
  }

  function renderProgress() {
    const values = Object.values(records);
    const correct = values.reduce((sum, r) => sum + r.correct, 0);
    const wrong = values.reduce((sum, r) => sum + r.wrong, 0);
    const reveals = values.reduce((sum, r) => sum + r.reveals, 0);
    document.querySelector('#trainer-progress').innerHTML = `<h3>Your practice</h3><div class="practice-numbers"><strong>${correct}<small>correct</small></strong><strong>${wrong}<small>to review</small></strong><strong>${reveals}<small>revealed</small></strong></div><p id="trainer-storage">History saved in this browser. ${correct + wrong ? `${Math.round(correct / (correct + wrong) * 100)}% accuracy on submitted answers.` : 'Submit an answer to start tracking accuracy.'}</p>`;
  }

  function startQuestion() {
    const deck = buildDeck(kind, categoryId, metric, pure);
    question = nextQuestion(deck, records, previous);
    if (!question) return;
    previous = question.id;
    revealed = false;
    renderQuestion();
  }

  function renderQuestion() {
    const card = document.querySelector('#flashcard');
    const isBoundary = kind === 'boundary';
    const isHand = kind === 'hand';
    const title = isHand ? question.hand.name : question.category.name;
    const prompt = isBoundary ? `What is the lowest-kicker hand that ${pure ? 'always raises (100%)' : 'raises at any frequency'}?` : isHand ? 'How often does this hand raise when action folds to the cutoff?' : metric === 'rangePercent' ? 'What percentage of your raising range comes from this category?' : metric === 'allHandsPercent' ? 'What percentage of all 1,326 possible deals are raises from this category?' : 'How many weighted raising combinations come from this category?';
    const input = isBoundary ? `<label for="trainer-answer">Lowest opening hand</label><select id="trainer-answer" required><option value="" disabled selected>Choose a hand</option>${question.boundary.members.map(h => `<option value="${h.name}">${h.name}</option>`).join('')}<option value="None">None — all fold under this rule</option></select>` : `<label for="trainer-answer">${isHand ? 'Raise frequency' : metricNames[metric]}</label><div class="trainer-input"><input id="trainer-answer" type="number" min="0" max="${metric === 'raisingCombos' && !isHand ? 1326 : 100}" step="any" required placeholder="Your estimate" autocomplete="off"><span>${metric === 'raisingCombos' && !isHand ? 'combos' : '%'}</span></div>`;
    card.innerHTML = `<div class="flashcard-meta"><span>${isBoundary ? 'OPENING BOUNDARY' : isHand ? 'HAND RECALL' : 'CATEGORY COMPOSITION'}</span><span>CO · RFI · 8-max</span></div><h2>${title}</h2><p class="question-prompt">${prompt}</p><form id="trainer-form">${input}<p class="answer-tolerance">${isBoundary ? 'Use the highest-card family shown. Choose None if no hand qualifies.' : isHand ? 'Exact raise percentage, including mixed frequencies.' : metric === 'raisingCombos' ? 'Includes mixed frequencies. Answers within 0.05 combos count.' : 'Estimate to one or two decimal places. Within 0.2 percentage points counts.'}</p><div class="trainer-buttons"><button type="submit" class="primary-button">Check answer</button><button type="button" id="reveal-answer" class="secondary-button">Reveal answer</button></div></form><div id="trainer-feedback" role="status"></div>`;
    document.querySelector('#trainer-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!revealed) showAnswer(document.querySelector('#trainer-answer').value);
    });
    document.querySelector('#reveal-answer').addEventListener('click', () => showAnswer(null));
    document.querySelector('#trainer-guide-text').innerHTML = isBoundary ? `<p>“Any raise” includes mixed hands. “100% raises only” asks for the lowest pure open.</p><p>A mixed hand can extend below the lowest pure raise. Learn both edges separately.</p><p>Some families skip hands above the lowest open. The answer will flag these gaps; a boundary is not always a continuous threshold.</p>` : isHand ? `<p>Recall the exact raise frequency, then connect the hand to its highest-card family.</p><p>After answering, see the family’s lowest open and any skipped hands above it.</p>` : `<p><b>Raising combos</b> = possible combos × raise frequency, summed over the category.</p><p><b>Of all possible deals</b> = category’s raising combos ÷ 1,326.</p><p><b>Of your raising range</b> = category’s raising combos ÷ ${fmt(weightedCombos)}.</p><p>These are different denominators. A suited hand has 4 combos, an offsuit hand 12, and a pair 6.</p>`;
    renderProgress();
  }

  function showAnswer(input) {
    if (revealed) return;
    revealed = true;
    const success = input === null ? null : checkAnswer(question, input);
    const record = records[question.id] ?? { seen: 0, correct: 0, wrong: 0, reveals: 0 };
    record.seen++;
    if (success === true) record.correct++;
    else if (success === false) record.wrong++;
    else record.reveals++;
    records[question.id] = record;
    renderProgress();
    saveRecords();
    let explanation;
    let answer;
    if (kind === 'boundary') {
      answer = question.expected;
      explanation = `${question.boundary.weakest ? `${frequency(question.boundary.weakest)} is the lowest qualifying hand.` : 'No hands in this family qualify.'}${question.boundary.holes.length ? ` Exceptions above this edge: ${question.boundary.holes.map(frequency).join(', ')}. Do not assume a continuous threshold.` : ''}`;
    } else if (kind === 'hand') {
      answer = `${question.expected}% raise / ${100 - question.expected}% fold`;
      const family = familyForHand(question.hand);
      const boundary = family ? familyBoundary(family) : null;
      explanation = family ? `${family.name}: lowest open ${boundary.weakest ? frequency(boundary.weakest) : 'none'}.${boundary.holes.length ? ` Skipped above the edge: ${boundary.holes.map(frequency).join(', ')}.` : ''}` : 'This is a pocket pair: 6 possible combinations before board cards.';
    } else {
      const stats = categoryStats(question.category);
      answer = metric === 'raisingCombos' ? `${fmt(question.expected)} combos` : pct(question.expected);
      explanation = `${fmt(stats.raisingCombos)} raising combos from ${stats.rawCombos} possible category combos. Of all deals: ${fmt(stats.raisingCombos)} ÷ 1,326 = ${pct(stats.allHandsPercent)}. Of the raising range: ${fmt(stats.raisingCombos)} ÷ ${fmt(weightedCombos)} = ${pct(stats.rangePercent)}.`;
    }
    for (const input of document.querySelectorAll('#trainer-form input, #trainer-form select, #trainer-form button')) input.disabled = true;
    document.querySelector('#trainer-feedback').innerHTML = `<div class="answer-feedback ${success === false ? 'answer-miss' : ''}"><p class="eyebrow">${success === null ? 'ANSWER REVEALED · NOT SCORED' : success ? 'CORRECT' : 'REVIEW THIS ONE'}</p><h3>${answer}</h3>${success === false ? `<p>Your answer: ${input}${kind === 'boundary' ? '' : metric === 'raisingCombos' && kind !== 'hand' ? ' combos' : '%'}</p>` : ''}<p>${explanation}</p></div><div class="trainer-buttons"><button id="next-question" class="primary-button">Next question →</button>${question.category ? '<button id="explore-answer" class="secondary-button">Explore this category</button>' : ''}</div>`;
    document.querySelector('#next-question').addEventListener('click', () => { startQuestion(); document.querySelector('#trainer-answer').focus(); });
    document.querySelector('#next-question').focus();
    document.querySelector('#explore-answer')?.addEventListener('click', () => {
      selectCategory(question.category.id);
      document.querySelector('[data-mode="categories"]').click();
    });
  }

  document.querySelector('#category-search').addEventListener('input', renderList);
  document.querySelector('#practice-kind').addEventListener('change', event => { kind = event.target.value; populateCategorySelect(); startQuestion(); });
  document.querySelector('#practice-category').addEventListener('change', event => { categoryId = event.target.value; startQuestion(); });
  document.querySelector('#practice-metric').addEventListener('change', event => { metric = event.target.value; startQuestion(); });
  document.querySelector('#boundary-rule').addEventListener('change', event => { pure = event.target.value === 'pure'; startQuestion(); });
  populateCategorySelect();
  selectCategory(selected.id);
  return {
    setMode(mode) {
      const exploring = mode === 'categories';
      browser.hidden = !exploring;
      details.hidden = !exploring;
      trainer.hidden = mode !== 'train';
      document.querySelector('#matrix-workspace').hidden = ['train','flops','flashcards','averages','plan'].includes(mode);
      document.querySelector('#matrix-workspace').classList.toggle('with-categories', exploring);
      if (mode === 'train' && !question) startQuestion();
    },
  };
}
