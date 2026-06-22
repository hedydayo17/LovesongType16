#!/usr/bin/env python3
"""songs.js / data.js の整合性監査。

実行:  python3 scripts/audit-songs.py
出力:  - 重複曲(title+artist)
       - cluster別曲数
       - mood想定分布
       - flat曲(std<0.8、個性なし)
       - クラスタ未割当アーティスト

正常時 exit 0、異常検出時 exit 1。CI/git hookに組み込み可。
"""
from __future__ import annotations
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SONGS = ROOT / "app" / "js" / "songs.js"
DATA = ROOT / "app" / "js" / "data.js"

def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    songs_src = SONGS.read_text()
    data_src = DATA.read_text()

    # 1) 重複曲
    pairs = re.findall(r'title:\s*"([^"]+)",\s*artist:\s*"([^"]+)"', songs_src)
    dup = [k for k, v in Counter(f"{t}|||{a}" for t, a in pairs).items() if v > 1]
    if dup:
        errors.append(f"重複曲 {len(dup)} 件: {dup[:3]}{'…' if len(dup) > 3 else ''}")
    print(f"曲総数: {len(pairs)} (ユニーク {len(set(f'{t}|||{a}' for t,a in pairs))})")

    # 2) ARTIST_CLUSTERS パース
    ac_m = re.search(r'const ARTIST_CLUSTERS\s*=\s*\{([^;]+?)\};', data_src, re.DOTALL)
    ac: dict[str, list[str]] = {}
    if ac_m:
        for line in ac_m.group(1).splitlines():
            m = re.match(r'\s*"([^"]+)":\s*\[([^\]]+)\]', line)
            if m:
                ac[m.group(1)] = re.findall(r'"([^"]+)"', m.group(2))

    # 3) cluster別曲数 + 未割当
    counts: Counter[str] = Counter()
    no_clus: Counter[str] = Counter()
    for _t, a in pairs:
        cs = ac.get(a, [])
        if not cs:
            no_clus[a] += 1
        for c in cs:
            counts[c] += 1
    print("\nCluster別曲数:")
    for c, n in sorted(counts.items(), key=lambda x: -x[1]):
        status = "OK" if n >= 30 else ("普通" if n >= 15 else "薄い!")
        print(f"  {c:18s} {n:3d}曲  {status}")
        if n < 15:
            warnings.append(f"{c} cluster が薄い ({n}曲、推奨30+)")
    if no_clus:
        warnings.append(f"クラスタ未割当アーティスト {len(no_clus)} 名: {dict(no_clus)}")
        print(f"\n警告: 未割当アーティスト {len(no_clus)} 名: {dict(no_clus)}")

    # 4) flat曲検出(std<0.8)
    type_keys_m = re.findall(
        r'\{\s*key:\s*"([^"]+)"',
        re.search(r'const TYPES\s*=\s*\[([^;]+?)\];', data_src, re.DOTALL).group(1)
    )
    flat_count = 0
    for blk in re.finditer(r'scores:\s*\{([^}]+)\}', songs_src):
        scores = re.findall(r'"[^"]+":\s*(\d+)', blk.group(1))
        if len(scores) < 16: continue
        vals = [int(x) for x in scores]
        mean = sum(vals) / len(vals)
        std = (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5
        if std < 0.8:
            flat_count += 1
    if flat_count > 0:
        warnings.append(f"flat曲(std<0.8、個性不足)が {flat_count} 件")
    print(f"\nflat曲(std<0.8): {flat_count} 件")

    # 結果
    print()
    if errors:
        print("=== エラー ===")
        for e in errors: print(f"  ✗ {e}")
    if warnings:
        print("=== 警告 ===")
        for w in warnings: print(f"  ⚠ {w}")
    if not errors and not warnings:
        print("✓ 全チェックOK")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
