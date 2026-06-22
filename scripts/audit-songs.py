#!/usr/bin/env python3
"""songs.js / data.js の整合性監査。

実行:  python3 scripts/audit-songs.py
出力:
  - 重複曲(title+artist)
  - cluster別曲数 + 未割当アーティスト
  - mood想定分布(平均化判定で各曲を5moodに分類)
  - flat曲(std<0.8、個性なし)
  - タイプ別の「高得点(7+)曲数」(各タイプにどれだけ「ハマる曲」があるか)

正常時 exit 0、異常検出時 exit 1。CI/git hookに組み込み可。
"""
from __future__ import annotations
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SONGS = ROOT / "app" / "js" / "songs.js"
DATA = ROOT / "app" / "js" / "data.js"
APP = ROOT / "app" / "js" / "app.js"

# mood定義(app.js の MOOD_DEFS と同期)
MOOD_DEFS = [
    ("切ない",   ["沼っくま", "進撃のロマンチスト", "ミステリアス狼"]),
    ("エモい",   ["情熱ラブゾンビ", "ヤキモチモンスター", "ド直球ザウルス"]),
    ("前向き",   ["バイブス警察", "ときめきパパラッチ", "推し活ベビー"]),
    ("穏やか",   ["チル仙人", "慎重うさぎ", "マブダチエイリアン", "同志の虎"]),
    ("キラキラ", ["ピュアエンジェル", "運命マジシャン", "一途ペンギン"]),
]

TYPE_KEYS_ALL = [
    "バイブス警察", "運命マジシャン", "進撃のロマンチスト", "一途ペンギン",
    "沼っくま", "ヤキモチモンスター", "推し活ベビー", "チル仙人",
    "慎重うさぎ", "マブダチエイリアン", "ミステリアス狼", "同志の虎",
    "情熱ラブゾンビ", "ときめきパパラッチ", "ド直球ザウルス", "ピュアエンジェル",
]


def parse_song_scores(src: str) -> list[tuple[str, str, dict[str, int]]]:
    """songs.js を逐次パース → [(title, artist, {type:score})] 形式に。"""
    songs = []
    # 各曲ブロックを extract: { title: "..", artist: "..", ..., scores: {...} }
    for m in re.finditer(
        r'title:\s*"([^"]+)",\s*artist:\s*"([^"]+)"[^{]*scores:\s*\{([^}]+)\}',
        src
    ):
        title, artist, sblk = m.group(1), m.group(2), m.group(3)
        scores: dict[str, int] = {}
        for sm in re.finditer(r'"([^"]+)":\s*(\d+)', sblk):
            scores[sm.group(1)] = int(sm.group(2))
        songs.append((title, artist, scores))
    return songs


def mood_of(scores: dict[str, int]) -> str | None:
    """app.js moodOf() の Python 移植(平均化判定)。"""
    best_name, best_avg = None, -1.0
    for name, types in MOOD_DEFS:
        s = sum(scores.get(t, 0) for t in types)
        avg = s / max(1, len(types))
        if avg > best_avg:
            best_avg = avg
            best_name = name
    return best_name


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    songs_src = SONGS.read_text()
    data_src = DATA.read_text()

    songs = parse_song_scores(songs_src)
    pairs = [(t, a) for t, a, _ in songs]

    # 1) 重複曲
    dup = [k for k, v in Counter(f"{t}|||{a}" for t, a in pairs).items() if v > 1]
    if dup:
        errors.append(f"重複曲 {len(dup)} 件: {dup[:3]}{'…' if len(dup) > 3 else ''}")
    print(f"曲総数: {len(songs)} (ユニーク {len(set(f'{t}|||{a}' for t,a in pairs))})")

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
        warnings.append(f"クラスタ未割当アーティスト {len(no_clus)} 名")
        print(f"\n警告: 未割当アーティスト {len(no_clus)} 名: {dict(no_clus)}")

    # 4) mood分布(平均化判定で各曲を5moodに分類)
    mood_counts: Counter[str] = Counter()
    for _, _, scores in songs:
        m = mood_of(scores)
        if m:
            mood_counts[m] += 1
    print("\nMood想定分布:")
    total = len(songs)
    for m_name, _ in MOOD_DEFS:
        n = mood_counts[m_name]
        pct = (n / total * 100) if total else 0
        status = "OK" if n >= 25 else ("少な目" if n >= 10 else "極少")
        print(f"  {m_name:6s} {n:3d}曲 ({pct:5.1f}%)  {status}")
        if n < 10:
            warnings.append(f"mood「{m_name}」が極少({n}曲) — moodOf判定で出ない可能性")

    # 5) flat曲検出(std<0.8)
    flat_list: list[str] = []
    for title, artist, scores in songs:
        if len(scores) < 16:
            continue
        vals = list(scores.values())
        mean = sum(vals) / len(vals)
        std = (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5
        if std < 0.8:
            flat_list.append(f"{title}/{artist}")
    if flat_list:
        warnings.append(f"flat曲(std<0.8) {len(flat_list)} 件: {flat_list[:3]}")
    print(f"\nflat曲(std<0.8): {len(flat_list)} 件")

    # 6) タイプ別の「高得点(7+)曲数」=各タイプに「ハマる曲」の絶対数
    high_per_type: Counter[str] = Counter()
    for _, _, scores in songs:
        for t in TYPE_KEYS_ALL:
            if scores.get(t, 0) >= 7:
                high_per_type[t] += 1
    print("\nタイプ別「高得点(7+)曲数」 — 各タイプに何曲「ハマる曲」があるか:")
    for t in TYPE_KEYS_ALL:
        n = high_per_type[t]
        status = "OK" if n >= 80 else ("普通" if n >= 40 else "薄い")
        print(f"  {t:14s} {n:3d}曲  {status}")
        if n < 40:
            warnings.append(f"タイプ「{t}」の高得点(7+)曲が少ない({n}件)")

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
