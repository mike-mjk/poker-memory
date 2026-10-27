import { averageSamples, averageSourceKey } from './average-data.js';
import { initVariationExplorer } from './average-variation-ui.js';
import { averageClasses, buildAverageCatalog, chooseAverageBatch, batchOptions, profileLabel, scoreAverageBatch } from './average-trainer.js';

const suits = { c:'♣', d:'♦', h:'♥', s:'♠' };
const ranks = 'AKQJT98765432';
const fmt = (n, places = 1) => (Math.round((n + 1e-9) * 10 ** places) / 10 ** places).toFixed(places).replace(/\.0+$/, '');
const boardName = board => 'AK' + board[2][0];
const cardHTML = code => `<span class="av-card suit-${code[1]}">${code[0]}${suits[code[1]]}</span>`;
const comboName = q => q.cards.map(c => c[0] + suits[c[1]]).join('');
const presetList = {
  aces: { classId:'top-pair', style:'s', direction:'high', anchor:'A', names:['A8s','A9s','AJs'] },
  kings: { classId:'middle-pair', style:'s', direction:'high', anchor:'K', names:['KQs','KJs','K8s'] },
  jacks: { classId:'unpaired', style:'s', direction:'high', anchor:'J', names:['J8s','J7s','J6s'] },
  sixes: { classId:'unpaired', style:'s', direction:'low', anchor:'6', names:['Q6s','J6s','T6s'] },
  offsuit: { classId:'top-pair', style:'o', direction:'high', anchor:'A', names:['A5o','A3o','AJo'] },
};

function sparkline(question) {
  const x = i => 25 + i * (210 / Math.max(1, question.points.length - 1));
  const y = value => 63 - value * .5;
  const points = question.points.map((p,i) => p.included ? `${x(i)},${y(p.frequency * 100)}` : null).filter(Boolean).join(' ');
  return `<svg class="av-sparkline" viewBox="0 0 260 91" role="img" aria-label="${comboName(question)} board frequencies. Average ${fmt(question.mean,2)} percent, spread ${fmt(question.spread)} percentage points."><line x1="14" x2="247" y1="${y(question.mean)}" y2="${y(question.mean)}" class="av-mean-line"/><polyline points="${points}"/>${question.points.map((p,i) => `<text x="${x(i)}" y="85" text-anchor="middle">${boardName(p.board)}</text>${p.included ? `<circle cx="${x(i)}" cy="${y(p.frequency * 100)}" r="3"/>` : `<text x="${x(i)}" y="40" text-anchor="middle">—</text>`}`).join('')}</svg>`;
}

