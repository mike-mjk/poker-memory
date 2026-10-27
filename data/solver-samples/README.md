# Solver samples

Keep each observation in a separate folder. These are user-supplied solver exports,
independent of the app's original CO preflop range and its calculated flop classes.
Do not substitute that CO range for a sample's missing node reach weights.

Each sample contains:

- `raw.txt`: the exact pasted file, without reformatting or averaging.
- `sample.json`: reported context, provenance, per-combination frequencies,
  validation results, and explicitly missing information. `schema_version` is 1.

## First sample

`zeno-mobius-btn-vs-straddle-200bb-AsKh6h-bet75`

- Source: Zeno, using Mobius GTO preflop ranges instead of its standard ranges.
- Eight-handed, 200 BB starting stacks, 0.5 BB ante per player.
- Rake: 4%, capped at 1.75 BB.
- Button raises to 6 BB; straddle calls. Reported flop pot: 17.5 BB.
- Flop: As Kh 6h. Recorded action: BTN bets 75% pot.
- The nominal bet is 13.125 BB; solver rounding is unconfirmed.

The starting stack is not the flop pot or the remaining stack at this node.
Unknown settings are null or listed in `unconfirmed_context`, rather than inferred.
Reported context has not been independently verified against the solver.

## Frequency interpretation

Each record identifies two exact cards and the supplied action frequency on a
0-to-1 scale. Preserve suit-specific differences. A value of `0.744` is 74.4%.

The first paste lists all 1,326 unordered physical combinations, including 150
board-blocked combinations, all of which have zero values. The remaining 1,176
legal combinations include 708 zeros, 445 mixed values, and 23 values of one.
Retain the blocked entries for provenance and exclude them from analysis.

Legal zeros may represent absent range combinations or combinations that choose
another action. Do not infer range membership or a complementary checking/folding
frequency from this one-action export. Per-combination reach weights, other action
strategies, and action EVs have not been supplied.

Overall betting rate requires node reach weights:

```text
sum(reach_weight[combo] * bet_frequency[combo]) / sum(reach_weight[combo])
```

Apply this over legal combinations at the recorded decision. An unweighted mean
over exported entries is not the overall strategy frequency. Cross-flop averages
also need an explicit board-weighting rule; preserve individual samples first.

EV-loss analysis additionally needs an evaluation method or compatible action EVs.
Comparing a fixed-opponent policy using action EVs and measuring exploitability
after an opponent re-solves are different evaluations and must be labeled.

Raw-file SHA-256 and byte size are recorded in the JSON so future transformations
can be traced back to the original export. Future samples should preserve the
same separation between raw data, reported context, and derived analysis.
