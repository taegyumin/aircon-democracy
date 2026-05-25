#!/usr/bin/env python3
"""Aggregate parsed Wi-Fi rows into building + room datasets.

Input  : /tmp/snu_rooms_raw.json (from parse_wifi_pdf.py)
Outputs:
  src/data/snu-buildings.json  — [{ campus, code, name, aliases?, roomCount }]
  src/data/snu-rooms.json      — [{ campus, code, name, room, label, kind }]
        kind ∈ {"classroom", "lab", "office", "lounge", "corridor", "other"}

`kind` is a coarse classification for the aircon-democracy use case so we
can default the wizard to public/shared rooms (classroom + lab + lounge).
"""
import json
import re
from collections import defaultdict
from pathlib import Path

RAW = Path("/tmp/snu_rooms_raw.json")
OUT_DIR = Path(__file__).resolve().parent.parent.parent / "src" / "data"

CORRIDOR_LABEL_RE = re.compile(r"(복도|로비|입구|계단|화장실|엘리베이터|승강기)")
LOUNGE_RE = re.compile(r"(라운지|휴게실|스터디카페|학생회실|학부생실|학생휴게|공용공간)")
OFFICE_RE = re.compile(r"(연구실|교수실|사무실|행정실|총무|위원실|이사장|본부장|단장실|센터장)")
LAB_RE = re.compile(r"(실험실|실습실|어학실|시청각실|전산|연구|공동기기|개발|기기실)")
CLASS_RE = re.compile(r"(강의실|세미나실|회의실|소회의|토론실|강당|강의동|홀)")

# Floor-only markers that mean "wifi AP at floor N, no specific room"
FLOOR_ONLY_RE = re.compile(r"^[B]?\d+F$")


def classify(label: str, room: str) -> str:
    if FLOOR_ONLY_RE.match(room):
        return "corridor"
    if CORRIDOR_LABEL_RE.search(label):
        return "corridor"
    if LOUNGE_RE.search(label):
        return "lounge"
    if OFFICE_RE.search(label):
        return "office"
    if LAB_RE.search(label):
        return "lab"
    if CLASS_RE.search(label):
        return "classroom"
    return "other"


def main():
    rows = json.loads(RAW.read_text())

    # Buildings keyed by (campus, code). Pick the most common name as canonical;
    # collect variants as aliases.
    by_building: dict[tuple[str, str], dict] = defaultdict(lambda: {
        "names": defaultdict(int),
        "rooms": set(),
    })

    rooms_out = []

    for r in rows:
        key = (r["campus"], r["code"])
        by_building[key]["names"][r["name"]] += 1
        room_key = (r["room"], r["label"])
        if room_key not in by_building[key]["rooms"]:
            by_building[key]["rooms"].add(room_key)
            rooms_out.append({
                "campus": r["campus"],
                "code": r["code"],
                "name": r["name"],
                "room": r["room"],
                "label": r["label"],
                "kind": classify(r["label"], r["room"]),
            })

    buildings_out = []
    for (campus, code), data in by_building.items():
        names = sorted(data["names"].items(), key=lambda kv: -kv[1])
        canonical = names[0][0]
        aliases = [n for n, _ in names[1:]]
        b = {
            "campus": campus,
            "code": code,
            "name": canonical,
            "roomCount": len(data["rooms"]),
        }
        if aliases:
            b["aliases"] = aliases
        buildings_out.append(b)

    # Sort buildings: 관악 first, then 연건; within each, numeric codes first sorted naturally
    def code_sort_key(b):
        campus_order = {"관악": 0, "연건": 1, "평창": 2}.get(b["campus"], 9)
        code = b["code"]
        m = re.match(r"^(\d+)(?:-(\d+))?$", code)
        if m:
            return (campus_order, 0, int(m.group(1)), int(m.group(2) or 0), code)
        return (campus_order, 1, 0, 0, code)

    buildings_out.sort(key=code_sort_key)

    # Sort rooms
    def room_sort_key(r):
        b_key = code_sort_key({"campus": r["campus"], "code": r["code"]})
        m = re.match(r"^([B])?(\d+)(?:[-A-Z](\d+))?", r["room"])
        if m:
            basement = 1 if m.group(1) else 0
            return b_key + (basement, int(m.group(2)), int(m.group(3) or 0), r["room"])
        return b_key + (9, 9999, 0, r["room"])

    rooms_out.sort(key=room_sort_key)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "snu-buildings.json").write_text(
        json.dumps(buildings_out, ensure_ascii=False, indent=2) + "\n"
    )
    (OUT_DIR / "snu-rooms.json").write_text(
        json.dumps(rooms_out, ensure_ascii=False, indent=2) + "\n"
    )

    # Print summary
    by_kind: dict[str, int] = defaultdict(int)
    for r in rooms_out:
        by_kind[r["kind"]] += 1
    print(f"Buildings: {len(buildings_out)}")
    print(f"Rooms    : {len(rooms_out)}")
    print(f"  관악: {sum(1 for b in buildings_out if b['campus']=='관악')} buildings, "
          f"{sum(b['roomCount'] for b in buildings_out if b['campus']=='관악')} rooms")
    print(f"  연건: {sum(1 for b in buildings_out if b['campus']=='연건')} buildings, "
          f"{sum(b['roomCount'] for b in buildings_out if b['campus']=='연건')} rooms")
    print("Room kinds:")
    for k in ("classroom", "lab", "office", "lounge", "corridor", "other"):
        print(f"  {k:9s}: {by_kind.get(k, 0)}")


if __name__ == "__main__":
    main()
