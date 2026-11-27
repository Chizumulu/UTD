import io
import unittest
from PIL import Image, PngImagePlugin
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
spec = spec_from_file_location('optimize_png', Path(__file__).with_name('optimize-player-png.py'))
mod = module_from_spec(spec)
spec.loader.exec_module(mod)

class TestLosslessPng(unittest.TestCase):
    def test_rgba_and_metadata(self):
        img = Image.new('RGBA', (160, 160))
        img.putdata([(x % 256, x // 160, 255, x % 256) for x in range(160*160)])
        meta = PngImagePlugin.PngInfo()
        meta.add_text('Description', 'Keep original metadata')
        out = io.BytesIO()
        img.save(out, format='PNG', compress_level=0, pnginfo=meta, dpi=(96,96))
        original = out.getvalue()
        new = mod.recompress(original)
        self.assertLess(len(new), len(original))
        self.assertEqual([(k,p) for k,p,_ in mod.chunks(original) if k != b'IDAT'],
                         [(k,p) for k,p,_ in mod.chunks(new) if k != b'IDAT'])
        with Image.open(io.BytesIO(new)) as decoded:
            self.assertEqual(decoded.size, img.size)
            self.assertEqual(decoded.mode, img.mode)
            self.assertEqual(decoded.tobytes(), img.tobytes())
        self.assertEqual(mod.recompress(new), new)

    def test_palette_is_unchanged(self):
        img = Image.new('P', (16,16))
        out = io.BytesIO()
        img.save(out, format='PNG', compress_level=0)
        self.assertEqual(mod.recompress(out.getvalue()), out.getvalue())

    def test_animated_png_is_unchanged(self):
        out = io.BytesIO()
        a = Image.new('RGBA', (16,16), 'red')
        b = Image.new('RGBA', (16,16), 'blue')
        a.save(out, format='PNG', save_all=True, append_images=[b], duration=100)
        self.assertEqual(mod.recompress(out.getvalue()), out.getvalue())

    def test_corruption_is_rejected(self):
        out = io.BytesIO()
        Image.new('RGB', (16,16)).save(out, format='PNG')
        broken = bytearray(out.getvalue())
        broken[-1] ^= 1
        with self.assertRaises(ValueError):
            mod.recompress(bytes(broken))

if __name__ == '__main__':
    unittest.main()
