"""Render the simple vector mark as PNG icons using only the Python standard library."""
import math
import pathlib
import struct
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'public' / 'icons'
PAPER = (244, 241, 234)
OLIVE = (101, 111, 86)

def pixel(x, y):
    # Rotate the film strip by -9 degrees around its center.
    a = math.radians(9)
    xx = (x - 256) * math.cos(a) - (y - 256) * math.sin(a) + 256
    yy = (x - 256) * math.sin(a) + (y - 256) * math.cos(a) + 256
    color = PAPER
    if 166 <= xx <= 346 and 104 <= yy <= 408:
        color = OLIVE
        if 187 <= xx <= 325 and any(top <= yy <= top + 68 for top in (125, 205, 285)):
            color = PAPER
        if (xx - 256) ** 2 + (yy - 380) ** 2 <= 49:
            color = PAPER
    if abs(x - 375) + abs(y - 133) <= 29 and (abs(x - 375) <= 8 or abs(y - 133) <= 8):
        color = OLIVE
    return color

def chunk(name, data):
    return struct.pack('!I', len(data)) + name + data + struct.pack('!I', zlib.crc32(name + data) & 0xffffffff)

def render(size, filename):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            samples = [pixel((x + dx) * 512 / size, (y + dy) * 512 / size) for dx, dy in ((.25,.25),(.75,.25),(.25,.75),(.75,.75))]
            rows.extend(round(sum(sample[c] for sample in samples) / 4) for c in range(3))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b'')
    (ROOT / filename).write_bytes(png)

for size, filename in ((192,'icon-192.png'),(512,'icon-512.png'),(512,'icon-maskable.png'),(180,'apple-touch-icon.png')):
    render(size, filename)
print('Generated four PNG app icons.')
