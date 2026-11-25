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


def crop_gray(image, box):
    scaled = [round(value * size / ref) for value, size, ref in zip(
        box, (image.width, image.height) * 2, (691, 861) * 2
    )]
    crop = image.crop(scaled)
    gray = ImageOps.autocontrast(ImageOps.grayscale(crop))
    gray = gray.resize((gray.width * 6, gray.height * 6), Image.Resampling.LANCZOS)
    return gray


def read_slot(image, box, name_box):
    gray = crop_gray(image, box)
    # Include a slightly wider crop to recover digits clipped at either edge.
    left, top, right, bottom = box
    wider = crop_gray(image, (left - 3, top - 2, right + 3, bottom + 2))
    variants = [
        gray, gray.point(lambda pixel: 255 if pixel > 160 else 0),
        wider.point(lambda pixel: 255 if pixel > 200 else 0),
    ]
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
    name_image = crop_gray(image, name_box)
    names = []
    for variant in (name_image, name_image.point(lambda pixel: 255 if pixel > 145 else 0)):
        payload = io.BytesIO()
        ImageOps.expand(ImageOps.invert(variant), border=20, fill=255).save(payload, format="PNG")
        result = subprocess.run(
            ["tesseract", "stdin", "stdout", "-l", "kor", "--psm", "7"],
            input=payload.getvalue(), capture_output=True, check=True, timeout=8,
        ).stdout.decode().strip()
        if result and result not in names:
            names.append(result)
    return {"votes": dict(votes), "names": names}


def main():
    with Image.open(sys.stdin.buffer) as original:
        image = ImageOps.exif_transpose(original)
        if abs(image.width / image.height - 691 / 861) > 0.025:
            raise ValueError("Unexpected aspect ratio for the Raiply reference card")
        starter_boxes, starter_names, bench_boxes, bench_names = (
            CHIHAME if sys.argv[1:] == ["chihame"] else (STARTERS, STARTER_NAMES, BENCH, BENCH_NAMES)
        )
        starters = [read_slot(image, box, name) for box, name in zip(starter_boxes, starter_names, strict=True)]
        bench = [read_slot(image, box, name) for box, name in zip(bench_boxes, bench_names, strict=True)]
    # The reference graphic has no explicit captain mark.
    print(json.dumps({"starters": starters, "bench": bench, "captain": None}))


if __name__ == "__main__":
    main()
