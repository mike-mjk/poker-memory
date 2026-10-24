import './style.css';
import { hands, openingPercent } from './range.js';
import { scoreAnswers } from './practice.js';
import { initLearning } from './learning.js';
import { initFlops } from './flop-ui.js';
import { initFlashcards } from './flashcard-ui.js';

const storageKey = 'poker-memory:club-wpt-gold:8max:co-rfi:v1';
let answers = {};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') {
    for (const hand of hands) if (Number.isInteger(saved[hand.name]) && saved[hand.name] >= 0 && saved[hand.name] <= 100) answers[hand.name] = saved[hand.name];
  }
} catch { /* Practice remains available if storage is disabled. */ }
let mode = 'strategy';
let brush = 100;
let checked = false;
let painting = false;
let history = [];
let lastPainted;
let highlightedCategory = null;
let learning;
let flops;
let flashcards;
const app = document.querySelector('#app');
app.innerHTML = `
<header>
  <div class="title"><h1>RFI <span>CO</span></h1><span class="context">Club WPT Gold · 8-max</span></div>
  <nav aria-label="Matrix mode"><button data-mode="strategy" class="active" aria-pressed="true">Strategy</button><button data-mode="fill" aria-pressed="false">Fill in</button><button data-mode="categories" aria-pressed="false">Categories</button><button data-mode="train" aria-pressed="false">Trainer</button><button data-mode="flops" aria-pressed="false">Flops</button><button data-mode="flashcards" aria-pressed="false">Flashcards</button></nav>
</header>
<section class="tools" aria-label="Matrix controls">
  <div id="study-tools"><span class="key"><i class="raise"></i> Raise</span><span class="key"><i class="fold"></i> Fold</span><span class="key"><i class="mixed"></i> Mixed</span><span class="opening">${openingPercent.toFixed(1)}% opening range</span></div>
  <div id="fill-tools" hidden>
    <div class="brushes" role="group" aria-label="Paint action"><button data-brush="100" class="selected"><i class="raise"></i> Raise</button><button data-brush="0"><i class="fold"></i> Fold</button><button data-brush="mixed"><i class="mixed"></i> Mixed</button><label class="mix-input" hidden><input id="mix-frequency" type="number" min="1" max="99" step="1" value="50" required aria-label="Mixed raise percentage">% raise</label><button data-brush="erase" aria-label="Erase hand">Erase</button></div>
    <div class="edit-actions"><button id="undo">Undo</button><button id="reset">Clear</button><button id="check" class="check-button">Check range</button></div>
  </div>
</section>
<section id="trainer-panel" hidden></section>
<section id="flop-panel" hidden></section>
<section id="flashcards-panel" hidden></section>
<main id="matrix-workspace"><aside id="category-browser" hidden></aside><section class="matrix-content"><section id="category-details" hidden></section><div class="range-grid" role="group" aria-label="Cutoff raise first in hand matrix"></div></section></main>
<footer><span id="status" role="status" aria-live="polite">Select a hand to see its frequencies.</span><span id="mode-note">Suited above diagonal · Offsuit below</span></footer>`;
const grid = document.querySelector('.range-grid');

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(answers)); }
  catch { document.querySelector('#mode-note').textContent = 'Browser storage unavailable; progress lasts this session.'; }
}
function saveUndo() { history.push({ ...answers }); if (history.length > 100) history.shift(); }
function progress() {
  document.querySelector('#status').textContent = `${Object.keys(answers).length} / 169 hands filled. Click or drag to paint; mixed values are raise percentages.`;
}
function paint(hand) {
  if (lastPainted === hand.name) return;
  lastPainted = hand.name;
  if (brush === null) delete answers[hand.name];
  else answers[hand.name] = brush;
  checked = false;
  persist();
  renderCells();
  progress();
}
for (const hand of hands) {
  const cell = document.createElement('button');
  cell.className = 'hand';
  cell.dataset.hand = hand.name;
  cell.innerHTML = `<span>${hand.name}</span>`;
  cell.addEventListener('pointerdown', event => {
    if (mode !== 'fill' || event.button !== 0) return;
    if (document.querySelector('#mix-frequency').checkValidity() === false && document.querySelector('[data-brush="mixed"]').classList.contains('selected')) { document.querySelector('#mix-frequency').reportValidity(); return; }
    event.preventDefault();
    cell.focus({ preventScroll: true });
    painting = true;
    lastPainted = null;
    saveUndo();
    paint(hand);
  });
  cell.addEventListener('pointerenter', () => { if (painting && mode === 'fill') paint(hand); });
  cell.addEventListener('click', event => {
    if (mode === 'fill') {
      if (event.detail === 0) { saveUndo(); lastPainted = null; paint(hand); }
    } else {
      document.querySelector('#status').textContent = `${hand.name} — Raise ${Math.round(hand.frequency * 100)}% · Fold ${100 - Math.round(hand.frequency * 100)}%`;
      for (const item of grid.children) item.classList.toggle('inspected', item === cell);
    }
  });
  cell.addEventListener('focus', () => {
    if (checked && mode === 'fill') {
      const expected = Math.round(hand.frequency * 100);
      const answer = answers[hand.name];
      document.querySelector('#status').textContent = `${hand.name}: ${answer === undefined ? 'unfilled' : `your answer ${answer}% raise`}. Correct: ${expected}% raise, ${100 - expected}% fold.`;
    }
  });
  grid.append(cell);
}
window.addEventListener('pointerup', () => { painting = false; lastPainted = null; });
window.addEventListener('pointercancel', () => { painting = false; lastPainted = null; });
window.addEventListener('blur', () => { painting = false; });

