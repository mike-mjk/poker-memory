import { seedCard, createCard, scheduleCard, dueCards, parseBackup, mergeCards, MAX_CARDS } from './flashcards.js';

const storageKey = 'poker-memory:personal-flashcards:v1';
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const intervalLabel = card => card.interval ? `${card.interval} day${card.interval === 1 ? '' : 's'}` : '1 min';
const dateLabel = timestamp => new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function initFlashcards() {
  const panel = document.querySelector('#flashcards-panel');
  let cards = [{ ...seedCard }];
  let selectedDeck = '';
  let current = null;
  let revealed = false;
  let active = false;
  let editingId = null;
  let lastDeleted = null;
  let practiceAhead = false;
  let practiceQueue = [];
  let storageWarning = '';
  let unreadableBackup = null;
  let previousFocus = null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      try { cards = parseBackup(saved); }
      catch { unreadableBackup = saved; storageWarning = 'Saved flashcards could not be read. The original data has been preserved. Export it for recovery, or import a valid backup to restore your collection.'; }
    }
  } catch { storageWarning = 'Browser storage is unavailable. Cards work for this session; export a backup to keep them.'; }

  panel.innerHTML = `<div class="personal-heading"><div><p class="eyebrow">YOUR OWN STUDY NOTES</p><h2>One fact. Make it stick.</h2><p>Write the exact things you want to remember. Review them a little at a time.</p></div><button id="new-flashcard" class="primary-button">+ New card</button></div><div class="personal-toolbar"><label for="personal-deck">Deck<select id="personal-deck"></select></label><div id="personal-counts"></div><div class="personal-backups"><button class="secondary-button" id="export-flashcards">Export backup</button><button class="secondary-button" id="import-flashcards">Import backup</button><input type="file" id="flashcard-import-file" accept=".json,application/json" hidden></div></div><p id="flashcard-storage-warning" class="flashcard-warning" role="status"></p><p id="flashcard-notice" class="personal-notice" role="status"></p><section id="personal-review" class="personal-review" aria-live="polite"></section><section class="personal-library"><div class="personal-library-heading"><h3>Your cards</h3><label>Find a card<input type="search" id="personal-search" placeholder="Search questions, answers, decks…"></label></div><p class="personal-library-note">Your collection of facts and boundaries. Open an answer below to read it, or edit a card as you learn more.</p><div id="personal-card-list"></div></section><p class="personal-storage-note">Cards and schedules are stored in this browser. Export a backup before changing browsers, computers, or replacing the HTML file; import it if your saved cards don’t appear.</p><dialog id="flashcard-editor"><form id="flashcard-edit-form"><div class="editor-heading"><h3 id="flashcard-editor-title">New card</h3><button type="button" id="close-flashcard-editor" aria-label="Close card editor">×</button></div><label for="card-deck">Deck</label><input id="card-deck" name="deck" maxlength="80" required list="personal-deck-names" placeholder="e.g. Button RFI"><datalist id="personal-deck-names"></datalist><label for="card-front">Question / front</label><textarea id="card-front" name="front" maxlength="500" required rows="3" placeholder="What specific fact do you want to remember?"></textarea><label for="card-back">Answer / back</label><textarea id="card-back" name="back" maxlength="5000" required rows="4" placeholder="Keep the answer short and precise."></textarea><label for="card-notes">Notes / source <span>(optional)</span></label><textarea id="card-notes" name="notes" maxlength="3000" rows="2" placeholder="Range context, exceptions, or where you checked this fact."></textarea><p id="card-editor-error" role="alert"></p><div class="trainer-buttons"><button type="submit" class="primary-button">Save card</button><button type="button" id="cancel-flashcard-editor" class="secondary-button">Cancel</button></div></form></dialog>`;
  const editor = document.querySelector('#flashcard-editor');
  const notice = message => { document.querySelector('#flashcard-notice').textContent = message; };
  const inDeck = () => cards.filter(c => !selectedDeck || c.deck === selectedDeck);
  function persist() {
    if (unreadableBackup !== null) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, cards }));
      storageWarning = '';
    } catch { storageWarning = 'Changes could not be saved in this browser. Export a backup now to keep your cards and progress.'; }
    document.querySelector('#flashcard-storage-warning').textContent = storageWarning;
  }
  function renderDecks() {
    const decks = [...new Set(cards.map(c => c.deck))].sort((a, b) => a.localeCompare(b));
    if (selectedDeck && !decks.includes(selectedDeck)) selectedDeck = '';
    document.querySelector('#personal-deck').innerHTML = '<option value="">All decks</option>' + decks.map(name => `<option value="${escape(name)}">${escape(name)}</option>`).join('');
    document.querySelector('#personal-deck').value = selectedDeck;
    document.querySelector('#personal-deck-names').innerHTML = decks.map(name => `<option value="${escape(name)}"></option>`).join('');
  }
  function renderCounts() {
    const due = dueCards(cards, selectedDeck).length;
    document.querySelector('#personal-counts').innerHTML = `<strong>${due}<span>due now</span></strong><strong>${inDeck().length}<span>cards in ${selectedDeck ? 'deck' : 'all decks'}</span></strong>`;
  }
  function chooseCard() {
    if (practiceAhead) {
      while (practiceQueue.length && !cards.some(c => c.id === practiceQueue[0])) practiceQueue.shift();
      current = cards.find(c => c.id === practiceQueue[0]) ?? null;
      if (!current) practiceAhead = false;
    }
    if (!practiceAhead) current = dueCards(cards, selectedDeck)[0] ?? null;
    revealed = false;
    renderReview();
    renderCounts();
  }
  function renderReview() {
    const target = document.querySelector('#personal-review');
    if (!current) {
      const next = inDeck().filter(c => c.due > Date.now()).sort((a, b) => a.due - b.due)[0];
      target.innerHTML = `<div class="review-empty"><span class="review-check">${inDeck().length ? '✓' : '+'}</span><h3>${inDeck().length ? 'You’re caught up.' : 'Your next useful fact starts here.'}</h3><p>${next ? `Next review: ${escape(dateLabel(next.due))}.` : 'Add a question and a clear answer to start practicing.'}</p><div class="trainer-buttons">${inDeck().length ? '<button id="practice-ahead" class="secondary-button">Practice ahead</button><button id="refresh-due" class="secondary-button">Check due cards</button>' : '<button id="add-empty-card" class="primary-button">Create a card</button>'}</div><p class="review-hint">Again returns a card in 1 minute. Good and Easy space it over days.</p></div>`;
      document.querySelector('#practice-ahead')?.addEventListener('click', () => {
        practiceAhead = true;
        practiceQueue = inDeck().sort((a,b) => a.due - b.due).map(c => c.id);
        chooseCard();
      });
      document.querySelector('#refresh-due')?.addEventListener('click', chooseCard);
      document.querySelector('#add-empty-card')?.addEventListener('click', () => openEditor());
      return;
    }
    target.innerHTML = `<div class="personal-review-meta"><span>${escape(current.deck)}</span><span>${practiceAhead ? 'PRACTICING AHEAD · RATINGS UPDATE THE SCHEDULE' : current.reviews ? 'REVIEW' : 'NEW CARD'}</span></div><div class="personal-question"><p class="eyebrow">QUESTION</p><h3>${escape(current.front)}</h3></div><div id="personal-answer-area">${revealed ? `<div class="personal-answer"><p class="eyebrow">ANSWER</p><p>${escape(current.back)}</p>${current.notes ? `<div class="personal-card-notes">${escape(current.notes)}</div>` : ''}</div><p class="rating-prompt">How well did you remember it?</p><div class="personal-ratings">${[['again','Again'],['good','Good'],['easy','Easy']].map(([rating,label])=>`<button data-personal-rating="${rating}"><b>${label}</b><span>${intervalLabel(scheduleCard(current, rating))}</span></button>`).join('')}</div>` : '<button id="show-personal-answer" class="primary-button">Show answer <span>↵</span></button><p class="review-hint">Try to recall it before revealing the answer.</p>'}</div><button class="personal-edit-current" id="edit-review-card">Edit this card</button>`;
    document.querySelector('#show-personal-answer')?.addEventListener('click', () => {
      revealed = true;
      renderReview();
      document.querySelector('[data-personal-rating="good"]').focus();
    });
    for (const button of target.querySelectorAll('[data-personal-rating]')) button.addEventListener('click', () => {
      if (!current || !revealed) return;
      const updated = scheduleCard(current, button.dataset.personalRating);
      cards = cards.map(c => c.id === updated.id ? updated : c);
      if (practiceAhead) practiceQueue.shift();
      persist();
      notice(`${button.dataset.personalRating === 'again' ? 'Review again in 1 minute' : `Next review in ${intervalLabel(updated)}`}.`);
      chooseCard();
      renderLibrary();
      document.querySelector('#show-personal-answer, #practice-ahead, #refresh-due')?.focus();
    });
    document.querySelector('#edit-review-card').addEventListener('click', () => openEditor(current.id));
  }
  function renderLibrary() {
    const filter = document.querySelector('#personal-search').value.trim().toLowerCase();
    const matches = inDeck().filter(c => `${c.front} ${c.back} ${c.notes} ${c.deck}`.toLowerCase().includes(filter));
    document.querySelector('#personal-card-list').innerHTML = matches.map(card => `<article class="personal-library-card"><div><span class="personal-deck-tag">${escape(card.deck)}</span><h4>${escape(card.front)}</h4><details><summary>Show answer</summary><p>${escape(card.back)}</p>${card.notes ? `<small>${escape(card.notes)}</small>` : ''}</details><p class="personal-card-schedule">${card.due <= Date.now() ? 'Due now' : `Due ${escape(dateLabel(card.due))}`} · ${card.reviews} review${card.reviews === 1 ? '' : 's'}</p></div><div class="personal-card-actions"><button class="secondary-button" data-edit-card="${card.id}">Edit</button><button class="secondary-button" data-delete-card="${card.id}">Delete</button></div></article>`).join('') || '<p class="empty-state">No cards match this deck or search.</p>';
    for (const button of panel.querySelectorAll('[data-edit-card]')) button.addEventListener('click', () => openEditor(button.dataset.editCard));
    for (const button of panel.querySelectorAll('[data-delete-card]')) button.addEventListener('click', () => {
      const id = button.dataset.deleteCard;
      lastDeleted = cards.find(c => c.id === id);
      cards = cards.filter(c => c.id !== id);
      persist();
      renderDecks(); chooseCard(); renderLibrary();
      document.querySelector('#flashcard-notice').innerHTML = 'Card deleted. <button id="undo-delete-card">Undo delete</button>';
      document.querySelector('#undo-delete-card').addEventListener('click', () => {
        if (!lastDeleted || cards.some(c=>c.id===lastDeleted.id)) return;
        if (cards.length >= MAX_CARDS) { notice('The collection is full; delete another card before restoring this one.'); return; }
        cards.push(lastDeleted); lastDeleted = null; persist(); renderDecks(); chooseCard(); renderLibrary(); notice('Card restored.');
      });
    });
  }
  function openEditor(id = null) {
    editingId = id;
    previousFocus = document.activeElement;
    const card = cards.find(c => c.id === id);
    document.querySelector('#flashcard-editor-title').textContent = card ? 'Edit card' : 'New card';
    document.querySelector('#card-deck').value = card?.deck ?? (selectedDeck || 'General');
    document.querySelector('#card-front').value = card?.front ?? '';
    document.querySelector('#card-back').value = card?.back ?? '';
    document.querySelector('#card-notes').value = card?.notes ?? '';
    document.querySelector('#card-editor-error').textContent = '';
    editor.showModal();
    document.querySelector('#card-front').focus();
  }
  function closeEditor() { editor.close(); if (previousFocus?.isConnected) previousFocus.focus(); }
  document.querySelector('#flashcard-edit-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (unreadableBackup !== null) throw new Error('Import a valid backup to restore your collection first. Existing unreadable data is protected.');
      const values = Object.fromEntries(new FormData(event.target));
      const previous = cards.find(c => c.id === editingId);
      const fresh = createCard(values, previous?.id);
      if (!previous && cards.length >= MAX_CARDS) throw new Error('This collection already has 5,000 cards.');
      // Editing schedules the updated fact for immediate review, keeping its history.
      const saved = previous ? { ...fresh, reviews: previous.reviews, lapses: previous.lapses } : fresh;
      cards = previous ? cards.map(c => c.id === previous.id ? saved : c) : [...cards, saved];
      persist();
      if (selectedDeck && selectedDeck !== saved.deck) selectedDeck = saved.deck;
      practiceAhead = false;
      closeEditor(); renderDecks(); chooseCard(); renderLibrary(); notice(previous ? 'Card updated and ready to review.' : 'Card added and ready to review.');
    } catch (error) { document.querySelector('#card-editor-error').textContent = error.message; }
  });
  document.querySelector('#close-flashcard-editor').addEventListener('click', closeEditor);
  document.querySelector('#cancel-flashcard-editor').addEventListener('click', closeEditor);
  document.querySelector('#new-flashcard').addEventListener('click', () => openEditor());
  document.querySelector('#personal-deck').addEventListener('change', event => { selectedDeck = event.target.value; practiceAhead = false; chooseCard(); renderLibrary(); notice(''); });
  document.querySelector('#personal-search').addEventListener('input', renderLibrary);
  document.querySelector('#export-flashcards').addEventListener('click', () => {
    const data = unreadableBackup ?? JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), cards }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = unreadableBackup !== null ? 'poker-memory-flashcards-recovery.json' : 'poker-memory-flashcards.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice('Backup download requested. Keep the JSON file to restore your cards and schedules.');
  });
  document.querySelector('#import-flashcards').addEventListener('click', () => document.querySelector('#flashcard-import-file').click());
  document.querySelector('#flashcard-import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Choose a backup smaller than 50 MB.');
      const imported = parseBackup(await file.text());
      const merged = mergeCards(cards, imported);
      if (unreadableBackup !== null) {
        // Preserve the original bytes before repairing the primary storage.
        localStorage.setItem(storageKey + ':unreadable-recovery', unreadableBackup);
        unreadableBackup = null;
      }
      cards = merged.cards;
      practiceAhead = false;
      persist(); renderDecks(); chooseCard(); renderLibrary();
      notice(`Imported ${merged.added} new cards, updated ${merged.updated} newer cards, and kept ${merged.kept} existing versions. Other existing cards were preserved.`);
    } catch (error) { notice(`Import failed: ${error.message}`); }
    event.target.value = '';
  });
  document.querySelector('#flashcard-storage-warning').textContent = storageWarning;
  renderDecks(); chooseCard(); renderLibrary();
  // Timers are not reliable across sleeping tabs; refresh due cards on re-entry.
  setInterval(() => { if (active && !editor.open) { renderCounts(); if (!current && dueCards(cards, selectedDeck).length) chooseCard(); } }, 15000);
  return { setMode(mode) {
    active = mode === 'flashcards';
    panel.hidden = !active;
    if (active) { renderCounts(); if (!current || !cards.some(c=>c.id===current.id)) chooseCard(); renderLibrary(); }
  } };
}
