"""Build and solve the Mobius AsKh2h pilot with the installed PioSolver 2.

Outputs stay in this workspace. No existing solver files are modified.
"""
import argparse
import hashlib
import json
import queue
import re
import subprocess
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'pio-pilot' / 'mobius-AsKh2h'
EXE = Path(r'C:\PioSOLVER\PioSOLVER2-basic.exe')
RANGES = Path(r'C:\PioSOLVER\Ranges\Mobius WPT Gold NL400 rake')
POT, STACK = 1750, 19350


class Pio:
    def __init__(self):
        self.log = (OUT / 'upi.log').open('a', encoding='utf-8')
        self.q = queue.Queue()
        self.p = subprocess.Popen([str(EXE)], cwd=EXE.parent, stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                  text=True, encoding='utf-8', errors='replace')
        threading.Thread(target=self.read, daemon=True).start()
        self.cmd('set_end_string END')
        self.cmd('is_ready')

    def read(self):
        for line in self.p.stdout:
            self.log.write(line)
            self.log.flush()
            self.q.put(line.rstrip())

    def cmd(self, command, timeout=600):
        self.log.write('> ' + command + '\n')
        self.log.flush()
        self.p.stdin.write(command + '\n')
        self.p.stdin.flush()
        result = []
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                line = self.q.get(timeout=1)
            except queue.Empty:
                if self.p.poll() is not None:
                    raise RuntimeError('Pio exited unexpectedly')
                continue
            if line == 'END':
                response = '\n'.join(result)
                if 'ERROR' in response:
                    raise RuntimeError(command.split()[0] + ': ' + response)
                return response
            result.append(line)
        raise TimeoutError(command.split()[0])

    def close(self):
        if self.p.poll() is None:
            self.p.stdin.write('exit\n')
            self.p.stdin.flush()
            self.p.wait(timeout=30)
        self.log.close()


def parse_info(text):
    return dict(line[1:].split('#', 1) for line in text.splitlines() if line.startswith('#'))


def pilot_info():
    info = {'Type': 'NoLimit', 'Range0': (RANGES / 'STR call vs BTN RFI.txt').read_text().strip(),
            'Range1': (RANGES / 'BTN RFI.txt').read_text().strip(),
            'Board': 'As Kh 2h', 'Pot': str(POT), 'EffectiveStacks': str(STACK),
            'Rake.Enabled': 'True', 'Rake.Fraction': '0.05', 'Rake.Cap': '400',
            'AllinThreshold': '67', 'AddAllinOnlyIfLessThanThisTimesThePot': '1000'}
    for street, bet, raise_size, donk in [('Flop', '75', '50', ''), ('Turn', '50', '50', '50'), ('River', '75', '75', '25')]:
        for ip in ['', 'IP']:
            key = street + 'Config' + ip + '.'
            info[key + 'BetSize'] = bet if ip or street != 'Flop' else ''
            info[key + 'RaiseSize'] = raise_size
            if not ip:
                info[key + 'DonkBetSize'] = donk
            info[key + 'AddAllin'] = str(street != 'Flop')
    return info


def generate(info):
    pot, stack = int(info['Pot']), int(info['EffectiveStacks'])
    threshold = float(info['AllinThreshold']) / 100 * stack
    max_ai = float(info['AddAllinOnlyIfLessThanThisTimesThePot']) / 100
    lines = set()

    def walk(street, carry, actor, high, last_raise, checked, donk, seq):
        if street == 3 or carry == stack:
            return
        key = ['Flop', 'Turn', 'River'][street] + 'Config' + ('IP' if actor else '') + '.'
        facing = high > (seq[-2] if len(seq) > 1 else carry)
        if facing:
            if high < stack:
                walk(street + 1, high, 0, high, 0, False, actor == 0, seq + (high,))
            size_key = 'RaiseSize'
        else:
            if checked:
                walk(street + 1, carry, 0, carry, 0, False, False, seq + (carry,))
            else:
                walk(street, carry, 1, high, 0, True, donk, seq + (carry,))
            size_key = 'DonkBetSize' if actor == 0 and donk else 'BetSize'
        sizes = [float(x) for x in info.get(key + size_key, '').split(',') if x.strip()]
        bets = set()
        for size in sizes:
            target = high + round((pot + 2 * high) * size / 100)
            if facing:
                target = max(target, high + last_raise)
            if target >= threshold:
                target = stack
            bets.add(min(target, stack))
        if info.get(key + 'AddAllin') == 'True' and stack - high < max_ai * (pot + 2 * high):
            bets.add(stack)
        for target in sorted(bets):
            if target <= high:
                continue
            new_seq = seq + (target,)
            lines.add(new_seq)
            if target < stack:
                walk(street, carry, 1 - actor, target, target - high, False, donk, new_seq)

    walk(0, 0, 0, 0, 0, False, False, ())
    return lines


