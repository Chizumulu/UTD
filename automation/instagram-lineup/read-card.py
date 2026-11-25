"""Read jersey-number regions from the 2026-11-22 Raiply graphic."""

import io
import json
import re
import subprocess
import sys
from collections import Counter

from PIL import Image, ImageOps


# Coordinates are relative to the 691 × 861 reference image without Instagram UI.
STARTERS = [
    (299, 154, 326, 182),
    (82, 260, 104, 288), (301, 316, 325, 343), (524, 260, 548, 288),
    (191, 390, 216, 417), (402, 389, 425, 417),
    (64, 507, 86, 534), (192, 548, 214, 576),
    (406, 548, 430, 576), (532, 507, 559, 535),
    (299, 643, 325, 670),
]
BENCH = [
    (159, 766, 178, 786), (237, 766, 258, 786),
    (347, 766, 368, 786), (458, 766, 482, 786),
    (189, 785, 214, 803), (298, 785, 322, 803),
    (405, 785, 430, 803),
]


STARTER_NAMES = [
    (297, 250, 395, 269), (85, 356, 164, 375), (294, 411, 396, 431),
    (523, 356, 618, 375), (192, 486, 283, 505), (406, 486, 500, 505),
    (68, 603, 146, 623), (195, 643, 285, 663), (405, 643, 499, 663),
    (539, 603, 614, 623), (288, 735, 407, 755),
]
BENCH_NAMES = [
    (178, 767, 232, 785), (256, 767, 340, 785), (365, 767, 457, 785),
    (480, 767, 550, 785), (213, 785, 291, 803), (321, 785, 400, 803),
    (430, 785, 521, 803),
]


# Convert the second card's measured regions to the shared reference grid.
def chihame_boxes(boxes):
    return [tuple(round(value * scale) for value, scale in
                  zip(box, (691 / 661, 861 / 818) * 2)) for box in boxes]


CHIHAME = (
    chihame_boxes([
        (278, 140, 298, 160), (54, 246, 75, 266), (279, 304, 299, 325),
        (503, 245, 523, 266), (168, 376, 189, 397), (387, 376, 408, 397),
        (38, 494, 60, 516), (172, 533, 192, 553), (385, 534, 404, 555),
        (509, 494, 531, 516), (277, 627, 298, 647),
    ]),
    chihame_boxes([
        (280, 233, 364, 252), (57, 338, 140, 358), (282, 397, 363, 417),
        (501, 338, 587, 358), (180, 468, 250, 487), (395, 468, 461, 487),
        (40, 585, 124, 605), (182, 625, 254, 646), (397, 625, 469, 646),
        (514, 585, 590, 605), (269, 718, 373, 739),
    ]),
    chihame_boxes([
        (129, 749, 149, 768), (228, 749, 247, 768), (339, 749, 359, 768),
        (450, 749, 474, 768), (165, 766, 189, 784), (272, 766, 296, 784),
        (382, 766, 406, 784),
    ]),
    chihame_boxes([
        (148, 749, 224, 768), (247, 749, 332, 768), (359, 749, 445, 768),
        (474, 749, 533, 768), (188, 766, 270, 784), (296, 766, 378, 784),
        (406, 766, 494, 784),
    ]),
)


LUVIRI = (
    [(302, 159, 324, 183), (83, 266, 103, 290), (305, 325, 325, 348),
     (526, 266, 546, 290), (195, 395, 218, 419), (411, 394, 433, 419),
     (62, 515, 85, 539), (195, 553, 219, 578), (411, 555, 430, 579),
     (532, 512, 554, 537), (301, 648, 324, 672)],
    [(303, 252, 395, 275), (96, 360, 156, 381), (305, 418, 388, 442),
     (527, 359, 610, 381), (203, 490, 277, 511), (420, 490, 481, 511),
     (64, 605, 147, 628), (204, 646, 276, 669), (424, 647, 487, 669),
     (540, 604, 614, 627), (290, 737, 408, 761)],
    [(158, 772, 177, 791), (259, 772, 278, 791), (337, 772, 356, 791),
     (447, 772, 467, 791), (151, 788, 176, 806), (239, 788, 265, 806),
     (348, 788, 373, 806), (465, 788, 491, 806)],
    [(177, 772, 253, 791), (278, 772, 333, 791), (356, 772, 443, 791),
     (467, 772, 551, 791), (179, 788, 232, 806), (265, 788, 343, 806),
     (373, 788, 460, 806), (491, 788, 559, 806)],
)


CHINTHECHE = (
    LUVIRI[0],
    LUVIRI[1],
    [(169, 771, 185, 790), (246, 771, 263, 790), (357, 771, 374, 790),
     (468, 771, 490, 790), (199, 788, 221, 806), (296, 788, 318, 806),
     (404, 788, 430, 806)],
    [(185, 771, 242, 790), (263, 771, 351, 790), (374, 771, 465, 790),
     (490, 771, 550, 790), (222, 788, 291, 806), (319, 788, 400, 806),
     (430, 788, 523, 806)],
)


def crop_gray(image, box):
    scaled = [round(value * size / ref) for value, size, ref in zip(
        box, (image.width, image.height) * 2, (691, 861) * 2
    )]
    crop = image.crop(scaled)
    gray = ImageOps.autocontrast(ImageOps.grayscale(crop))
    gray = gray.resize((gray.width * 6, gray.height * 6), Image.Resampling.LANCZOS)
    return gray


