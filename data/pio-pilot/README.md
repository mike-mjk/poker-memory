# Mobius pilot

This is the new Mobius study described in the website's Plan tab. Its outputs
are independent of the Xeno samples used by the Averages trainer.

The first board is **As Kh 2h**. Configuration:

- OOP: `C:\PioSOLVER\Ranges\Mobius WPT Gold NL400 rake\STR call vs BTN RFI.txt`.
- IP: `C:\PioSOLVER\Ranges\Mobius WPT Gold NL400 rake\BTN RFI.txt`.
- Pot: 1,750 chips (17.5 BB); remaining stack: 19,350 chips (193.5 BB).
- Rake: 5%, capped at 400 chips (4 BB).
- Algorithm: PiO-CFR, using the installed PioSolver Basic 2.0.8.
- Target exploitability: 0.2% of the starting pot = 3.5 chips = 0.035 BB.

Completed and verified by reopening the saved solution: **3.367 chips = 0.1924%
of the pot**. The button bets 48.5502% and checks 51.4498%, using Pio's
matchup-weighted line frequencies. Its 75%-pot bet rounds to 1,312 chips.

| Street | OOP bet / donk / raise | IP bet / raise | Add all-in |
| --- | --- | --- | --- |
| Flop | None / none / 50% | 75% / 50% | Off |
| Turn | 50% / 50% / 50% | 50% / 50% | Both players |
| River | 75% / 25% / 75% | 75% / 75% | Both players |

All-in threshold is 67% of the initial effective stack. Explicit all-ins are
offered only below 1,000% of the pot. Raises may continue; no don't-3-bet
restriction is applied. Bet amounts use whole solver chips.

Run from the repository root with access to the existing local Pio license:

```powershell
python scripts/pio-pilot.py --validate-only
python scripts/pio-pilot.py
python scripts/pio-pilot.py --verify-only
```

The script first compares its generated betting lines against the native Pio
tree saved at `D:\Pio_solves\Mike solves\test a 10-27.cfr`. That reference is
read only: its ranges, rake and flop are not used for the pilot. The generator
must reproduce all 110 reference betting lines without missing or extra lines.
The pilot itself has 128 betting lines. Both imported ranges are checked against
Pio's 1,326-combination hand order and read back before solving.

Outputs in `mobius-AsKh2h/`:

- `AsKh2h.cfr`: full solution, including rivers, openable in PioViewer.
- `manifest.json`: exact settings, source checksums and achieved exploitability.
- `results.txt`: Pio's final EV and exploitability report, in solver chips.
- `flop-export.json`: button strategy, range, EV and hand-order exports.
- `build-script.txt`: UPI commands to reconstruct the tree.
- `tree-info.txt`: PioViewer tree-builder metadata.
- `builder-validation.json`: native reference comparison.
- `verification.json`: saved-file accuracy, settings and strategy checks.
- `upi.log`: local command/response log.

All generated pilot output folders are excluded from Git, including solutions,
range and strategy exports, reports, generated build commands and logs. The
script and this documentation are tracked. Solver data remains on this computer;
copying or syncing the repository alone does not transfer it. The script refuses
to overwrite an existing solution.