def node_to_line(node):
    out, carry, high, checks = [], 0, 0, 0
    for token in node.split(':')[2:]:
        if token == 'c':
            if high > carry:
                out.append(high)
                carry, checks = high, 0
            else:
                out.append(carry)
                checks += 1
                if checks == 2:
                    checks, high = 0, carry
        elif token.startswith('b'):
            high, checks = int(token[1:]), 0
            out.append(high)
        else:
            raise ValueError(node)
    return tuple(out)


def weights(text, order):
    entries = {}
    ranks = '23456789TJQKA'
    for token in text.split(','):
        hand, _, weight = token.partition(':')
        assert re.fullmatch(r'[2-9TJQKA]{2}[so]?', hand), hand
        value = float(weight or 1)
        assert 0 <= value <= 1
        for kind in ([hand[2]] if len(hand) == 3 else ['s', 'o']):
            entries[hand[:2] + kind] = value
    result = []
    for combo in order:
        a, b = combo[:2], combo[2:]
        hi, lo = sorted([a[0], b[0]], key=ranks.index, reverse=True)
        result.append(entries.get(hi + lo + ('s' if a[1] == b[1] else 'o'), 0))
    return result


def validate(pio):
    pio.cmd(r'load_tree "D:\Pio_solves\Mike solves\test a 10-27.cfr"')
    info = parse_info(pio.cmd('show_tree_info'))
    actual = {node_to_line(n) for n in pio.cmd('show_all_lines').splitlines() if n.split(':')[-1].startswith('b')}
    expected = generate(info)
    report = {'actual': len(actual), 'generated': len(expected),
              'missing': sorted(actual - expected), 'extra': sorted(expected - actual)}
    (OUT / 'builder-validation.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v if not isinstance(v, list) else v[:5] for k, v in report.items()}), flush=True)
    assert actual == expected, 'Generator differs from the native Pio tree; inspect builder-validation.json'


def verify_saved(pio):
    solution = OUT / 'AsKh2h.cfr'
    pio.cmd(f'load_tree "{solution}"')
    root = pio.cmd('show_node r')
    info = parse_info(pio.cmd('show_tree_info'))
    assert 'As Kh 2h' in root and 'RAKE_ON' in root and 'PIO_CFR' in root
    for key, value in pilot_info().items():
        assert info.get(key, '').replace(' ', '') == value.replace(' ', ''), key
    results = pio.cmd('calc_results')
    exploit = float(re.search(r'Exploitable for:\s*([\d.eE+-]+)', results, re.I)[1])
    assert exploit <= 3.5
    export = json.loads((OUT / 'flop-export.json').read_text())
    saved_strategy = [list(map(float, row.split())) for row in pio.cmd('show_strategy r:0:c').splitlines()]
    exported_strategy = [list(map(float, row.split())) for row in export['show_strategy r:0:c'].splitlines()]
    assert len(saved_strategy) == len(exported_strategy) == 2
    assert all(len(row) == 1326 for row in saved_strategy + exported_strategy)
    assert max(abs(a-b) for row, other in zip(saved_strategy, exported_strategy)
               for a,b in zip(row,other)) < 0.0001
    freq = {action: float(pio.cmd('calc_global_freq r:0:c:' + action).split()[0])
            for action in ['c', 'b1312']}
    assert abs(sum(freq.values()) - 1) < 0.0001
    verification = {'reloaded_solution': str(solution), 'exploitability_chips': exploit,
                    'exploitability_pot_percent': exploit / POT * 100,
                    'flop_action_frequencies': freq, 'strategy_export_matches': True,
                    'settings_match': True}
    (OUT / 'verification.json').write_text(json.dumps(verification, indent=2))
    print(json.dumps(verification, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--validate-only', action='store_true')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if not args.validate_only and not args.verify_only and (OUT / 'AsKh2h.cfr').exists():
        raise FileExistsError('Pilot solution already exists; choose a new output folder before rerunning')
    pio = Pio()
    try:
        if args.verify_only:
            verify_saved(pio)
            return
        validate(pio)
        if args.validate_only:
            return
        info = pilot_info()
        lines = generate(info)
        order = pio.cmd('show_hand_order').split()
        assert len(order) == 1326 and len(set(order)) == 1326
        payloads = [weights(info['Range' + str(i)], order) for i in range(2)]
        commands = ['clear_lines', 'set_board AsKh2h', f'set_pot 0 0 {POT}',
                    f'set_eff_stack {STACK}', 'set_isomorphism 1 0']
        commands += ['set_range ' + who + ' ' + ' '.join(map(str, payload))
                     for who, payload in zip(['OOP', 'IP'], payloads)]
        commands += ['add_line ' + ' '.join(map(str, line)) for line in sorted(lines)]
        commands += ['build_tree', 'set_rake 0.05 400', 'reset_tree_info']
        commands += ['add_info_line #' + k + '#' + v.replace(' ', '') for k, v in info.items() if v]
        commands += ['set_algorithm pio_cfr', 'set_accuracy 3.5', 'set_threads 0', 'set_info_freq 10']
        (OUT / 'build-script.txt').write_text('\n'.join(commands) + '\n')
        for cmd in commands:
            reply = pio.cmd(cmd)
            if cmd.split()[0] in ['build_tree', 'set_rake', 'set_algorithm', 'set_accuracy']:
                print(reply, flush=True)
        built = {node_to_line(n) for n in pio.cmd('show_all_lines').splitlines() if n.split(':')[-1].startswith('b')}
        assert lines == built
        for who, payload in zip(['OOP', 'IP'], payloads):
            received = list(map(float, pio.cmd(f'show_range {who} r').split()))
            assert len(received) == 1326 and max(abs(a-b) for a,b in zip(received, payload)) < 1e-5
        root = pio.cmd('show_node r')
        settings = pio.cmd('show_settings')
        assert 'PIO_CFR' in root and 'RAKE_ON' in root
        manifest = {'board': 'AsKh2h', 'pot_chips': POT, 'remaining_stack_chips': STACK,
                    'chips_per_bb': 100, 'rake_fraction': 0.05, 'rake_cap_chips': 400,
                    'algorithm': 'pio_cfr', 'target_pot_percent': 0.2, 'target_chips': 3.5,
                    'betting_lines': len(lines), 'tree_info': info, 'solver_settings': settings,
                    'range_sha256': {name: hashlib.sha256((RANGES / name).read_bytes()).hexdigest()
                                     for name in ['BTN RFI.txt', 'STR call vs BTN RFI.txt']}}
        (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        (OUT / 'tree-info.txt').write_text(pio.cmd('show_tree_info'))
        print(root, settings, flush=True)
        print(pio.cmd('go'), flush=True)
        # Wait for Pio's own terminal solve notification without interleaving commands.
        while True:
            line = pio.q.get(timeout=3600)
            if line.startswith(('running time', 'EV ', 'Exploitable', 'SOLVER', 'solver')):
                print(line, flush=True)
            if line.startswith('SOLVER: stopped'):
                break
        results = pio.cmd('calc_results')
        print(results, flush=True)
        match = re.search(r'Exploitable for:\s*([\d.eE+-]+)', results, re.I)
        assert match and float(match[1]) <= 3.5, 'Requested accuracy not yet achieved'
        (OUT / 'results.txt').write_text(results)
        solution = OUT / 'AsKh2h.cfr'
        assert not solution.exists(), 'Refusing to overwrite an existing solution'
        print(pio.cmd(f'dump_tree "{solution}"'), flush=True)
        export = {cmd: pio.cmd(cmd) for cmd in ['show_children r:0:c', 'show_strategy r:0:c',
                  'show_range IP r:0:c', 'show_hand_order', 'calc_ev IP r:0:c']}
        (OUT / 'flop-export.json').write_text(json.dumps(export, indent=2))
        manifest['achieved_exploitability_chips'] = float(match[1])
        manifest['achieved_exploitability_pot_percent'] = float(match[1]) / POT * 100
        manifest['solution_bytes'] = solution.stat().st_size
        (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        print('Saved ' + str(solution), flush=True)
        verify_saved(pio)
    finally:
        pio.close()


if __name__ == '__main__':
    main()
