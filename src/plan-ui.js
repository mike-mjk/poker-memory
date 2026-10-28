const storageKey = 'poker-memory:research-plan:v1';
const tasks = [
  ['next', 'local', 'Continue in local Codex and connect to PioSolver.', 'Use C:\\Poker Trainer as a code reference when useful. Treat its explanatory markdown lightly; verify behavior in code and the solver.'],
  ['next', 'ranges', 'Prepare the Mobius starting ranges for both players.', 'Use the button RFI and straddle call versus button RFI ranges in the local folder recorded below. Record the exact filenames and verify the imported ranges when setting up Pio.'],
  ['next', 'setup', 'Record and confirm the solve settings.', 'Use WPT Gold NL100 rake: 5% capped at 4 big blinds (user-provided). Use the simplified betting tree recorded below. Record stacks, pot, positions, antes, and any other tree-builder settings before running solves.'],
  ['next', 'pilot', 'Run a small pilot batch before solving the full board family.', 'Begin with one consistent two-tone arrangement, such as A♠ K♥ x♥. Check that the solves and exports work before expanding.'],
  ['next', 'collect', 'Solve the AKx, AQx, AJx, and ATx board families.', 'Save each solution and its settings. Start with the chosen two-tone arrangement; the precise board list still needs to be defined.'],
  ['next', 'inspect', 'Compare aggregate frequencies and the hands taking each action.', 'Look at check/bet totals, hand classes, suit patterns, and combo-level variation. A custom report viewer is optional.'],
  ['next', 'simplify', 'Ask Codex to propose a broad, learnable c-betting strategy.', 'Start broad. Keep hand meaning and draw profiles comparable; add exceptions only where they help enough.'],
  ['next', 'evaluate', 'Test the simplified strategy in PioSolver and measure its EV cost.', 'Compare against the original solutions. Define the evaluation method and how much EV loss is acceptable before deciding that a rule works.'],
  ['next', 'trash', 'Test bluff frequency versus bluff combo selection.', 'Compare: preferred combos betting too often; redistributed combos at the correct total frequency; and one shared frequency for trash. Define the trash class and whether “30% too often” means relative percent or percentage points.'],
  ['next', 'learn', 'Turn the useful rules and exceptions into training material.', 'The outcome is a strategy you can execute across many flops, with practice for the distinctions that matter.'],
  ['later', 'sensitivity', 'Compare sensitivity to Mobius versus Xeno starting ranges.', 'Parked for now: the first study uses Mobius.'],
  ['later', 'textures', 'Expand to other suit textures and flush-suit placements.', 'Different placements of the flush suit can change strategy; they are separate from simply renaming suits.'],
  ['later', 'turn-sizes', 'Revisit turn sizes when studying the turn in more detail.', 'We can change the turn size or add more sizes later. Keep the initial tree simple so solves are fast.'],
  ['later', 'reports', 'Consider building an aggregate report viewer.', 'Build it if it makes the analysis easier; it is not required to start.'],
  ['later', 'viewer', 'Consider building a Pio-style strategy viewer.', 'Optional tooling after the data pipeline and analysis are useful.'],
];