def shift_up(box, pixels):
    left, top, right, bottom = box
    return left, top - pixels, right, bottom - pixels


def read_korean(gray, mode, languages="kor+eng"):
    payload = io.BytesIO()
    ImageOps.expand(ImageOps.invert(gray), border=20, fill=255).save(payload, format="PNG")
    return subprocess.run(
        ["tesseract", "stdin", "stdout", "-l", languages, "--psm", mode],
        input=payload.getvalue(), capture_output=True, check=True, timeout=12,
    ).stdout.decode().strip()


def read_slot(image, box, name_box, alternate=False):
    gray = crop_gray(image, box)
    # Include a slightly wider crop to recover digits clipped at either edge.
    left, top, right, bottom = box
    wider = crop_gray(image, (left - 3, top - 2, right + 3, bottom + 2))
    variants = [
        gray, gray.point(lambda pixel: 255 if pixel > 160 else 0),
        wider.point(lambda pixel: 255 if pixel > 200 else 0),
    ]
    if alternate:
        for offset in (12, 22):
            variants.append(crop_gray(image, shift_up(box, offset)))
    votes = Counter()
    for variant in variants:
        prepared = ImageOps.expand(ImageOps.invert(variant), border=20, fill=255)
        payload = io.BytesIO()
        prepared.save(payload, format="PNG")
        for mode in ("7", "8", "13"):
            result = subprocess.run(
                ["tesseract", "stdin", "stdout", "--psm", mode,
                 "-c", "tessedit_char_whitelist=0123456789"],
                input=payload.getvalue(), capture_output=True, check=True, timeout=8,
            ).stdout.decode().strip()
            if re.fullmatch(r"[1-9][0-9]?", result):
                votes[int(result)] += 1
    names = []
    name_regions = [name_box]
    if alternate:
        x1, y1, x2, y2 = name_box
        name_regions += [shift_up((x1 - 8, y1, x2 + 8, y2), offset) for offset in (7, 16, 23, 30)]
        name_regions.append((x1 - 12, y1 - 4, x2 + 14, y2 + 3))
    for region in name_regions:
        name_image = crop_gray(image, region)
        for variant in (name_image, name_image.point(lambda pixel: 255 if pixel > 145 else 0)):
            for languages in (("kor+eng", "kor") if alternate else ("kor",)):
                result = read_korean(variant, "7", languages)
                if result and result not in names:
                    names.append(result)
    return {"votes": dict(votes), "names": names}


def read_chihame_bench(image, boxes, names):
    # The Instagram export places the two lines higher than the supplied preview.
    strip = crop_gray(image, chihame_boxes([(70, 727, 550, 771)])[0])
    candidates = [read_korean(variant, "6") for variant in
                  (strip, strip.point(lambda pixel: 255 if pixel > 150 else 0))]
    print("Bench strip OCR: " + json.dumps(candidates, ensure_ascii=False), file=sys.stderr)
    for candidate in candidates:
        entries = re.findall(r"(?<![0-9])([1-9][0-9]?)\s*[.,:]\s*([가-힣]+(?:\s+[가-힣]+)*)", candidate)
        if len(entries) == len(boxes) and len({number for number, _ in entries}) == len(boxes):
            return [{"votes": {int(number): 2}, "names": [name]} for number, name in entries]
    return [read_slot(image, shift_up(box, 17), shift_up(name, 17))
            for box, name in zip(boxes, names, strict=True)]


def main():
    with Image.open(sys.stdin.buffer) as original:
        image = ImageOps.exif_transpose(original)
        if abs(image.width / image.height - 691 / 861) > 0.025:
            raise ValueError("Unexpected aspect ratio for the Raiply reference card")
        sample = sys.argv[1] if len(sys.argv) > 1 else "raiply"
        starter_boxes, starter_names, bench_boxes, bench_names = (
            CHINTHECHE if sample == "chintheche" else LUVIRI if sample == "luviri" else CHIHAME if sample == "chihame" else (STARTERS, STARTER_NAMES, BENCH, BENCH_NAMES)
        )
        chihame = sys.argv[1:] == ["chihame"]
        starters = [read_slot(image, box, name, alternate=sample != "raiply")
                    for box, name in zip(starter_boxes, starter_names, strict=True)]
        bench = (read_chihame_bench(image, bench_boxes, bench_names) if chihame else
                 [read_slot(image, box, name) for box, name in zip(bench_boxes, bench_names, strict=True)])
        if sample in ("luviri", "chintheche"):
            for offset in (0, 15, 25):
                strip = crop_gray(image, shift_up((105, 768, 564, 807), offset))
                raw = read_korean(strip, "6")
                print("Bench strip OCR: " + json.dumps(raw, ensure_ascii=False), file=sys.stderr)
                for line in raw.splitlines():
                    if not re.search(r"SUBS", line, re.I):
                        continue
                    entries = re.findall(r"(?<![0-9])([1-9][0-9]?)\s*[.,:]\s*([가-힣]+(?:\s+[가-힣]+)*)", line)
                    if len(entries) == 4 and len({number for number, _ in entries}) == 4:
                        bench[:4] = [{"votes": {int(number): 2}, "names": [name]} for number, name in entries]
                        break
                else:
                    continue
                break
    # The reference graphic has no explicit captain mark.
    print(json.dumps({"starters": starters, "bench": bench, "captain": None}))


if __name__ == "__main__":
    main()