export function initAverages() {
  const panel = document.querySelector('#averages-panel');
  const catalog = buildAverageCatalog(averageSamples);
  let options = { classId:'top-pair', style:'s', direction:'high', anchor:'A' };
  let batch = null;
  let answers = {};
  let submitted = false;
  let showCharts = false;
  let stats = { batches:0, answers:0, exact:0, totalError:0 };
  let storageOK = true;
  const storageKey = 'poker-memory:average-trainer:v1:' + averageSourceKey;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && ['batches','answers','exact','totalError'].every(key => Number.isSafeInteger(saved[key]) && saved[key] >= 0) && saved.exact <= saved.answers) stats = saved;
  } catch { storageOK = false; }
  panel.innerHTML = `<div class="av-heading"><div><p class="eyebrow">BTN VS STRADDLE · STANDARD XENO · 200 BB</p><h2>Learn the average. Notice the exceptions.</h2><p>Estimate how often each exact combo bets <b>75% pot</b>, averaged equally across its matching flops.</p></div><span class="av-source-badge">${averageSamples.length} solved boards</span></div><div class="av-board-strip" aria-label="Boards in this collection">${averageSamples.map(s=>`<div><span>${boardName(s.spot.board)}</span><div>${s.spot.board.map(cardHTML).join('')}</div></div>`).join('')}</div><div class="av-settings"><label>Hand class<select id="av-class">${averageClasses.map(c=>`<option value="${c.id}">${c.label}</option>`).join('')}</select></label><label>Hand type<select id="av-style"><option value="s">Suited</option><option value="o">Offsuit</option></select></label><label>Related hands<select id="av-direction"><option value="high">Same higher card</option><option value="low">Same lower card</option><option value="mixed">Mix both directions</option></select></label><label>Fixed rank<select id="av-anchor"></select></label><button id="av-new" class="primary-button">New batch ↻</button></div><div class="av-presets" role="group" aria-label="Example batches"><span>Try a pattern</span><button data-av-preset="aces">A8s / A9s / AJs</button><button data-av-preset="kings">KQs / KJs / K8s</button><button data-av-preset="jacks">J8s / J7s / J6s</button><button data-av-preset="sixes">Q6s / J6s / T6s</button><button data-av-preset="offsuit">A5o / A3o / AJo</button></div><div class="av-instructions"><p><b>Your target:</b> the equal-board mean, rounded to the nearest whole %. Use a group slider to set all suit combos, then adjust them individually.</p><p>Only matching made-hand and draw profiles count. Excluded boards are listed beside each combo; missing boards are never treated as zero.</p></div><div id="av-variation-explorer"></div><div id="av-batch-context"></div><div id="av-batch" class="av-batch"></div><div id="av-submit-bar" class="av-submit-bar"><div id="av-completion" role="status"></div><button id="av-submit" class="primary-button">Submit batch</button></div><div id="av-feedback" aria-live="polite"></div><div id="av-history" class="av-history"></div><details class="av-method"><summary>How the targets and board subsets are chosen</summary><p>This collection contains only the saved standard-Xeno ${averageSamples.map(s=>s.spot.board.join(' ')).join(', ')} solves, with BTN checking or betting 75% pot. The Mobius AK6 reference is excluded.</p><p>Each combo must be legal and have positive range weight. Its made-hand class, flush draw, backdoor flush draw, direct straight-draw type, and backdoor straight status must agree across included boards. The largest matching subset is used, with at least two boards; ties use the subset appearing first in ${averageSamples.map(s=>boardName(s.spot.board)).join(', ')} order. Other profiles are excluded rather than merged.</p><p>A backdoor straight requires both turn and river ranks to complete a straight using at least one hole card. It is not labeled as a backdoor when a direct straight draw is already present. The other hole card need not play: J8 can make Broadway on AKx with Q and T.</p><p>Targets average the exact combo’s action frequency equally across included boards, then round once. Range weights determine whether the combo is present, not the relative weight of a board. Exact scoring compares your whole-percent answer to that rounded target. Practice totals count attempts, including retries.</p><p>The feedback’s spread is the highest minus lowest included frequency. “Wide spread” highlights 15 percentage points or more; it is a visual aid, not an EV-loss estimate. The dashed chart line is the unrounded mean. No action EVs have been supplied.</p></details>`;

  initVariationExplorer(document.querySelector('#av-variation-explorer'), catalog, averageSamples);

  function syncControls() {
    document.querySelector('#av-class').value = options.classId;
    document.querySelector('#av-style').value = options.style;
    document.querySelector('#av-direction').value = options.direction;
    const available = batchOptions(catalog, { ...options, anchor:'' });
    const availableRanks = ranks.split('').filter(rank=>available.some(g=>g.rank===rank));
    if (!availableRanks.includes(options.anchor)) options.anchor = '';
    document.querySelector('#av-anchor').innerHTML = '<option value="">Random rank</option>' + availableRanks.map(rank=>`<option value="${rank}">${rank}</option>`).join('');
    document.querySelector('#av-anchor').value = options.anchor;
  }
  function renderHistory() {
    document.querySelector('#av-history').innerHTML = `<span><b>${stats.batches}</b> batches practiced</span><span><b>${stats.exact} / ${stats.answers}</b> exact answers</span><span><b>${stats.answers ? fmt(stats.totalError / stats.answers,2) : '—'}</b> pp average error</span><small>${storageOK ? 'Practice history saved in this browser for these source exports.' : 'Browser storage unavailable; history lasts this session.'}</small>`;
  }
  function resetBatch(next) {
    batch = next; answers = {}; submitted = false; showCharts = false;
    document.querySelector('#av-feedback').innerHTML = '';
    renderBatch();
    renderHistory();
  }
  function startBatch() {
    const previous = batch?.hands.map(h=>h.name).join(',') ?? '';
    resetBatch(chooseAverageBatch(catalog, options, Math.random, previous));
  }
  function setPreset(name) {
    const preset = presetList[name];
    options = { classId:preset.classId, style:preset.style, direction:preset.direction, anchor:preset.anchor };
    syncControls();
    const hands = preset.names.map(hand=>catalog.get(preset.classId).get(hand)).filter(Boolean);
    resetBatch(hands.length ? { axis:preset.direction, rank:preset.anchor, hands } : null);
  }
  function renderBatch() {
    const target = document.querySelector('#av-batch');
    if (!batch) {
      target.innerHTML = '<p class="empty-state">No compatible hands for this selection. Try a different rank, hand type, or class.</p>';
      document.querySelector('#av-batch-context').textContent = '';
      updateProgress(); return;
    }
    const className = averageClasses.find(c=>c.id===options.classId).label;
    document.querySelector('#av-batch-context').innerHTML = `<h3>${className} · ${options.style==='s'?'suited':'offsuit'} · ${batch.axis==='high'?'higher':'lower'} card ${batch.rank}</h3><span>${batch.hands.length} related hands · ${batch.hands.reduce((sum,h)=>sum+h.questions.length,0)} exact combos</span>`;
    target.innerHTML = batch.hands.map(hand => `<section class="av-hand" data-av-hand="${hand.name}"><div class="av-hand-title"><div><h3>${hand.name}</h3><p>${options.classId==='unpaired'?`${hand.high}-high hole cards · ${hand.low} lower card`:`${averageClasses.find(c=>c.id===options.classId).label} · ${hand.low} kicker`}</p></div><span>${hand.questions.length} combos</span></div><div class="av-bulk"><label for="av-bulk-${hand.name}">Set all ${hand.name} answers</label><div><input id="av-bulk-${hand.name}" data-av-bulk="${hand.name}" type="range" min="0" max="100" step="1" value="50" ${submitted?'disabled':''}><input data-av-bulk-number="${hand.name}" type="number" min="0" max="100" step="1" value="50" aria-label="Set all ${hand.name} percentage" ${submitted?'disabled':''}><span>%</span><button data-av-apply="${hand.name}" ${submitted?'disabled':''}>Apply</button></div></div><div class="av-questions">${hand.questions.map(question=>questionHTML(question)).join('')}</div></section>`).join('');
    bindSliders();
    updateProgress();
  }
  function questionHTML(q) {
    const answer = answers[q.key];
    const answered = Number.isInteger(answer);
    const included = q.points.filter(p=>p.included);
    const excluded = q.points.filter(p=>!p.included);
    const error = submitted ? Math.abs(answer-q.target) : null;
    return `<article class="av-question ${answered?'av-answered':''}" data-av-question="${q.key}"><div class="av-combo-title"><h4>${q.cards.map(cardHTML).join('')}</h4><span class="av-answer-state">${submitted ? error===0?'Exact':`${error} pp ${answer>q.target?'high':'low'}` : answered?'Answered':'Unanswered'}</span></div><p class="av-draw-label">${profileLabel(q.profile)}</p><div class="av-included-boards" aria-label="Boards included in ${comboName(q)} average">${included.map(p=>`<span>${boardName(p.board)}</span>`).join('')}<small>${included.length}-board mean</small></div>${excluded.length?`<details class="av-exclusions"><summary>${excluded.length} excluded ${excluded.length===1?'board':'boards'}</summary>${excluded.map(p=>`<p>${boardName(p.board)}: ${p.reason}</p>`).join('')}</details>`:''}<div class="av-answer-input"><input data-av-range="${q.key}" type="range" min="0" max="100" step="1" value="${answered?answer:50}" aria-label="${comboName(q)} average bet percentage slider" ${submitted?'disabled':''}><input data-av-number="${q.key}" type="number" min="0" max="100" step="1" value="${answered?answer:''}" placeholder="—" aria-label="${comboName(q)} average bet percentage" ${submitted?'disabled':''}><span>%</span></div>${submitted?`<div class="av-combo-result ${error===0?'av-exact':'av-miss'}"><div><span>You: <b>${answer}%</b></span><span>Target: <b>${q.target}%</b></span></div><p>Mean ${fmt(q.mean,2)}% → ${q.target}% <span class="av-spread ${q.spread>=15?'av-wide':''}">${fmt(q.spread)} pp spread${q.spread>=15?' · wide':''}</span></p><table class="av-point-table"><thead><tr>${q.points.map(p=>`<th>${boardName(p.board)}</th>`).join('')}</tr></thead><tbody><tr>${q.points.map(p=>`<td title="${p.included?'Included':p.reason}">${p.included?fmt(p.frequency*100)+'%':'—'}</td>`).join('')}</tr></tbody></table><details class="av-chart-details" ${showCharts?'open':''}><summary>View variation chart</summary>${sparkline(q)}<p class="av-chart-key">Dashed line: unrounded mean</p></details></div>`:''}</article>`;
  }
  function updateProgress() {
    const total = batch?.hands.reduce((sum,h)=>sum+h.questions.length,0) ?? 0;
    const answered = Object.values(answers).filter(Number.isInteger).length;
    const button = document.querySelector('#av-submit');
    button.disabled = submitted || !total || answered !== total;
    button.textContent = submitted ? 'Batch submitted' : 'Submit batch';
    document.querySelector('#av-completion').textContent = submitted ? 'Targets and board variation revealed below each combo.' : `${answered} / ${total} answered. Move a slider or enter a whole percentage; group sliders answer all variants together.`;
  }
  function refreshAnswer(key, value) {
    const row = panel.querySelector(`[data-av-question="${key}"]`);
    const valid = Number.isInteger(value) && value >= 0 && value <= 100;
    if (valid) answers[key] = value; else delete answers[key];
    row.classList.toggle('av-answered',valid);
    row.querySelector('.av-answer-state').textContent = valid?'Answered':'Unanswered';
    if (valid) {
      row.querySelector('[data-av-range]').value = value;
      row.querySelector('[data-av-number]').value = value;
    }
    updateProgress();
  }
  function setGroup(hand, value) {
    if (!Number.isInteger(value) || value<0 || value>100 || submitted) return;
    panel.querySelector(`[data-av-bulk="${hand}"]`).value = value;
    panel.querySelector(`[data-av-bulk-number="${hand}"]`).value = value;
    for (const q of batch.hands.find(h=>h.name===hand).questions) refreshAnswer(q.key,value);
  }
  function bindSliders() {
    for (const slider of panel.querySelectorAll('[data-av-bulk]')) slider.addEventListener('input',()=>setGroup(slider.dataset.avBulk,Number(slider.value)));
    for (const input of panel.querySelectorAll('[data-av-bulk-number]')) input.addEventListener('input',()=>{
      if (input.value!=='' && input.checkValidity()) setGroup(input.dataset.avBulkNumber,Number(input.value));
    });
    for (const button of panel.querySelectorAll('[data-av-apply]')) button.addEventListener('click',()=>{
      const input=panel.querySelector(`[data-av-bulk-number="${button.dataset.avApply}"]`);
      if(input.value!==''&&input.reportValidity())setGroup(button.dataset.avApply,Number(input.value));
    });
    for (const slider of panel.querySelectorAll('[data-av-range]')) slider.addEventListener('input',()=>refreshAnswer(slider.dataset.avRange,Number(slider.value)));
    for (const input of panel.querySelectorAll('[data-av-number]')) input.addEventListener('input',()=>refreshAnswer(input.dataset.avNumber,input.value!==''&&input.checkValidity()?Number(input.value):null));
  }
  function submit() {
    if (!batch || submitted) return;
    const result = scoreAverageBatch(batch,answers);
    submitted = true;
    stats.batches++; stats.answers+=result.count; stats.exact+=result.exact;
    stats.totalError+=result.results.reduce((sum,r)=>sum+r.error,0);
    try { localStorage.setItem(storageKey,JSON.stringify(stats)); storageOK=true; } catch { storageOK=false; }
    renderBatch(); renderHistory();
    document.querySelector('#av-feedback').innerHTML = `<div class="av-batch-score"><div><p class="eyebrow">BATCH RESULTS</p><h3>${result.exact} / ${result.count} exact</h3><p>${fmt(result.meanError,2)} percentage points average error against rounded targets. Wide-spread badges mark ≥15 pp.</p></div><div class="trainer-buttons"><button id="av-retry" class="secondary-button">Retry this batch</button><button id="av-next" class="primary-button">Next batch →</button><button id="av-charts" class="secondary-button">Expand all charts</button></div></div>`;
    document.querySelector('#av-retry').addEventListener('click',()=>{resetBatch(batch);document.querySelector('#av-batch').scrollIntoView({block:'start',behavior:'smooth'});});
    document.querySelector('#av-next').addEventListener('click',()=>{startBatch();document.querySelector('#av-batch').scrollIntoView({block:'start',behavior:'smooth'});});
    document.querySelector('#av-charts').addEventListener('click',event=>{
      showCharts=!showCharts;
      for(const details of panel.querySelectorAll('.av-chart-details'))details.open=showCharts;
      event.target.textContent=showCharts?'Collapse all charts':'Expand all charts';
    });
    document.querySelector('#av-feedback').scrollIntoView({block:'nearest',behavior:'smooth'});
  }

  for (const name of ['class','style','direction','anchor']) document.querySelector(`#av-${name}`).addEventListener('change',event=>{
    options[{class:'classId',style:'style',direction:'direction',anchor:'anchor'}[name]]=event.target.value;
    syncControls(); startBatch();
  });
  document.querySelector('#av-new').addEventListener('click',startBatch);
  document.querySelector('#av-submit').addEventListener('click',submit);
  for(const button of panel.querySelectorAll('[data-av-preset]'))button.addEventListener('click',()=>setPreset(button.dataset.avPreset));
  setPreset('aces');
  return { setMode(mode) { panel.hidden=mode!=='averages'; } };
}