export function initPlan() {
  const panel = document.querySelector('#plan-panel');
  let state = { done: {}, custom: [] };
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved.done === 'object' && saved.done && Array.isArray(saved.custom)) {
      state.done = Object.fromEntries(Object.entries(saved.done).filter(([, value]) => value === true));
      state.custom = saved.custom.filter(item => item && typeof item.id === 'string' && typeof item.text === 'string' && ['next', 'later'].includes(item.section)).map(item => ({ ...item, text: item.text.slice(0, 500) }));
    }
  } catch { /* Defaults remain usable. */ }
  panel.innerHTML = `
    <div class="plan-heading"><p class="eyebrow">Research & practice</p><h2>The plan</h2><p>Build a simple c-betting strategy that covers many ace-high, double-Broadway flops and is practical to learn and execute.</p></div>
    <section class="plan-decisions"><h3>Decided for this first pass</h3><ul><li><strong>Starting ranges:</strong> Mobius. Range-source comparisons can wait.</li><li><strong>Solver:</strong> local PioSolver, through local Codex.</li><li><strong>Rake:</strong> WPT Gold NL100 — 5% capped at 4 big blinds (user-provided).</li></ul><p>Working starting point: one consistent two-tone arrangement. Use the simplified betting tree below; the full texture coverage is still open.</p><p>This is a new Mobius study. The existing Xeno averages remain a separate dataset.</p></section>
    <section class="plan-decisions" aria-labelledby="plan-reference-title"><h3 id="plan-reference-title">Project reference · Starting ranges</h3><p><strong>Local Windows folder:</strong><br><code class="plan-path">C:\\PioSOLVER\\Ranges\\Mobius WPT Gold NL400 rake</code></p><p>This folder currently contains the two ranges we will use to solve these flops:</p><ul><li><strong>Button:</strong> RFI range.</li><li><strong>Straddle:</strong> call versus button RFI range.</li></ul><p>The folder identifies the source ranges as Mobius WPT Gold NL400 rake. Our planned postflop solves use WPT Gold NL100 rake: 5% capped at 4 big blinds, as provided by you. Exact range filenames have not been recorded yet.</p></section>
    <section class="plan-decisions" aria-labelledby="plan-tree-title"><h3 id="plan-tree-title">Project reference · Simplified betting tree</h3><p>Initial tree for fast solves, transcribed from your PioSolver screenshot. IP is the button; OOP is the straddle. All size entries below are percentages in Pio's tree builder.</p>
      <div class="plan-table-scroll"><table class="plan-tree"><caption>Betting sizes and all-in options by street and position</caption><thead><tr><th scope="col">Street</th><th scope="col">Position</th><th scope="col">Bet sizes</th><th scope="col">Donk sizes</th><th scope="col">Raise sizes</th><th scope="col">Add allin</th></tr></thead><tbody>
      <tr><th scope="row">Flop</th><td>IP · Button</td><td>75%</td><td>—</td><td>50%</td><td>Unchecked</td></tr>
      <tr><th scope="row">Flop</th><td>OOP · Straddle</td><td>None · no donk</td><td>—</td><td>50%</td><td>Not shown</td></tr>
      <tr><th scope="row">Turn</th><td>IP · Button</td><td>50%</td><td>—</td><td>50%</td><td>Checked</td></tr>
      <tr><th scope="row">Turn</th><td>OOP · Straddle</td><td>50%</td><td>50%</td><td>50%</td><td>Checked</td></tr>
      <tr><th scope="row">River</th><td>IP · Button</td><td>75%</td><td>—</td><td>75%</td><td>Checked</td></tr>
      <tr><th scope="row">River</th><td>OOP · Straddle</td><td>75%</td><td>25%</td><td>75%</td><td>Checked</td></tr>
      </tbody></table></div><p>The “Don't 3-bet” boxes are unchecked for IP on all three streets. The flop OOP bet-size field is blank, so the straddle checks to the button.</p><p><strong>All-in detail:</strong> your description said “Add all in” is checked; the screenshot specifically shows it checked on turn and river and unchecked on flop IP. These entries follow the screenshot. Flop OOP has no all-in checkbox shown.</p><p>Keep this initial tree simple. When we study turns in more detail, we can change the turn size or add more sizes. Other tree-builder settings not visible in the screenshot still need to be recorded.</p></section>
    <p id="plan-progress" role="status"></p>
    <section class="plan-section"><h3>Next steps</h3><p>Work down this list. The immediate next step is getting local Pio access working.</p><ul id="plan-next" class="plan-list"></ul></section>
    <section class="plan-section"><h3>Parked for later</h3><p>Keep the ideas without letting them block the first study.</p><ul id="plan-later" class="plan-list"></ul></section>
    <form id="plan-add"><label for="plan-task">Add a to-do</label><div><input id="plan-task" maxlength="500" required placeholder="Something to remember…"><select id="plan-section" aria-label="To-do section"><option value="next">Next steps</option><option value="later">Parked for later</option></select><button type="submit">Add</button></div></form>
    <p id="plan-storage" class="plan-note"></p>`;
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { storageAvailable = false; }
  }
  function render() {
    const all = [...tasks.map(([section, id, text, detail]) => ({ section, id, text, detail })), ...state.custom];
    for (const section of ['next', 'later']) {
      const list = panel.querySelector(`#plan-${section}`);
      list.replaceChildren();
      for (const task of all.filter(item => item.section === section)) {
        const row = document.createElement('li');
        row.classList.toggle('plan-done', !!state.done[task.id]);
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox'; input.checked = !!state.done[task.id]; input.dataset.planId = task.id;
        const copy = document.createElement('span');
        const title = document.createElement('strong'); title.textContent = task.text; copy.append(title);
        if (task.detail) { const detail = document.createElement('small'); detail.textContent = task.detail; copy.append(detail); }
        label.append(input, copy); row.append(label);
        input.addEventListener('change', () => { state.done[task.id] = input.checked; persist(); row.classList.toggle('plan-done', input.checked); updateProgress(all); });
        if (!task.detail) {
          const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${task.text}`);
          remove.addEventListener('click', () => { state.custom = state.custom.filter(item => item.id !== task.id); delete state.done[task.id]; persist(); render(); }); row.append(remove);
        }
        list.append(row);
      }
    }
    updateProgress(all);
  }
  function updateProgress(all) {
    const next = all.filter(item => item.section === 'next');
    panel.querySelector('#plan-progress').textContent = `${next.filter(item => state.done[item.id]).length} of ${next.length} next steps complete`;
    panel.querySelector('#plan-storage').textContent = storageAvailable ? 'The starting plan is included with the website. Your checkmarks and added tasks are saved in this browser only; they do not sync between computers.' : 'Browser storage is unavailable. Your changes will last only for this session.';
  }
  panel.querySelector('#plan-add').addEventListener('submit', event => {
    event.preventDefault();
    const input = panel.querySelector('#plan-task');
    const text = input.value.trim(); if (!text) return;
    state.custom.push({ id: `custom-${crypto.randomUUID()}`, text, section: panel.querySelector('#plan-section').value });
    persist(); input.value = ''; render(); input.focus();
  });
  render();
  return { setMode(mode) { panel.hidden = mode !== 'plan'; } };
}
