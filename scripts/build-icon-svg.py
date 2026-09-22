"""Trace icon-transparent.png → icon.svg (ghizou build-brand-svgs pipeline)."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICON_PNG = ROOT / "public/brand/icon-transparent.png"
ICON_SVG = ROOT / "public/brand/icon.svg"
FAVICON_SVG = ROOT / "public/brand/favicon.svg"
TRIMMED = ROOT / "public/brand/.icon-trimmed.png"
TRACED = ROOT / "public/brand/.icon-traced.svg"

INK = "#102860"
MOSS = "#209070"
MINT = "#88d6a8"
FOREST = "#006e51"
WHITE = "#ffffff"
PLATE = "#faf8f3"


def hex_to_rgb(fill: str) -> tuple[int, int, int] | None:
    if not fill.startswith("#"):
        return None
    value = fill[1:]
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        return None
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def classify_fill(fill: str) -> str | None:
    rgb = hex_to_rgb(fill)
    if not rgb:
        return None
    r, g, b = rgb

    # white / near-white
    if min(r, g, b) > 200:
        return WHITE

    # cyan/teal/green family from poster quantize
    if g >= 80 and g >= r and (g > b - 10 or b > 80):
        # mint: light
        if g > 160 and r > 80:
            return MINT
        # forest: dark green, low blue relative
        if g < 140 and b < 100 and r < 60:
            return FOREST
        # moss / mid teal
        if g > 90:
            return MOSS
        return FOREST

    # navy / blue body (incl. poster blues like #00007F)
    if b >= 60 and b >= g and b >= r:
        return INK
    if r < 40 and g < 40 and b < 40:
        return None  # pure black noise
    return None


def is_canvas_background(d: str, width: int, height: int) -> bool:
    if not d.startswith("M0 0"):
        return False
    return str(width) in d and str(height) in d and len(d) > 80


def trim_to_content(image: Image.Image, padding: int = 8) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    left, top, right, bottom = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            _r, _g, _b, a = pixels[x, y]
            if a < 16:
                continue
            left = min(left, x)
            top = min(top, y)
            right = max(right, x)
            bottom = max(bottom, y)
    if right < left or bottom < top:
        return rgba
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(width - 1, right + padding)
    bottom = min(height - 1, bottom + padding)
    return rgba.crop((left, top, right + 1, bottom + 1))


def vectorize(png: Path, traced: Path) -> None:
    import os

    npx = "npx.cmd" if os.name == "nt" else "npx"
    cmd = [
        npx,
        "--yes",
        "@neplex/vectorizer",
        str(png),
        str(traced),
        "--preset",
        "poster",
        "--color-mode",
        "color",
        "--filter-speckle",
        "8",
        "--color-precision",
        "8",
        "--layer-difference",
        "8",
        "--path-precision",
        "2",
    ]
    subprocess.run(cmd, check=True, cwd=ROOT)
    if not traced.exists():
        raise SystemExit(f"vectorizer produced no file: {traced}")


def clean_traced_svg(svg_text: str, aria_label: str) -> tuple[str, int]:
    width_match = re.search(r'width="(\d+)"', svg_text)
    height_match = re.search(r'height="(\d+)"', svg_text)
    width = int(width_match.group(1)) if width_match else 512
    height = int(height_match.group(1)) if height_match else 512

    buckets: dict[str, list[str]] = {INK: [], FOREST: [], MOSS: [], MINT: [], WHITE: []}

    for match in re.finditer(r"<path\b[^>]*>", svg_text):
        tag = match.group(0)
        fill_match = re.search(r'fill="([^"]+)"', tag)
        d_match = re.search(r'\bd="([^"]+)"', tag)
        transform_match = re.search(r'transform="([^"]+)"', tag)
        if not fill_match or not d_match:
            continue
        d = d_match.group(1)
        if is_canvas_background(d, width, height):
            continue
        tone = classify_fill(fill_match.group(1))
        if tone is None:
            continue
        if tone == WHITE and len(d) < 60:
            continue
        attrs = f'd="{d}"'
        if transform_match:
            attrs += f' transform="{transform_match.group(1)}"'
        buckets[tone].append(f"<path {attrs}/>")

    order = [INK, FOREST, MOSS, MINT, WHITE]
    path_count = sum(len(buckets[c]) for c in order)
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img" aria-label="{aria_label}">',
    ]
    for color in order:
        if not buckets[color]:
            continue
        parts.append(f'  <g fill="{color}">')
        parts.extend(f"    {path}" for path in buckets[color])
        parts.append("  </g>")
    parts.append("</svg>")
    parts.append("")
    return "\n".join(parts), path_count


def wrap_favicon(icon_svg: str) -> str:
    """Square sand plate behind mark — readable on dark browser chrome."""
    vb = re.search(r'viewBox="([^"]+)"', icon_svg)
    view_box = vb.group(1) if vb else "0 0 901 739"
    inner = re.search(r"<svg\b[^>]*>(.*)</svg>\s*$", icon_svg, re.S)
    body = inner.group(1).strip() if inner else ""
    size = 128
    pad = 10
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'width="{size}" height="{size}" role="img" aria-label="Med Assurance">\n'
        f'  <rect width="{size}" height="{size}" rx="28" fill="{PLATE}"/>\n'
        f'  <svg x="{pad}" y="{pad}" width="{size - pad * 2}" height="{size - pad * 2}" '
        f'viewBox="{view_box}" preserveAspectRatio="xMidYMid meet">\n'
        f"{body}\n"
        "  </svg>\n"
        "</svg>\n"
    )


def main() -> None:
    if not ICON_PNG.exists():
        raise SystemExit(f"missing source: {ICON_PNG}")

    trim_to_content(Image.open(ICON_PNG)).save(TRIMMED)
    vectorize(TRIMMED, TRACED)
    cleaned, path_count = clean_traced_svg(TRACED.read_text(encoding="utf-8"), "Med Assurance")
    ICON_SVG.write_text(cleaned, encoding="utf-8")
    FAVICON_SVG.write_text(wrap_favicon(cleaned), encoding="utf-8")
    TRIMMED.unlink(missing_ok=True)
    TRACED.unlink(missing_ok=True)
    print(f"wrote {ICON_SVG} ({path_count} paths, {ICON_SVG.stat().st_size} bytes)")
    print(f"wrote {FAVICON_SVG} ({FAVICON_SVG.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
