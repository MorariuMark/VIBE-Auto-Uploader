import os
import struct
import zlib
from pathlib import Path

def create_sample_png(filename, width=600, height=600, r=11, g=25, b=46):
    """Generates a valid RGBA PNG image file using raw python struct and zlib."""
    png_header = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr_chunk = struct.pack('!I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('!I', ihdr_crc)

    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)
        for x in range(width):
            rv = (r + x) % 256
            gv = (g + y) % 256
            bv = b % 256
            raw_data.extend([rv, gv, bv, 255])

    compressed_data = zlib.compress(raw_data)
    idat_crc = zlib.crc32(b'IDAT' + compressed_data)
    idat_chunk = struct.pack('!I', len(compressed_data)) + b'IDAT' + compressed_data + struct.pack('!I', idat_crc)

    iend_crc = zlib.crc32(b'IEND')
    iend_chunk = struct.pack('!I', 0) + b'IEND' + struct.pack('!I', iend_crc)

    png_bytes = png_header + ihdr_chunk + idat_chunk + iend_chunk

    out_path = Path(__file__).parent / filename
    with open(out_path, 'wb') as f:
        f.write(png_bytes)
    print(f"Generated sample image: {out_path}")

if __name__ == "__main__":
    create_sample_png("cool_day_dragon_sun.png", 600, 600, 11, 25, 46)
    create_sample_png("matrix panda.png", 400, 400, 16, 185, 129)
    create_sample_png("matrix_panda.png", 400, 400, 16, 185, 129)
    create_sample_png("neon_cyber_samurai.png", 400, 400, 236, 72, 153)
    create_sample_png("cosmic_astronaut.png", 400, 400, 59, 130, 246)
