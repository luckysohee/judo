#!/usr/bin/env python3
"""주도 브랜드 SVG(세 가로 막대)를 PNG로 굽는다. 외부 라이브러리 없음."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BG = (0x0E, 0x0E, 0x0E)
FG = (0xF5, 0xF5, 0xF5)
# public/icon.svg viewBox 512 기준 (모서리는 앱이 마스크하므로 아이콘 PNG는 사각형)
BARS = (
    (128, 148, 256, 44),
    (128, 258, 176, 44),
    (128, 368, 256, 44),
)


def write_png(path: Path, width: int, height: int, rgb: bytearray) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    rows = bytearray()
    stride = width * 3
    for y in range(height):
        rows.append(0)
        rows.extend(rgb[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(rows), 9)))
        f.write(chunk(b"IEND", b""))


def fill_rect(
    buf: bytearray, w: int, x: int, y: int, rw: int, rh: int, color: tuple[int, int, int]
) -> None:
    r, g, b = color
    x0 = max(0, x)
    y0 = max(0, y)
    x1 = min(w, x + rw)
    y1 = min(len(buf) // (w * 3), y + rh)
    for yy in range(y0, y1):
        row = yy * w * 3
        for xx in range(x0, x1):
            i = row + xx * 3
            buf[i] = r
            buf[i + 1] = g
            buf[i + 2] = b


def paint_logo(buf: bytearray, size: int, pad_ratio: float = 0.0) -> None:
    inner = int(round(size * (1 - pad_ratio)))
    ox = (size - inner) // 2
    oy = ox
    scale = inner / 512
    fill_rect(buf, size, 0, 0, size, size, BG)
    for x, y, bw, bh in BARS:
        fill_rect(
            buf,
            size,
            ox + int(round(x * scale)),
            oy + int(round(y * scale)),
            max(1, int(round(bw * scale))),
            max(1, int(round(bh * scale))),
            FG,
        )


def make_square(size: int) -> bytearray:
    buf = bytearray(size * size * 3)
    paint_logo(buf, size)
    return buf


def make_splash(size: int = 2732) -> bytearray:
    buf = bytearray(size * size * 3)
    fill_rect(buf, size, 0, 0, size, size, BG)
    logo = 720
    ox = (size - logo) // 2
    tmp = make_square(logo)
    for y in range(logo):
        src = y * logo * 3
        dst = ((ox + y) * size + ox) * 3
        buf[dst : dst + logo * 3] = tmp[src : src + logo * 3]
    return buf


def main() -> None:
    icon_1024 = make_square(1024)
    write_png(
        ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
        1024,
        1024,
        icon_1024,
    )
    splash = make_splash(2732)
    splash_dir = ROOT / "ios/App/App/Assets.xcassets/Splash.imageset"
    for name in (
        "splash-2732x2732.png",
        "splash-2732x2732-1.png",
        "splash-2732x2732-2.png",
    ):
        write_png(splash_dir / name, 2732, 2732, splash)

    public = ROOT / "public"
    write_png(public / "apple-touch-icon.png", 180, 180, make_square(180))
    write_png(public / "icon-192.png", 192, 192, make_square(192))
    write_png(public / "icon-512.png", 512, 512, make_square(512))

    # Android 레거시 mipmap (adaptive 외 구버전)
    for folder, size in (
        ("mipmap-mdpi", 48),
        ("mipmap-hdpi", 72),
        ("mipmap-xhdpi", 96),
        ("mipmap-xxhdpi", 144),
        ("mipmap-xxxhdpi", 192),
    ):
        png = make_square(size)
        d = ROOT / "android/app/src/main/res" / folder
        write_png(d / "ic_launcher.png", size, size, png)
        write_png(d / "ic_launcher_round.png", size, size, png)
        write_png(d / "ic_launcher_foreground.png", size, size, png)

    print("brand pngs written")


if __name__ == "__main__":
    main()
