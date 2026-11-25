"""Locate lineup text using OCR geometry, independent of match and formation."""

import csv
import io
import json
import re
import subprocess
import sys

# The trial compares recognized text with the club's roster in the caller.
from collections import defaultdict

from PIL import Image, ImageOps


def ocr(image, mode, language):
    payload = io.BytesIO()
    image.save(payload, format="PNG")
    raw = subprocess.run(
        ["tesseract", "stdin", "stdout", "-l", language, "--psm", str(mode), "tsv"],
        input=payload.getvalue(), capture_output=True, check=True, timeout=35,
    ).stdout.decode()
    return [word for word in csv.DictReader(io.StringIO(raw), delimiter="\t")
            if word.get("text", "").strip()]


def box(word):
    return tuple(int(word[key]) for key in ("left", "top", "width", "height"))


def group_lines(words):
    rows = defaultdict(list)
    for word in words:
        rows[tuple(word[key] for key in ("block_num", "par_num", "line_num"))].append(word)
    return [sorted(row, key=lambda word: box(word)[0]) for row in rows.values()]


def text_of(words):
    return " ".join(word["text"] for word in words)


def main():
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(sys.stdin.buffer.read())))
    gray = ImageOps.grayscale(image)
    gray = gray.resize((1400, round(gray.height * 1400 / gray.width)), Image.Resampling.LANCZOS)
    passes = []
    markers = []
    for threshold in (145, 175, 200):
        binary = gray.point(lambda value: 0 if value > threshold else 255)
        for language in ("kor+eng", "eng"):
            words = ocr(binary, 11, language)
            markers.extend(box(word) for word in words
                           if re.sub(r"[^A-Z]", "", word["text"].upper()) == "SUBS"
                           and box(word)[1] > gray.height / 2)
            if language == "kor+eng":
                passes.append((binary, words))
    if not markers:
        raise ValueError("No SUBS marker detected")
    marker = sorted(markers, key=lambda item: item[1])[len(markers) // 2]
    _, bench_top, _, height = marker
    names = []
    bench_runs = []
    for binary, words in passes:
        for row in group_lines(words):
            top = min(box(word)[1] for word in row)
            if top >= bench_top - height // 2:
                continue
            clusters = [[]]
            for word in row:
                if clusters[-1]:
                    x, _, width, _ = box(clusters[-1][-1])
                    if box(word)[0] - x - width > max(25, height * 2):
                        clusters.append([])
                clusters[-1].append(word)
            for cluster in clusters:
                line = text_of(cluster)
                if len(re.findall(r"[가-힣]", line)) >= 4:
                    names.append(line)
        strip = binary.crop((0, max(0, bench_top - height // 2), gray.width,
                             min(gray.height, bench_top + height * 4)))
        for language in ("kor+eng", "kor"):
            text = "\n".join(text_of(row) for row in group_lines(ocr(strip, 6, language)))
            bench_runs.append(text)
    print(json.dumps({"starterText": list(dict.fromkeys(names)),
                      "benchText": list(dict.fromkeys(bench_runs))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
