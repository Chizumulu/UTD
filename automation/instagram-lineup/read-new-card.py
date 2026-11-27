"""Conservative candidate reader for new lineup cards; historical reader unchanged.

Reads multiple known starter layouts and discovers bench entries from a text strip.
It does not assume a bench count or infer a captain. Downstream roster validation
must reject ambiguous candidates; this is not a general formation detector.
"""
import importlib.util
import json
import re
import sys
from pathlib import Path
from collections import Counter
from PIL import Image, ImageOps

spec = importlib.util.spec_from_file_location("historical_reader", Path(__file__).with_name("read-card.py"))
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

def bench_entries(raw):
    lines = raw.splitlines()
    header = next((i for i, line in enumerate(lines) if re.search(r"\bSUBS\b", line, re.I)), None)
    if header is None:
        return None
    body = " ".join(lines[header:])
    body = re.sub(r"^.*?\bSUBS\b\s*[:.\-]?", "", body, flags=re.I)
    pattern = r"(?<![0-9])([1-9][0-9]?)\s*[.,:]\s*([가-힣]+(?:\s+[가-힣]+)*)"
    entries = list(re.finditer(pattern, body))
    if not entries:
        return None
    # Reject unexplained text rather than silently dropping an unread player.
    remainder = re.sub(pattern, "", body)
    if re.sub(r"[\s|,;:./\-]+", "", remainder):
        return None
    pairs = tuple((int(m.group(1)), re.sub(r"\s+", "", m.group(2))) for m in entries)
    if len(pairs) > 12 or len({n for n, _ in pairs}) != len(pairs):
        return None
    return pairs

def read_bench(image):
    votes = Counter()
    # Reuse the narrower strips that were successful on the historical
    # designs, alongside wider crops. Keep both rows in every candidate.
    regions = [(35, 720, 655, 810), (35, 735, 655, 815),
               (35, 745, 655, 825), (105, 768, 564, 807),
               (105, 753, 564, 792), (105, 743, 564, 782),
               reader.chihame_boxes([(70, 727, 550, 771)])[0]]
    chilumba_region = reader.chilumba_boxes([(52, 751, 631, 793)])[0]
    regions.extend(reader.shift_up(chilumba_region, offset) for offset in (0, 15, 25))
    for region in regions:
        gray = reader.crop_gray(image, region)
        for variant in (gray, gray.point(lambda p: 255 if p > 150 else 0)):
            raw = reader.read_korean(variant, "6")
            pairs = bench_entries(raw)
            print(json.dumps({"bench_region": region, "raw": raw, "parsed": pairs}, ensure_ascii=False), file=sys.stderr)
            if pairs:
                votes[tuple(sorted(pairs))] += 1
    # Conflicting complete readings are unsafe, even if one has more votes.
    # A shorter reading may simply be a clipped crop. Never accept it
    # in preference to a longer complete reading. Reject competing sets
    # that are not strict subsets of the unique maximal reading.
    maximal = [pairs for pairs in votes if not any(set(pairs) < set(other) for other in votes)]
    if len(maximal) != 1 or votes[maximal[0]] < 2:
        return None
    pairs = maximal[0]
    return [{"votes": {n: votes[pairs]}, "names": [name]} for n, name in pairs]

def improve_slot(image, box, name_box, slot, alternate=False):
    # Re-read independently using wider number crops, not roster-derived digits.
    x1, y1, x2, y2 = box
    extra = reader.read_slot(image, (x1-4, y1-5, x2+5, y2+5),
                             (name_box[0]-3, name_box[1]-2, name_box[2]+3, name_box[3]+2),
                             alternate=alternate)
    for n, count in extra["votes"].items():
        slot["votes"][n] = slot["votes"].get(n, 0) + count
    slot["names"] = list(dict.fromkeys(slot["names"] + extra["names"]))
    return slot

def main():
    with Image.open(sys.stdin.buffer) as original:
        if original.width * original.height > 25_000_000:
            raise ValueError("Lineup image too large")
        image = ImageOps.exif_transpose(original)
        if abs(image.width / image.height - 691 / 861) > 0.025:
            raise ValueError("Unsupported lineup card aspect ratio")
        layouts = [
            ("reference", (reader.STARTERS, reader.STARTER_NAMES, reader.BENCH, reader.BENCH_NAMES)),
            ("chihame", reader.CHIHAME),
            ("luviri", reader.LUVIRI),
            ("chintheche", reader.CHINTHECHE),
            ("chilumba", reader.CHILUMBA),
        ]
        candidates = []
        for label, (boxes, names, bench_boxes, bench_names) in layouts:
            # Fixed regions are layout hypotheses, not match-specific answers.
            # Each candidate is independently checked against the roster.
            bench = (reader.read_chihame_bench(image, bench_boxes, bench_names)
                     if label == "chihame" else
                     reader.read_chilumba_bench(image, bench_boxes, bench_names)
                     if label == "chilumba" else
                     [reader.read_slot(image, box, name) for box, name in zip(bench_boxes, bench_names, strict=True)])
            # Reuse full strip readings as additional evidence, not replacements.
            if label in ("luviri", "chintheche"):
                for offset in (0, 15, 25):
                    raw = reader.read_korean(reader.crop_gray(image, reader.shift_up((105, 768, 564, 807), offset)), "6")
                    for line in raw.splitlines():
                        if not re.search(r"SUBS", line, re.I):
                            continue
                        entries = re.findall(r"(?<![0-9])([1-9][0-9]?)\s*[.,:]\s*([가-힣]+(?:\s+[가-힣]+)*)", line)
                        if len(entries) == 4 and len({n for n, _ in entries}) == 4:
                            for slot, (n, name) in zip(bench[:4], entries, strict=True):
                                slot["votes"][int(n)] = slot["votes"].get(int(n), 0) + 1
                                slot["names"].append(name)
            # Skip implausible bench geometry before spending time on starters.
            print(json.dumps({"layout": label, "bench": bench}, ensure_ascii=False), file=sys.stderr)
            if sum(bool(slot["votes"] and slot["names"]) for slot in bench) < len(bench)-2:
                continue
            starters = [reader.read_slot(image, box, name, alternate=(label != "reference"))
                        for box, name in zip(boxes, names, strict=True)]
            # Re-read every weakly sampled slot; names and numbers remain separate.
            for slot, box, name in zip(starters, boxes, names, strict=True):
                if max(slot["votes"].values(), default=0) < 5 or len(slot["names"]) < 2:
                    improve_slot(image, box, name, slot)
            for slot, box, name in zip(bench, bench_boxes, bench_names, strict=True):
                if label == "chihame":
                    box, name = reader.shift_up(box, 17), reader.shift_up(name, 17)
                if max(slot["votes"].values(), default=0) < 5 or len(slot["names"]) < 2:
                    improve_slot(image, box, name, slot)
            candidates.append({"layout": label, "starters": starters, "bench": bench, "captain": None})
        print(json.dumps({"status": "candidates", "candidates": candidates}, ensure_ascii=False))

if __name__ == "__main__":
    main()
