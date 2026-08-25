#!/usr/bin/env python3
"""从 star-tracker 提取 RealizE 的公共记录，生成网站的公共数据 JSON。

生成（覆盖）：
  data/shows.json   演出记录（公共）
  data/events.json  大事纪（公共）

隔离原则：采用字段白名单——只复制下面明确列出的公共字段，
star-tracker 数据里的任何其他字段（チェキ、个人备注等现在有的、
将来加的）都不会被带出来。初见/初切所在的 me.json 根本不读。

id 原样保留自 star-tracker，作为公共记录的稳定标识，
供 star-tracker 的「同步公共记录」按 id 去重/合并。

用法：python3 tools/import.py
"""
import json
from pathlib import Path

GROUP = "RealizE"
ROOT = Path(__file__).resolve().parent.parent
TRACKER_DATA = ROOT.parent / "star-tracker" / "data"

# 公共字段白名单：(star-tracker 字段名, 公开字段名, 默认值)
SHOW_FIELDS = [
    ("id", "id", None),
    ("date", "date", ""),
    ("time", "time", ""),
    ("note", "note", ""),
    ("special", "special", False),
    ("absentMembers", "absent", []),
]
EVENT_FIELDS = [
    ("id", "id", None),
    ("date", "date", ""),
    ("title", "title", ""),
    ("note", "note", ""),
    ("who", "who", []),
]


def load(name):
    with open(TRACKER_DATA / name, encoding="utf-8") as f:
        return json.load(f)


def pick(item, fields):
    return {out: item.get(src, default) for src, out, default in fields}


def write(name, items):
    out = ROOT / "data" / name
    out.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    return out.relative_to(ROOT)


def main():
    shows = sorted(
        (pick(s, SHOW_FIELDS) for s in load("shows.json") if s.get("group") == GROUP),
        key=lambda s: (s["date"], s["id"]),
    )
    events = sorted(
        (pick(e, EVENT_FIELDS) for e in load("events.json") if e.get("group") == GROUP),
        key=lambda e: (e["date"], e["id"]),
    )
    print(f"✓ {write('shows.json', shows)}（{len(shows)} 场演出）")
    print(f"✓ {write('events.json', events)}（{len(events)} 条大事纪）")


if __name__ == "__main__":
    main()
