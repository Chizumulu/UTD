import importlib.util
import tempfile
from pathlib import Path
from PIL import Image
import unittest

spec = importlib.util.spec_from_file_location("crest_generator", Path(__file__).with_name("generate-crest-assets.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CrestTests(unittest.TestCase):
    def test_variants_preserve_original_aspect_and_alpha(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            name = "example.png"
            (root / "data.js").write_text('const teams = [{logoSrc: "example.png"}];', encoding="utf-8")
            image = Image.new("RGBA", (480, 640), (0, 0, 0, 0))
            for x in range(80, 400):
                for y in range(100, 540):
                    image.putpixel((x, y), ((x*y)%256, x%256, y%256, 255))
            image.save(root / name)
            before = (root / name).read_bytes()
            manifest = module.generate(root)
            self.assertEqual(before, (root / name).read_bytes())
            variants = manifest[name]["variants"]
            self.assertEqual([max(v["width"], v["height"]) for v in variants], [64,128,256])
            for v in variants:
                with Image.open(root / v["src"]) as result:
                    self.assertEqual(result.size, (v["width"], v["height"]))
                    self.assertEqual(result.width * 4, result.height * 3)
                    self.assertEqual(result.convert("RGBA").getpixel((0,0))[3], 0)
                    self.assertLess(v["bytes"], len(before))

if __name__ == "__main__":
    unittest.main()
