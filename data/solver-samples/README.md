# Solver samples

Keep each observation in a separate folder. These are user-supplied solver exports,
independent of the app's original CO preflop range and its calculated flop classes.
Do not substitute that CO range for a sample's missing node reach weights.

Each sample contains:

- `raw.txt`: the exact pasted file, without reformatting or averaging.
- `weights-raw.txt`, when supplied: the exact pasted range-weight export.
- `sample.json`: reported context, provenance, per-combination frequencies,
  validation results, and explicitly missing information. `schema_version` is 1.

## Related-board collection status

The active AK6–AK2 collection uses **standard Xeno ranges**, as confirmed by the
user. The solver was initially called “Zeno” in the conversation; directory names
retain that prefix. `ak-low-two-tone-collection.json` identifies collection members
and explicitly excludes the original Mobius AK6 reference. No averages have been
computed; grouping and cross-flop weighting remain undecided.

| Board | Range source | Bet-75% frequencies | Range weights | Collection status |
| --- | --- | --- | --- | --- |
| As Kh 6h | Mobius GTO | Saved | Saved | Separate reference; excluded from standard collection |
| As Kh 6h | Standard Xeno | Pending | Pending | User will collect again |
| As Kh 5h | Standard Xeno | Saved | Saved | Ready for later grouped analysis |
| As Kh 4h | Standard Xeno | Saved | Pending | Frequencies saved; awaiting weights |
| As Kh 3h | Standard Xeno | Pending | Pending | Awaiting exports |
| As Kh 2h | Standard Xeno | Pending | Pending | Awaiting exports |

AK5 is stored at `zeno-standard-btn-vs-straddle-200bb-AsKh5h-bet75`. Its source was
initially mislabeled by provisional inheritance from AK6; the user explicitly
corrected it to standard Xeno ranges. The JSON records that correction and former
sample ID. Its original betting export has not changed. Other game settings carry
over from the conversation. Do not reuse AK6's board-filtered weights on AK5.

For standard-range AK5, the supplied weights total **497.65** across 523 legal
positive-weight combos (478 full-weight and 45 fractional). The matched strategy
gives **263.2461905** weighted betting combinations and **234.4038095** weighted
checking combinations: **52.897858% bet / 47.102142% check**. All 1,326 weight keys
match the betting export, all 150 blocked weights are zero, and no zero-weight
legal combo has a positive betting frequency. Raw inputs and checksums are retained.

## First sample

`zeno-mobius-btn-vs-straddle-200bb-AsKh6h-bet75`

- Source: Zeno, using Mobius GTO preflop ranges instead of its standard ranges.
- Eight-handed, 200 BB starting stacks, 0.5 BB ante per player.
- Rake: 4%, capped at 1.75 BB.
- Button raises to 6 BB; straddle calls. Reported flop pot: 17.5 BB.
- Flop: As Kh 6h. Recorded action: BTN bets 75% pot.
- Complete BTN action menu at this decision: **check or bet 75% pot**.
  There is exactly one available betting size; the paste records its frequencies.
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

For a legal combination that reaches this decision, the checking frequency is
`1 - bet_frequency`, because the complete action menu is check or bet 75% pot.
For example, `0.744` means bet 74.4% and check 25.6%. A legal zero means always
check only if the combination has positive reach weight. Zero entries do not
establish range membership; do not assign checking weight to absent-range or
board-blocked combinations. The checking strategy is derivable, not a separately
supplied export. The first sample now includes user-supplied per-combination range
weights in `reach_weight`. Action EVs remain missing.

## Range weights and first-sample aggregate

The weight export contains all 1,326 physical combinations and matches the bet
export exactly by unordered card pair. All 150 board-blocked combinations have
zero weight. There are 535 legal positive-weight combinations: 489 have full
weight and 46 have fractional weight. Their combined range weight is **508.66**.
Each record already represents a physical combination; do not multiply by 4, 6,
or 12 again.

Applying the supplied betting strategy gives:

| Action | Weighted combinations | Overall frequency |
| --- | ---: | ---: |
| Bet 75% pot | 276.4826975 | 54.355109% |
| Check | 232.1773025 | 45.644891% |
| Total | 508.66 | 100% |

These are calculated from the pasted values using decimal arithmetic. Any solver
display rounding in the original exports remains part of the input precision.
The raw weight file has its own checksum and provenance in `sample.json`.
Derived totals are stored in `derived_statistics`.

Overall betting rate is calculated using node reach weights:

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
