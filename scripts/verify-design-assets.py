"""Compare #148 and candidate builds. Only known PNG IDAT changes and
the public commit receipt are permitted in this lossless-only batch."""
import io
import json
import pathlib
import sys
from PIL import Image
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('png', pathlib.Path(__file__).with_name('optimize-player-png.py'))
png = module_from_spec(spec)
spec.loader.exec_module(png)
a,b = map(pathlib.Path,sys.argv[1:])
def files(root):
    return {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
assert files(a) == files(b), 'Deployment inventory changed'
changed = []
for name in sorted(files(a)):
    old,new = (a/name).read_bytes(),(b/name).read_bytes()
    if old == new:
        continue
    if name == 'publication.json':
        x,y = json.loads(old),json.loads(new)
        x.pop('commit',None)
        y.pop('commit',None)
        assert x == y, 'Publication contract changed'
    else:
        assert name in png.TARGETS, 'Unexpected asset change: '+name
        assert len(new) < len(old), 'PNG did not shrink: '+name
        assert [(k,p) for k,p,_ in png.chunks(old) if k != b'IDAT'] == [(k,p) for k,p,_ in png.chunks(new) if k != b'IDAT'], name
        with Image.open(io.BytesIO(old)) as x, Image.open(io.BytesIO(new)) as y:
            assert (x.size,x.mode,x.tobytes()) == (y.size,y.mode,y.tobytes()), name
        changed.append({'file':name,'before':len(old),'after':len(new),'saved':len(old)-len(new)})
print('Design asset parity: '+json.dumps({'files':len(files(a)), 'pixelIdenticalChanges':changed}))
