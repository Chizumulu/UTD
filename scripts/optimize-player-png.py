"""Recompress only diagnosed static RGB/RGBA PNGs in Pages output.
Preserve original IHDR, every non-IDAT chunk and decoded pixel bytes.
No resize, quantization, metadata removal, URL changes or source edits.
"""
import io
import json
import pathlib
import struct
import sys
import zlib
from PIL import Image

SIGNATURE = b'\x89PNG\r\n\x1a\n'
TARGETS = ('no22.png', 'no98.png')
ALLOWED = {b'IHDR', b'IDAT', b'IEND', b'sRGB', b'gAMA', b'cHRM',
           b'iCCP', b'pHYs', b'tEXt', b'zTXt', b'iTXt', b'tIME',
           b'bKGD', b'sBIT', b'tRNS', b'eXIf', b'PLTE'}

def chunks(data):
    if not data.startswith(SIGNATURE):
        raise ValueError('Not PNG')
    items = []
    pos = 8
    while pos < len(data):
        if pos + 12 > len(data):
            raise ValueError('Truncated PNG chunk')
        size = struct.unpack_from('>I', data, pos)[0]
        end = pos + 12 + size
        if end > len(data):
            raise ValueError('Truncated PNG payload')
        kind = data[pos+4:pos+8]
        payload = data[pos+8:end-4]
        crc = struct.unpack_from('>I', data, end-4)[0]
        if zlib.crc32(kind + payload) != crc:
            raise ValueError('PNG CRC mismatch')
        items.append((kind, payload, data[pos:end]))
        pos = end
    if not items or items[0][0] != b'IHDR' or items[-1][0] != b'IEND':
        raise ValueError('Invalid PNG boundaries')
    return items

def recompress(data):
    original = chunks(data)
    if any(k not in ALLOWED for k, _, _ in original):
        return data
    hdr = original[0][1]
    width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', hdr)
    if depth != 8 or color not in (2, 6) or compression or filtering or interlace:
        return data
    ids = [i for i,(k,_,_) in enumerate(original) if k == b'IDAT']
    if not ids or ids != list(range(ids[0], ids[-1]+1)):
        return data
    with Image.open(io.BytesIO(data)) as img:
        img.load()
        if img.n_frames != 1 or img.mode not in ('RGB', 'RGBA'):
            return data
        pixels = img.tobytes()
        encoded = io.BytesIO()
        img.save(encoded, format='PNG', optimize=True)
    new = chunks(encoded.getvalue())
    if new[0][1] != hdr:
        return data
    # Keep original chunks byte-for-byte; only replace the consecutive IDAT run.
    candidate = (SIGNATURE + b''.join(raw for _,_,raw in original[:ids[0]])
                 + b''.join(raw for k,_,raw in new if k == b'IDAT')
                 + b''.join(raw for _,_,raw in original[ids[-1]+1:]))
    if len(candidate) >= len(data):
        return data
    verified = chunks(candidate)
    if [(k,p) for k,p,_ in verified if k != b'IDAT'] != [(k,p) for k,p,_ in original if k != b'IDAT']:
        raise ValueError('PNG metadata changed')
    with Image.open(io.BytesIO(candidate)) as img:
        img.load()
        if img.size != (width,height) or img.tobytes() != pixels:
            raise ValueError('PNG pixels changed')
    return candidate

def optimize(output):
    results = []
    for name in TARGETS:
        path = pathlib.Path(output) / name
        if not path.is_file():
            results.append({'file':name,'status':'missing'})
            continue
        before = path.read_bytes()
        after = recompress(before)
        if len(after) < len(before):
            path.write_bytes(after)
        results.append({'file':name,'before':len(before),'after':len(after),
                        'saved':len(before)-len(after),'pixelAndMetadataPreserved':True})
    print('Lossless player PNG optimization (bytes): '+json.dumps(results))

if __name__ == '__main__':
    optimize(sys.argv[1])