function renderCells() {
  hands.forEach((hand, index) => {
    const cell = grid.children[index];
    const value = mode === 'fill' ? answers[hand.name] : Math.round(hand.frequency * 100);
    cell.classList.toggle('category-dimmed', mode === 'categories' && highlightedCategory && !highlightedCategory.matches(hand));
    const error = checked && value !== Math.round(hand.frequency * 100);
    cell.classList.toggle('unfilled', value === undefined);
    cell.classList.toggle('incorrect', error);
    cell.classList.remove('inspected');
    cell.style.setProperty('--raise', `${value ?? 0}%`);
    const label = value === undefined ? `${hand.name}: unfilled` : `${hand.name}: raise ${value}%, fold ${100 - value}%`;
    const correction = error ? `; expected raise ${Math.round(hand.frequency * 100)}%` : '';
    cell.setAttribute('aria-label', label + correction);
    cell.title = label + correction;
  });
  document.querySelector('#undo').disabled = history.length === 0;
}
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => {
  mode = button.dataset.mode;
  checked = false;
  painting = false;
  for (const item of document.querySelectorAll('[data-mode]')) {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  }
  document.querySelector('.tools').hidden = mode === 'categories' || mode === 'train' || mode === 'flops' || mode === 'flashcards';
  document.querySelector('#fill-tools').hidden = mode !== 'fill';
  document.querySelector('#study-tools').hidden = mode !== 'strategy';
  document.querySelector('#mode-note').textContent = mode === 'fill' ? 'Practice progress saved in this browser' : 'Suited above diagonal · Offsuit below';
  learning?.setMode(mode);
  flops?.setMode(mode);
  flashcards?.setMode(mode);
  document.title = mode === 'flashcards' ? 'Poker Memory · Flashcards' : 'Poker Memory · CO Raise First In';
  document.querySelector('.title h1').innerHTML = mode === 'flashcards' ? 'Poker Memory' : 'RFI <span>CO</span>';
  document.querySelector('.context').textContent = mode === 'flashcards' ? 'Personal flashcards' : 'Club WPT Gold · 8-max';
  if (mode === 'fill') progress();
  else document.querySelector('#status').textContent = mode === 'train' ? 'Choose a practice type and category to train.' : mode === 'categories' ? 'Category percentages include mixed raise frequencies.' : 'Select a hand to see its frequencies.';
  if (mode === 'train' || mode === 'categories') document.querySelector('#mode-note').textContent = 'Preflop · No board-card removal';
  if (mode === 'flops') {
    document.querySelector('#status').textContent = 'Study a flop, then estimate its range composition.';
    document.querySelector('#mode-note').textContent = 'Board removal applied · CO RFI';
  }
  if (mode === 'flashcards') {
    document.querySelector('#status').textContent = 'Your own facts · Simple spaced review';
    document.querySelector('#mode-note').textContent = 'Keep a backup of your cards';
  }
  renderCells();
});
for (const button of document.querySelectorAll('[data-brush]')) button.addEventListener('click', () => {
  for (const item of document.querySelectorAll('[data-brush]')) {
    item.classList.toggle('selected', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  }
  const value = button.dataset.brush;
  document.querySelector('.mix-input').hidden = value !== 'mixed';
  brush = value === 'erase' ? null : value === 'mixed' ? Number(document.querySelector('#mix-frequency').value) : Number(value);
});
document.querySelector('#mix-frequency').addEventListener('input', event => {
  if (event.target.checkValidity() && event.target.value !== '') brush = Number(event.target.value);
});
document.querySelector('#undo').addEventListener('click', () => {
  if (!history.length) return;
  answers = history.pop(); checked = false; persist(); renderCells(); progress();
});
document.querySelector('#reset').addEventListener('click', () => {
  saveUndo(); answers = {}; checked = false; persist(); renderCells(); progress();
});
document.querySelector('#check').addEventListener('click', () => {
  checked = true;
  renderCells();
  const result = scoreAnswers(answers);
  document.querySelector('#status').textContent = `${result.correct} / 169 correct · ${result.wrong} incorrect · ${result.unfilled} unfilled. Outlined cells need attention; hover or focus for the answer.`;
});
renderCells();

learning = initLearning({
  onCategory(category) { highlightedCategory = category; renderCells(); },
  onTrain() { document.querySelector('[data-mode="train"]').click(); },
});
learning.setMode(mode);

flops = initFlops();
flops.setMode(mode);

flashcards = initFlashcards();
flashcards.setMode(mode);
