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
    for top, bottom in ((720, 810), (735, 815), (745, 825)):
        gray = reader.crop_gray(image, (35, top, 655, bottom))
        for variant in (gray, gray.point(lambda p: 255 if p > 150 else 0)):
            raw = reader.read_korean(variant, "6")
            pairs = bench_entries(raw)
            if pairs:
                votes[tuple(sorted(pairs))] += 1
    # Conflicting complete readings are unsafe, even if one has more votes.
    if len(votes) != 1 or next(iter(votes.values()), 0) < 2:
        return None
    pairs = next(iter(votes))
    return [{"votes": {n: votes[pairs]}, "names": [name]} for n, name in pairs]

def main():
    with Image.open(sys.stdin.buffer) as original:
        if original.width * original.height > 25_000_000:
            raise ValueError("Lineup image too large")
        image = ImageOps.exif_transpose(original)
        if abs(image.width / image.height - 691 / 861) > 0.025:
            raise ValueError("Unsupported lineup card aspect ratio")
        bench = read_bench(image)
        if bench is None:
            print(json.dumps({"status": "review_required", "reason": "ambiguous_bench", "candidates": []}))
            return
        layouts = [
            ("reference", reader.STARTERS, reader.STARTER_NAMES),
            ("chihame", reader.CHIHAME[0], reader.CHIHAME[1]),
            ("luviri", reader.LUVIRI[0], reader.LUVIRI[1]),
            ("chilumba", reader.CHILUMBA[0], reader.CHILUMBA[1]),
        ]
        candidates = []
        for label, boxes, names in layouts:
            starters = [reader.read_slot(image, box, name) for box, name in zip(boxes, names, strict=True)]
            candidates.append({"layout": label, "starters": starters, "bench": bench, "captain": None})
        print(json.dumps({"status": "candidates", "candidates": candidates}, ensure_ascii=False))

if __name__ == "__main__":
    main()
