"""Generate deployment-only responsive crest assets; never overwrite originals."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from PIL import Image, ImageOps

SIZES = (64, 128, 256)

def generate(root):
    root = Path(root)
    source = (root / "data.js").read_text(encoding="utf-8")
    names = set(re.findall(r"""\blogoSrc\s*:\s*["']([^"']+)["']""", source))
    names.update(("fa-cup-logo.png", "ddds.webp"))
    manifest = {}
    for name in sorted(names):
        if Path(name).name != name or Path(name).suffix.lower() not in (".png", ".webp", ".jpg", ".jpeg"):
            continue
        original = root / name
        if not original.is_file():
            print(f"Skipping unavailable crest: {name}")
            continue
        digest = hashlib.sha256(original.read_bytes()).hexdigest()[:16]
        variants = []
        with Image.open(original) as opened:
            if getattr(opened, "is_animated", False):
                continue
            image = ImageOps.exif_transpose(opened).convert("RGBA")
            for size in SIZES:
                if max(image.size) <= size:
                    continue
                resized = image.copy()
                resized.thumbnail((size, size), Image.Resampling.LANCZOS)
                rel = f"crest-assets/{digest}-{size}.webp"
                target = root / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                resized.save(target, "WEBP", quality=88, method=6, alpha_quality=100)
                if target.stat().st_size >= original.stat().st_size:
                    target.unlink(missing_ok=True)
                    continue
                variants.append({"src": rel, "width": resized.width, "height": resized.height, "bytes": target.stat().st_size})
            if variants:
                manifest[name] = {"width": image.width, "height": image.height, "bytes": original.stat().st_size, "variants": variants}
    (root / "crest-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True), encoding="utf-8")
    print(f"Generated responsive assets for {len(manifest)} crests")
    return manifest

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output")
    generate(parser.parse_args().output)
