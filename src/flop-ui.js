import { weightedCombos } from './range.js';
import { parseFlop, analyzeFlop, randomFlop, madeClasses, drawClasses } from './flop.js';

const fmt = n => n.toFixed(2).replace(/\.00$/, '');
const pct = n => `${fmt(n)}%`;
const suitSymbols = { c: '♣', d: '♦', h: '♥', s: '♠' };
const cardHTML = card => `<span class="playing-card suit-${card.suit}" aria-label="${card.code}"><b>${card.code[0]}</b><span>${suitSymbols[card.suit]}</span></span>`;
const miniCards = cards => cards.map(c => `<span class="mini-card suit-${c.suit}">${c.code[0]}${suitSymbols[c.suit]}</span>`).join('');
const historyKey = 'poker-memory:flop-trainer:v1';

export function initFlops() {
  const panel = document.querySelector('#flop-panel');
  let board = parseFlop('Qs 6h 2d');
  let analysis = analyzeFlop(board);
  let view = 'made';
  let mode = 'explore';
  let selectedId = 'top-pair';
  let questionId = null;
  let lastQuestion = null;
  let answered = false;
  let showDistribution = false;
  let guesses = { correct: 0, wrong: 0, revealed: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey));
    if (saved && ['correct', 'wrong', 'revealed'].every(key => Number.isSafeInteger(saved[key]) && saved[key] >= 0)) guesses = saved;
  } catch { /* The trainer also works without storage. */ }

  panel.innerHTML = `<div class="flop-heading"><div><p class="eyebrow">PREFLOP → FLOP</p><h2>Read the range on the board.</h2><p>CO opening range · Physical card removal · Mixed frequencies preserved</p></div><div class="flop-mode" role="group" aria-label="Flop practice mode"><button data-flop-mode="explore" class="active" aria-pressed="true">Explore</button><button data-flop-mode="estimate" aria-pressed="false">Estimate</button></div></div>
  <section class="board-controls" aria-label="Choose a flop"><form id="flop-form"><label for="flop-input">Flop cards</label><div class="flop-entry"><input id="flop-input" value="Qs 6h 2d" required autocomplete="off" spellcheck="false" aria-describedby="flop-help flop-error"><button class="secondary-button" type="submit">Apply flop</button></div><small id="flop-help">Example: Qs 6h 2d · c ♣ · d ♦ · h ♥ · s ♠</small></form><div class="random-controls"><label for="flop-texture">Deal a texture</label><div class="flop-entry"><select id="flop-texture"><option value="any">Any flop</option><option value="unpaired">Unpaired</option><option value="rainbow">Unpaired rainbow</option><option value="two-tone">Unpaired two-tone</option><option value="monotone">Monotone</option><option value="paired">Paired</option><option value="trips">Trips on board</option></select><button id="deal-flop" class="primary-button">Deal flop ↻</button></div></div><p id="flop-error" role="alert"></p></section>
  <div class="flop-presets" role="group" aria-label="Example boards"><span>Try a board</span><button data-board="Qs 6h 2d">Q♠ 6♥ 2♦</button><button data-board="Kh 8h 3h">K♥ 8♥ 3♥</button><button data-board="Js Ts 6d">J♠ T♠ 6♦</button><button data-board="9c 9d 4s">9♣ 9♦ 4♠</button><button data-board="Ac Ad Ah">A♣ A♦ A♥</button></div>
  <section class="flop-overview"><div id="board-display" class="board-display"></div><div class="flop-overview-numbers"><div><span>Surviving weighted combos</span><strong id="surviving-combos"></strong></div><div><span>Removed by board cards</span><strong id="blocked-combos"></strong></div><p id="board-texture"></p></div></section>
  <p class="flop-denominator" id="flop-denominator"></p>
  <div class="flop-view-controls"><div role="group" aria-label="Flop class view"><button data-flop-view="made" class="active" aria-pressed="true">Made hands</button><button data-flop-view="draw" aria-pressed="false">Draws</button></div><label id="empty-classes-label"><input type="checkbox" id="show-empty-classes"> Show zero-frequency classes</label></div>
  <section id="flop-estimation" class="flop-estimation" hidden></section>
  <section id="flop-distribution"><p class="class-view-note" id="class-view-note"></p><div class="flop-results-layout"><section id="flop-class-list" aria-label="Range distribution"></section><aside id="flop-class-detail" class="flop-class-detail" aria-live="polite"></aside></div></section>
  <details class="flop-definitions"><summary>How this first version counts hands and draws</summary><p>Each legal two-card holding retains its supplied preflop raise frequency. Board-blocked holdings are removed entirely. Every class percentage uses the remaining weighted range as its denominator; no opponent range or postflop action is applied.</p><p>Made-hand classes are mutually exclusive and exhaustive. The strongest five-card made hand wins: flushes, straights, sets, two pair, and so on. A pocket pair below the top card is split by its position relative to the middle and bottom cards. Top, middle, and bottom pair apply to unpaired boards only.</p><p>Direct draws mean four cards to a flush or a one-card straight completion. Open-ended draws have two ends; double gutshots have two completing ranks without an open-ended run. A234 and JQKA count as one-rank draws. Straight draws are excluded when you already have a straight or stronger made hand. Flush draws can coexist with a made straight.</p><p>Backdoor flush draws require exactly three cards of a suit and at least one hole card in that suit. Backdoor straights are not counted. “No direct draw” does not mean no backdoor potential. Draw percentages overlap and must not be added together.</p><p>Completing a draw does not guarantee winning: draws may be dominated or fail to beat a full house. This is a range-composition tool, not an equity calculator. Flops are dealt uniformly from the deck within the selected texture, not weighted by how often your opening range reaches each board.</p></details>`;

  const classes = () => view === 'made' ? madeClasses : drawClasses;
  const bucket = id => analysis.buckets.get(id);
  function persist() {
    try { localStorage.setItem(historyKey, JSON.stringify(guesses)); }
    catch { /* Practice remains usable without persistent scores. */ }
  }
  function updateBoard(next) {
    board = next;
    analysis = analyzeFlop(board);
    document.querySelector('#flop-input').value = board.map(c => c.code).join(' ');
    document.querySelector('#flop-error').textContent = '';
    document.querySelector('#flop-input').removeAttribute('aria-invalid');
    if (!bucket(selectedId)?.weight) selectedId = classes().find(c => bucket(c.id).weight > 0)?.id ?? classes()[0].id;
    showDistribution = false;
    renderOverview();
    if (mode === 'estimate') newQuestion();
    else renderResults();
  }
  function renderOverview() {
    document.querySelector('#board-display').innerHTML = board.map(cardHTML).join('');
    document.querySelector('#surviving-combos').textContent = fmt(analysis.totalWeight);
    document.querySelector('#blocked-combos').textContent = fmt(weightedCombos - analysis.totalWeight);
    document.querySelector('#board-texture').textContent = `${analysis.texture.ranks} · ${analysis.texture.suits}`;
    document.querySelector('#flop-denominator').textContent = `All percentages below divide by ${fmt(analysis.totalWeight)} surviving weighted combinations. Before card removal: ${fmt(weightedCombos)}.`;
  }

  function renderResults() {
    const visible = mode === 'explore' || showDistribution;
    document.querySelector('#flop-distribution').hidden = !visible;
    document.querySelector('#empty-classes-label').hidden = !visible;
    if (!visible) return;
    document.querySelector('#class-view-note').textContent = view === 'made' ? 'Made hands form a complete partition: each combo appears once, totaling 100%. Click a class to inspect its actual holdings.' : 'Draws overlap with made hands and with each other. “Any direct draw” counts the union once; the rows do not sum to 100%.';
    const showEmpty = document.querySelector('#show-empty-classes').checked;
    const rows = classes().filter(c => showEmpty || bucket(c.id).weight > 0);
    if (!rows.some(c => c.id === selectedId)) selectedId = rows[0]?.id;
    document.querySelector('#flop-class-list').innerHTML = rows.map(c => {
      const b = bucket(c.id);
      return `<button class="flop-class-row ${c.id === selectedId ? 'active' : ''}" data-flop-class="${c.id}" aria-pressed="${c.id === selectedId}"><span class="class-row-label">${c.label}<small>${fmt(b.weight)} weighted combos</small></span><span class="class-row-track"><i style="width:${b.percent}%"></i></span><b>${pct(b.percent)}</b></button>`;
    }).join('');
    for (const button of panel.querySelectorAll('[data-flop-class]')) button.addEventListener('click', () => { selectedId = button.dataset.flopClass; renderResults(); });
    renderClassDetail();
  }

  function renderClassDetail() {
    const b = bucket(selectedId);
    const detail = document.querySelector('#flop-class-detail');
    if (!b) { detail.innerHTML = ''; return; }
    const groups = new Map();
    for (const combo of b.combos) {
      if (!groups.has(combo.name)) groups.set(combo.name, { count: 0, weight: 0, frequency: combo.weight, examples: [] });
      const group = groups.get(combo.name);
      group.count++;
      group.weight += combo.weight;
      if (group.examples.length < 3) group.examples.push(combo.cards);
    }
    detail.innerHTML = `<p class="eyebrow">INSIDE THIS CLASS</p><h3>${b.label}</h3><div class="class-detail-percent">${pct(b.percent)}</div><p>${b.description}</p><p class="class-formula">${fmt(b.weight)} ÷ ${fmt(analysis.totalWeight)} = ${pct(b.percent)}</p><p>${b.combos.length} legal physical holdings, weighted by their opening frequencies.</p>${groups.size ? `<div class="flop-holdings-scroll"><table><thead><tr><th>Hand</th><th>Legal</th><th>Raise</th><th>Weight</th></tr></thead><tbody>${[...groups].sort((a, b) => b[1].weight - a[1].weight).map(([name, group]) => `<tr><th scope="row">${name}</th><td>${group.count}</td><td>${Math.round(group.frequency * 100)}%</td><td>${fmt(group.weight)}</td></tr>`).join('')}</tbody></table></div><h4>Actual holding examples</h4><div class="holding-examples">${b.combos.slice(0, 8).map(c => `<span>${miniCards(c.cards)}<small>× ${c.weight}</small></span>`).join('')}</div>` : '<p>No opening combinations fall in this class on this flop.</p>'}`;
  }

  function newQuestion() {
    const target = document.querySelector('#flop-target')?.value ?? 'random';
    const options = classes().filter(c => bucket(c.id).weight > 0 && bucket(c.id).percent < 99.999 && c.id !== lastQuestion);
    questionId = target !== 'random' ? target : (options.length ? options[Math.floor(Math.random() * options.length)].id : classes()[0].id);
    lastQuestion = questionId;
    answered = false;
    showDistribution = false;
    renderEstimation(target);
    renderResults();
  }

  function renderEstimation(target = 'random') {
    const b = bucket(questionId);
    document.querySelector('#flop-estimation').innerHTML = `<div class="flop-question"><div><p class="eyebrow">ESTIMATE THE FLOP</p><h3>${b.label}</h3><p>${b.description}</p><p>What percentage of your surviving opening range belongs to this class?</p></div><label class="target-select">Practice class<select id="flop-target"><option value="random">Random nonzero class</option>${classes().map(c => `<option value="${c.id}">${c.label}</option>`).join('')}</select></label></div><form id="flop-answer-form"><label for="flop-answer">Your estimate</label><div class="flop-answer-controls"><div class="trainer-input"><input id="flop-answer" type="number" min="0" max="100" step="any" required placeholder="0–100" autocomplete="off"><span>%</span></div><button type="submit" class="primary-button">Check estimate</button><button id="flop-reveal" class="secondary-button" type="button">Reveal answer</button></div><small>Within 1 percentage point counts. Zero-frequency classes can be selected explicitly.</small></form><div id="flop-feedback" role="status"></div><p id="flop-score" class="flop-score"></p>`;
    const targetSelect = document.querySelector('#flop-target');
    targetSelect.value = classes().some(c => c.id === target) ? target : 'random';
    targetSelect.addEventListener('change', newQuestion);
    document.querySelector('#flop-answer-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!answered) reveal(Number(document.querySelector('#flop-answer').value));
    });
    document.querySelector('#flop-reveal').addEventListener('click', () => reveal(null));
    renderScore();
  }
  function renderScore() {
    const submitted = guesses.correct + guesses.wrong;
    document.querySelector('#flop-score').textContent = `${guesses.correct} correct · ${guesses.wrong} to review · ${guesses.revealed} revealed${submitted ? ` · ${Math.round(guesses.correct / submitted * 100)}% accuracy` : ''}. Flop practice history is saved separately in this browser when storage is available.`;
  }
  function reveal(answer) {
    if (answered) return;
    answered = true;
    const b = bucket(questionId);
    const correct = answer === null ? null : Math.abs(answer - b.percent) <= 1 + Number.EPSILON * 100;
    guesses[correct === null ? 'revealed' : correct ? 'correct' : 'wrong']++;
    persist();
    renderScore();
    for (const element of document.querySelectorAll('#flop-answer-form input, #flop-answer-form button')) element.disabled = true;
    const examples = b.combos.slice(0, 3).map(c => miniCards(c.cards)).join(' / ');
    document.querySelector('#flop-feedback').innerHTML = `<div class="answer-feedback ${correct === false ? 'answer-miss' : ''}"><p class="eyebrow">${correct === null ? 'REVEALED · NOT SCORED' : correct ? 'CORRECT' : 'REVIEW THIS ONE'}</p><h3>${pct(b.percent)}</h3><p>${answer === null ? '' : `Your estimate: ${answer}%. `}${fmt(b.weight)} weighted combos ÷ ${fmt(analysis.totalWeight)} surviving weighted combos × 100.</p><p>${examples || 'No legal opening combos belong to this class.'}</p></div><div class="trainer-buttons"><button class="primary-button" id="flop-next-question">Another class →</button><button class="secondary-button" id="flop-show-results">Explore full breakdown</button></div>`;
    document.querySelector('#flop-next-question').addEventListener('click', () => { newQuestion(); document.querySelector('#flop-answer').focus(); });
    document.querySelector('#flop-show-results').addEventListener('click', () => {
      showDistribution = true;
      selectedId = questionId;
      renderResults();
      document.querySelector('#flop-distribution').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.querySelector('#flop-next-question').focus();
  }

  document.querySelector('#flop-form').addEventListener('submit', event => {
    event.preventDefault();
    try { updateBoard(parseFlop(document.querySelector('#flop-input').value)); }
    catch (error) {
      document.querySelector('#flop-error').textContent = error.message;
      document.querySelector('#flop-input').setAttribute('aria-invalid', 'true');
    }
  });
  document.querySelector('#deal-flop').addEventListener('click', () => {
    try { updateBoard(randomFlop(document.querySelector('#flop-texture').value)); }
    catch (error) { document.querySelector('#flop-error').textContent = error.message; }
  });
  for (const button of panel.querySelectorAll('[data-board]')) button.addEventListener('click', () => updateBoard(parseFlop(button.dataset.board)));
  for (const button of panel.querySelectorAll('[data-flop-mode]')) button.addEventListener('click', () => {
    mode = button.dataset.flopMode;
    for (const item of panel.querySelectorAll('[data-flop-mode]')) {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    }
    document.querySelector('#flop-estimation').hidden = mode !== 'estimate';
    if (mode === 'estimate') newQuestion();
    else renderResults();
  });
  for (const button of panel.querySelectorAll('[data-flop-view]')) button.addEventListener('click', () => {
    view = button.dataset.flopView;
    selectedId = classes().find(c => bucket(c.id).weight > 0)?.id ?? classes()[0].id;
    for (const item of panel.querySelectorAll('[data-flop-view]')) {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    }
    // Changing views also resets the selected target to this view's classes.
    questionId = null;
    document.querySelector('#flop-target')?.remove();
    if (mode === 'estimate') newQuestion();
    else renderResults();
  });
  document.querySelector('#show-empty-classes').addEventListener('change', renderResults);
  renderOverview();
  renderResults();
  return { setMode(activeMode) { panel.hidden = activeMode !== 'flops'; } };
}
