#!/usr/bin/env python3
"""Add a `college` field to each building in src/data/snu-buildings.json.

Rule-based classifier driven by official Gwanak campus map's building-number
ranges. When the building's name itself already names the college (e.g.
"공과대학", "사범대학"), we trust the name. Otherwise we apply numeric ranges.
"""
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "snu-buildings.json"

# Name → college (exact-ish substring match wins)
NAME_RULES = [
    ("인문대학", "인문대학"), ("인문관", "인문대학"), ("두산인문관", "인문대학"),
    ("사범대학", "사범대학"), ("교육정보관", "사범대학"), ("사범관", "사범대학"),
    ("법과대학", "법과대학"), ("법학", "법과대학"),
    ("사회과학", "사회과학대학"),
    ("자연과학", "자연과학대학"), ("자연대", "자연과학대학"),
    ("약학", "약학대학"),
    ("공과대학", "공과대학"), ("공학", "공과대학"), ("엔지니어", "공과대학"),
    ("미술", "미술대학"),
    ("음악", "음악대학"),
    ("경영", "경영대학"),
    ("농업생명", "농업생명과학대학"), ("농생명", "농업생명과학대학"),
    ("생활과학", "생활과학대학"),
    ("보건대학원", "보건대학원"),
    ("환경대학원", "환경대학원"),
    ("행정대학원", "행정대학원"),
    ("국제대학원", "국제대학원"),
    ("수의", "수의과대학"),
    ("의대", "의과대학"), ("의과학", "의과대학"), ("의학", "의과대학"), ("의약", "의과대학"),
    ("치과", "치과대학"), ("치의학", "치의학대학원"),
    ("간호", "간호대학"),
    ("국제관", "국제처"), ("롯데국제", "국제처"), ("우정원", "국제처"),
    ("CJ인터내셔널", "국제처"),
    ("관악사", "기숙사"), ("학생기숙사", "기숙사"), ("글로벌학생생활관", "기숙사"),
    ("대학원 생활관", "기숙사"), ("연건기숙사", "기숙사"), ("대학원기숙사", "기숙사"),
    ("기숙사", "기숙사"),
    ("LG연구동", "데이터사이언스대학원"),
    ("규장각", "규장각한국학연구원"),
    ("천문", "자연과학대학"), ("전파", "자연과학대학"), ("지진", "자연과학대학"),
    ("기상", "자연과학대학"),
    ("멀티미디어강의동", "공용강의동"),
    ("종합교육연구동", "공용강의동"),
    ("기초교육원", "기초교육원"), ("교수학습개발", "기초교육원"),
    ("신양인문학술정보관", "도서관"), ("신양공학학술정보관", "도서관"),
    ("신양사회과학학술정보관", "도서관"), ("신양학술정보관", "도서관"),
    ("도서관", "도서관"), ("학술정보관", "도서관"),
    ("박물관", "박물관·문화관"), ("미술관", "박물관·문화관"),
    ("체육관", "체육"), ("스포츠센터", "체육"),
]

# Range fallback (관악 동번호 기준). 항목: (start, end, college). 정수만 매칭.
RANGES = [
    (1, 3, "인문대학"),
    (5, 8, "인문대학"),
    (9, 13, "사범대학"),
    (14, 14, "인문대학"),
    (15, 15, "법과대학"),
    (16, 16, "사회과학대학"),
    (17, 17, "법과대학"),
    (18, 28, "자연과학대학"),
    (29, 29, "약학대학"),
    (30, 44, "공과대학"),
    (45, 48, "자연과학대학"),  # 천문/지진
    (49, 52, "미술대학"),
    (53, 55, "음악대학"),
    (56, 56, "자연과학대학"),
    (57, 57, "행정대학원"),
    (58, 59, "경영대학"),
    (60, 70, "공용시설"),
    (71, 71, "체육"),
    (72, 72, "법과대학"),  # 법학도서관
    (73, 73, "공용시설"),
    (74, 74, "미술대학"),
    (75, 79, "공용시설"),
    (80, 81, "수의과대학"),
    (82, 82, "환경대학원"),
    (83, 84, "공용강의동"),
    (85, 99, "공용시설"),
    (100, 130, "공용시설"),
    (137, 142, "국제처"),
    (143, 143, "약학대학"),
    (150, 153, "공용시설"),
    (200, 201, "농업생명과학대학"),
    (203, 203, "농업생명과학대학"),
    (220, 220, "공용강의동"),
    (221, 221, "보건대학원"),
    (222, 222, "생활과학대학"),
    (301, 316, "공과대학"),
    (500, 500, "자연과학대학"),
    (900, 939, "기숙사"),
    (940, 945, "연구시설"),
]

# Y접두 (연건)
Y_RULES = {
    "Y1": "의과대학", "Y1-1": "의과대학", "Y5": "공용시설", "Y6": "의과대학",
    "Y8": "의과대학", "Y9": "의과대학",
    "Y12": "간호대학", "Y13": "간호대학", "Y18": "간호대학",
    "Y17": "의과대학", "Y23": "의과대학", "Y32": "의과대학", "Y34": "의과대학",
    "Y20": "치과대학", "Y21": "치의학대학원", "Y22": "치의학대학원",
    "Y25": "기숙사", "Y26": "기숙사",
}


def classify(b: dict) -> str:
    name = b.get("name", "") + " " + " ".join(b.get("aliases", []))
    code = b.get("code", "")

    if b["campus"] == "연건":
        if code in Y_RULES:
            return Y_RULES[code]
        return "공용시설"

    # Name-based first (more specific than range)
    for needle, college in NAME_RULES:
        if needle in name:
            return college

    # Numeric code prefix → range match
    m = re.match(r"^(\d+)", code)
    if m:
        n = int(m.group(1))
        for lo, hi, college in RANGES:
            if lo <= n <= hi:
                return college

    return "기타"


def main():
    buildings = json.loads(DATA.read_text())
    for b in buildings:
        b["college"] = classify(b)
    DATA.write_text(json.dumps(buildings, ensure_ascii=False, indent=2) + "\n")

    # Summary
    from collections import Counter
    c = Counter(b["college"] for b in buildings)
    print(f"Buildings: {len(buildings)}")
    for college, n in sorted(c.items(), key=lambda kv: -kv[1]):
        print(f"  {college:20s} {n}")


if __name__ == "__main__":
    main()
