#!/usr/bin/env python3
"""Parse the SNU IST Wi-Fi inventory PDF into structured JSON.

Source PDF: https://ist.snu.ac.kr/wp-content/uploads/sites/186/2024/02/무선현황_202402.pdf
This is the most complete public, structured listing of SNU rooms with
building number + building name + room number + room label, covering 관악 + 연건.

Usage:
    pdftotext -layout 무선현황_202402.pdf - | python3 parse_wifi_pdf.py > snu_rooms.json

Outputs JSON: [{ campus, code, name, room, label }, ...]
"""

import json
import re
import sys

ROW_RE = re.compile(r"^\s*(관악|연건|평창)\s+(\S+)\s+(\S+(?:\s\S+)*?)\s{2,}(\S+)\s{2,}(.+?)\s*$")
SIMPLE_RE = re.compile(r"^\s*(관악|연건|평창)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+?)\s*$")


def parse_line(line: str):
    # Try multi-space-aware split first
    parts = re.split(r"\s{2,}", line.strip())
    if len(parts) >= 5:
        return tuple(parts[:5])
    # Fallback: single-space whitespace split into 5 tokens, last is room label
    tokens = line.strip().split()
    if len(tokens) >= 5 and tokens[0] in ("관악", "연건", "평창"):
        return (tokens[0], tokens[1], tokens[2], tokens[3], " ".join(tokens[4:]))
    return None


def main():
    rows = []
    seen = set()
    for raw in sys.stdin:
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        if line.lstrip().startswith("캠퍼스"):
            continue  # header
        parsed = parse_line(line)
        if not parsed:
            continue
        campus, code, name, room, label = parsed
        # Skip obvious non-room labels: corridors / floor markers
        # We keep them in raw output so caller can filter as needed.
        key = (campus, code, name, room, label)
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "campus": campus,
            "code": code,
            "name": name,
            "room": room,
            "label": label,
        })
    json.dump(rows, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == "__main__":
    main()
