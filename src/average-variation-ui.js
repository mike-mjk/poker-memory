import { averageClasses, rankAverageVariation, profileLabel } from './average-trainer.js';

const symbols = { c:'♣', d:'♦', h:'♥', s:'♠' };
const pct = n => `${(Math.round((n + 1e-9) * 10) / 10).toFixed(1)}%`;
const classLabel = id => averageClasses.find(c=>c.id===id)?.label ?? id;
const shortBoard = board => 'AK' + board[2][0];
const cardsHTML = q => q.cards.map(c=>`<span class="suit-${c[1]}">${c[0]}${symbols[c[1]]}</span>`).join(' ');
const normalize = text => text.trim().toLowerCase().replace(/♣/g,'c').replace(/♦/g,'d').replace(/♥/g,'h').replace(/♠/g,'s').replace(/10/g,'t').replace(/\s/g,'');

export function initVariationExplorer(root, catalog, samples) {
  root.innerHTML = `<button id="av-variation-toggle" class="secondary-button" aria-expanded="false" aria-controls="av-variation-content">Explore big swings</button><section id="av-variation-content" hidden><div class="av-variation-heading"><div><p class="eyebrow">STUDY VIEW · ANSWERS VISIBLE</p><h3>Same hand class. Different frequencies.</h3><p>Sorted by highest minus lowest frequency. By default, the made hand and draw profile must stay the same on all ${samples.length} boards.</p></div><button id="av-variation-export" class="secondary-button">Export filtered CSV</button></div><div class="av-variation-controls"><label>Class<select id="av-variation-class"><option value="">All classes</option>${averageClasses.map(c=>`<option value="${c.id}">${c.label}</option>`).join('')}</select></label><label>Suit type<select id="av-variation-style"><option value="">All combos</option><option value="s">Suited</option><option value="o">Offsuit</option></select></label><label>Matching boards<select id="av-variation-coverage"><option value="${samples.length}">All ${samples.length} boards</option><option value="2">At least 2 matching boards</option></select></label><label>Find a combo<input id="av-variation-search" type="search" placeholder="Q6, Qs6s, or Q♠6♠"></label><label>Rows<select id="av-variation-limit"><option value="50">Top 50</option><option value="all">All matches</option></select></label></div><p id="av-variation-count" role="status"></p><div class="av-variation-scroll"><table><thead><tr><th>Combo / class</th>${samples.map(s=>`<th>${shortBoard(s.spot.board)}</th>`).join('')}<th>Mean</th><th>Spread</th></tr></thead><tbody id="av-variation-rows"></tbody></table></div><p class="av-variation-note">These are exact-combo action frequencies, not range shares. Only included boards count in the mean and spread. A dash means the combo does not qualify on that board; it is never averaged as zero. Frequency differences alone do not measure EV loss.</p></section>`;
  let opened = false;
  function filtered() {
    const query = normalize(document.querySelector('#av-variation-search').value);
    return rankAverageVariation(catalog, {
      classId:document.querySelector('#av-variation-class').value,
      style:document.querySelector('#av-variation-style').value,
      minBoards:Number(document.querySelector('#av-variation-coverage').value),
    }).filter(q=>!query || q.key.toLowerCase().includes(query) || (q.hand[0]+q.hand[1]).toLowerCase()===query);
  }
  function render() {
    const matches = filtered();
    const limit = document.querySelector('#av-variation-limit').value;
    const visible = limit === 'all' ? matches : matches.slice(0,Number(limit));
    document.querySelector('#av-variation-count').textContent = `${visible.length} of ${matches.length} matching combos · spread in percentage points`;
    document.querySelector('#av-variation-rows').innerHTML = visible.map(q=>`<tr data-av-variation="${q.key}"><th scope="row"><b>${cardsHTML(q)}</b><small>${classLabel(q.classId)} · ${profileLabel(q.profile)}</small><small>${q.points.filter(p=>p.included).length} matching boards</small></th>${q.points.map(p=>`<td title="${p.included?'Included':p.reason}">${p.included?pct(p.frequency*100):'—'}</td>`).join('')}<td>${pct(q.mean)}<small>Target ${q.target}%</small></td><td class="${q.spread>=15?'av-wide':''}">${q.spread.toFixed(1)} pp</td></tr>`).join('') || `<tr><td colspan="${samples.length+3}">No compatible combos match these filters.</td></tr>`;
  }
  document.querySelector('#av-variation-toggle').addEventListener('click',event=>{
    opened=!opened;
    document.querySelector('#av-variation-content').hidden=!opened;
    event.target.setAttribute('aria-expanded',String(opened));
    event.target.textContent=opened?'Close variation explorer':'Explore big swings';
    if(opened)render();
  });
  for(const control of root.querySelectorAll('select,input'))control.addEventListener('input',render);
  document.querySelector('#av-variation-export').addEventListener('click',()=>{
    const header=['Combo','Made hand class','Draw profile','Matching boards',...samples.map(s=>shortBoard(s.spot.board)+' bet percent'),'Equal-board mean percent','Rounded target percent','Spread percentage points'];
    const rows=filtered().map(q=>[q.key,classLabel(q.classId),profileLabel(q.profile),q.points.filter(p=>p.included).length,...q.points.map(p=>p.included?(p.frequency*100).toFixed(1):''),q.mean.toFixed(6),q.target,q.spread.toFixed(1)]);
    const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
    const csv='\ufeff'+[header,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='poker-memory-average-variation.csv';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}
