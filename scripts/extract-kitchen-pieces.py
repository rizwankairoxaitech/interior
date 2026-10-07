"""Cut the kitchen's pieces out of its final frame, with the clean patches that hide them.

Writes public/images/pieces/ (used by src/data/kitchenPieces.js) and prints the frame-space
boxes that the data module needs. For each piece:

  background  an earlier frame without the piece (a clean plate), Poisson-blended into frame 120
  alpha       how far frame 120 differs from that background, inside hand-measured shapes
  cutout      colour un-mixed from the background, so cutout-over-patch reproduces frame 120
  patch       the blended background, covering only where the piece was

Also writes the material swatches cropped from the same frame, and cleans the stool's studio
renders (scripts/sources/): the back view, registered over the cut-out so it can take over
from the frame pixels once the stool has taken off, and the front view for the studio statement.

Usage (from the project root; needs numpy and Pillow):
  python scripts/extract-kitchen-pieces.py [--frames DIR] [--out DIR] [--stool-back PNG] [--stool-front PNG]
                                           [--debug DIR]
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1920, 1080
FINAL_FRAME = 120

parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
parser.add_argument('--frames', default='public/kitchen-frames')
parser.add_argument('--out', default='public/images/pieces')
parser.add_argument('--stool-back', default='scripts/sources/stool-back.png', help='back-view render (PNG with alpha)')
parser.add_argument('--stool-front', default='scripts/sources/stool-front.png', help='front-view render (PNG with alpha)')
parser.add_argument('--debug', help='also write check sheets (cutout on light and dark, patched frame, alpha)')
args = parser.parse_args()
Path(args.out).mkdir(parents=True, exist_ok=True)


def load(n):
    return np.asarray(Image.open(f'{args.frames}/frame_{n:04d}.webp').convert('RGB')).astype(np.float64)


def shifted(img, dx, dy):
    """B[y, x] = img[y + dy, x + dx] (edges wrap; only interior pixels are used)."""
    return np.roll(np.roll(img, -dy, axis=0), -dx, axis=1)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def shape_mask(shapes, supersample=4):
    """Anti-aliased mask (0..1) from polygons, boxes, circles and thick lines in frame px."""
    S = supersample
    img = Image.new('L', (W * S, H * S), 0)
    draw = ImageDraw.Draw(img)
    for kind, *params in shapes:
        if kind == 'poly':
            draw.polygon([(x * S, y * S) for x, y in params[0]], fill=255)
        elif kind == 'box':
            x0, y0, x1, y1 = params[0]
            draw.rectangle([x0 * S, y0 * S, x1 * S, y1 * S], fill=255)
        elif kind == 'circle':
            (cx, cy), r = params
            draw.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=255)
        elif kind == 'line':
            (x0, y0), (x1, y1), half_width = params
            nx, ny = y1 - y0, -(x1 - x0)
            n = (nx * nx + ny * ny) ** 0.5
            nx, ny = nx / n * half_width, ny / n * half_width
            draw.polygon(
                [((x0 + nx) * S, (y0 + ny) * S), ((x1 + nx) * S, (y1 + ny) * S),
                 ((x1 - nx) * S, (y1 - ny) * S), ((x0 - nx) * S, (y0 - ny) * S)],
                fill=255,
            )
    return np.asarray(img.resize((W, H), Image.BOX)).astype(np.float64) / 255


def dilate(mask, px):
    img = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.MaxFilter(px * 2 + 1))).astype(np.float64) / 255


def erode(mask, px):
    img = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.MinFilter(px * 2 + 1))).astype(np.float64) / 255


def blur(mask, radius):
    img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius))).astype(np.float64) / 255


def gaussian(channel, sigma):
    """Separable Gaussian blur of a float array (edges repeat)."""
    radius = max(1, int(sigma * 3))
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / sigma) ** 2)
    kernel /= kernel.sum()
    padded = np.pad(channel, radius, mode='edge')
    rows = np.apply_along_axis(lambda r: np.convolve(r, kernel, mode='valid'), 1, padded)
    return np.apply_along_axis(lambda c: np.convolve(c, kernel, mode='valid'), 0, rows)


def harmonic_fill(values, known, iterations=160):
    """Solve Laplace's equation for the unknown pixels, coarse-to-fine (values: H x W x C)."""
    h, w = known.shape
    if min(h, w) > 12:
        hh, ww = h // 2 * 2, w // 2 * 2
        k = known[:hh, :ww].astype(np.float64)
        ks = k.reshape(hh // 2, 2, ww // 2, 2).sum(axis=(1, 3))
        vs = (values[:hh, :ww] * k[..., None]).reshape(hh // 2, 2, ww // 2, 2, -1).sum(axis=(1, 3))
        vs = np.where(ks[..., None] > 0, vs / np.maximum(ks, 1)[..., None], 0)
        coarse = harmonic_fill(vs, ks > 0, iterations)
        init = np.repeat(np.repeat(coarse, 2, axis=0), 2, axis=1)
        init = np.pad(init, ((0, h - hh), (0, w - ww), (0, 0)), mode='edge')
        current = np.where(known[..., None], values, init)
    else:
        current = np.where(known[..., None], values, values[known].mean(axis=0) if known.any() else 0)
    for _ in range(iterations):
        p = np.pad(current, ((1, 1), (1, 1), (0, 0)), mode='edge')
        average = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
        current = np.where(known[..., None], values, average)
    return current


def flood(mask, seed):
    """Pixels of `mask`'s region that are connected to `seed` (x, y)."""
    img = Image.fromarray(mask.astype(np.uint8) * 255).copy()  # fromarray images are read-only
    ImageDraw.floodfill(img, seed, 128)
    return np.asarray(img) == 128


def fill_holes(mask):
    """Binary mask with enclosed pockets filled."""
    outside = flood(np.pad(mask, 1), (0, 0))[1:-1, 1:-1]  # background reachable from the border
    return ~outside


def spread_colours(colour, solid):
    """Colours of the solid pixels, spread outward over the soft edge (normalised convolution)."""
    out = colour.copy()
    known = solid.astype(np.float64)
    filled = solid.copy()
    for sigma in (1.2, 2.5, 5):
        den = gaussian(known, sigma)
        est = np.dstack([gaussian(colour[..., c] * known, sigma) for c in range(3)])
        est /= np.maximum(den, 1e-6)[..., None]
        newly = ~filled & (den > 0.01)
        out[newly] = est[newly]
        filled |= newly
    return out


def build(name, frame, plate, region_shapes, solve_pad, alpha_fn, solid=None, opaque=False, crop_pad=4):
    region_mask = shape_mask(region_shapes)
    domain = dilate((region_mask > 0.01).astype(np.float64), solve_pad) > 0.5

    # Work inside the domain's bounding box, plus a margin of known pixels.
    ys, xs = np.nonzero(domain)
    x0, x1 = max(xs.min() - 8, 0), min(xs.max() + 9, W)
    y0, y1 = max(ys.min() - 8, 0), min(ys.max() + 9, H)
    crop = (slice(y0, y1), slice(x0, x1))
    F, G = frame[crop], plate[crop]

    # Seamless clone: the plate's detail with the frame's colours at the boundary.
    background = np.clip(G + harmonic_fill(F - G, ~domain[crop]), 0, 255)

    alpha = alpha_fn(F, background, region_mask[crop], crop)
    if solid is not None:  # geometric parts (legs, rails): opaque, keeping their real soft edges
        hard = solid[crop]
        near = dilate((hard > 0.01).astype(np.float64), 2)
        soft = smoothstep(14, 40, np.abs(F - background).max(axis=2)) * near
        alpha = np.maximum(alpha, np.maximum(hard, soft))
    alpha = np.clip(alpha, 0, 1)

    # Solve again over exactly the area the patch covers, so the patch's edge equals the frame.
    covered = dilate((alpha > 0.02).astype(np.float64), 3) > 0.5
    background = np.clip(G + harmonic_fill(F - G, ~covered), 0, 255)

    # Un-mix colour so that cutout-over-background reproduces the frame.
    a = alpha[..., None]
    unmixed = np.clip((F - (1 - a) * background) / np.maximum(a, 1e-3), 0, 255)
    colour = np.where(a > 0.04, unmixed, F)
    if opaque:
        # A solid object's edge is its own colour partly covering the background. Where alpha is
        # under-estimated, un-mixing overshoots into white fringes: keep edges near the interior colour.
        interior = spread_colours(F, alpha > 0.97)
        clamped = np.clip(colour, interior - 26, interior + 26)
        colour = np.where((alpha < 0.97)[..., None], clamped, colour)

    patch_alpha = np.where(dilate((alpha > 0.02).astype(np.float64), 2) > 0.5, 1.0, blur(covered.astype(np.float64), 0.8))

    def bounds(mask):
        yy, xx = np.nonzero(mask > 0.004)
        return (max(xx.min() - crop_pad, 0), max(yy.min() - crop_pad, 0),
                min(xx.max() + crop_pad + 1, x1 - x0), min(yy.max() + crop_pad + 1, y1 - y0))

    boxes = {}
    for kind, rgb, al in (('piece', colour, alpha), ('patch', background, patch_alpha)):
        bx0, by0, bx1, by1 = bounds(al)
        rgba = np.dstack([rgb[by0:by1, bx0:bx1], al[by0:by1, bx0:bx1] * 255])
        Image.fromarray(np.round(rgba).astype(np.uint8), 'RGBA').save(
            f'{args.out}/{kind}-{name}.webp', 'WEBP', quality=92, method=6, exact=True
        )
        boxes['cutout' if kind == 'piece' else 'patch'] = {
            'x': int(x0 + bx0), 'y': int(y0 + by0), 'w': int(bx1 - bx0), 'h': int(by1 - by0)
        }

    if args.debug:
        Path(args.debug).mkdir(parents=True, exist_ok=True)
        bx0, by0, bx1, by1 = bounds(alpha)
        al = alpha[by0:by1, bx0:bx1, None]
        piece = colour[by0:by1, bx0:bx1]
        tiles = [piece * al + np.array(bg, dtype=np.float64) * (1 - al) for bg in ((233, 226, 215), (20, 35, 27))]
        patched = F * (1 - patch_alpha[..., None]) + background * patch_alpha[..., None]
        tiles += [patched[by0:by1, bx0:bx1], F[by0:by1, bx0:bx1], np.repeat(al * 255, 3, axis=2)]
        sheet = np.concatenate([np.pad(t, ((0, 0), (0, 6), (0, 0)), constant_values=255) for t in tiles], axis=1)
        Image.fromarray(sheet.astype(np.uint8)).resize((sheet.shape[1] * 2, sheet.shape[0] * 2), Image.LANCZOS).save(
            f'{args.debug}/{name}-check.png'
        )

    # The piece's solid outline in frame px, for registering a studio render over it.
    yy, xx = np.nonzero(alpha > 0.5)
    body = (x0 + xx.min(), y0 + yy.min(), x0 + xx.max() + 1, y0 + yy.max() + 1)
    return boxes, body


def studio_image(path, name, max_height=1200, register_to=None):
    """Clean a studio render (stray specks, edge fringe), crop it to the piece and save it.

    With `register_to` (a piece's solid outline in frame px), also return the render's box in
    frame px: same height and horizontal centre, so it can stand in for the piece's cut-out.
    """
    rgba = np.asarray(Image.open(path).convert('RGBA')).astype(np.float64)
    # Drop stray low-alpha specks along the outline; the body itself is (near) opaque.
    alpha = np.clip((rgba[..., 3] - 12) / (245 - 12), 0, 1)
    ys, xs = np.nonzero(alpha > 0)
    x0, y0 = max(xs.min() - 6, 0), max(ys.min() - 6, 0)
    x1, y1 = min(xs.max() + 7, alpha.shape[1]), min(ys.max() + 7, alpha.shape[0])
    alpha = alpha[y0:y1, x0:x1]
    premultiplied = rgba[y0:y1, x0:x1, :3] * alpha[..., None]

    height = min(max_height, y1 - y0)  # never upscale
    width = round((x1 - x0) * height / (y1 - y0))

    def resize(channel):
        img = Image.fromarray(channel.astype(np.float32), 'F').resize((width, height), Image.LANCZOS)
        return np.asarray(img).astype(np.float64)

    alpha = np.clip(resize(alpha), 0, 1)
    rgb = np.dstack([resize(premultiplied[..., c]) for c in range(3)]) / np.maximum(alpha, 1e-6)[..., None]
    rgb = np.clip(rgb, 0, 255)
    # Keep edge colours near the interior's, so no coloured fringe shows on light backgrounds.
    interior = spread_colours(rgb, alpha > 0.97)
    rgb = np.where((alpha < 0.97)[..., None], np.clip(rgb, interior - 30, interior + 30), rgb)
    Image.fromarray(np.round(np.dstack([rgb, alpha * 255])).astype(np.uint8), 'RGBA').save(
        f'{args.out}/{name}.webp', 'WEBP', quality=90, method=6
    )

    result = {'width': width, 'height': height}
    if register_to is not None:
        yy, xx = np.nonzero(alpha > 0.5)
        scale = (register_to[3] - register_to[1]) / (yy.max() + 1 - yy.min())  # frame px per render px
        left = (register_to[0] + register_to[2]) / 2 - (xx.min() + xx.max() + 1) / 2 * scale
        top = register_to[1] - yy.min() * scale
        result.update(x=round(left, 2), y=round(top, 2), w=round(width * scale, 2), h=round(height * scale, 2))
    return result


frame = load(FINAL_FRAME)

# ---- Pendant: the middle one, over the plaster hood. Clean plate: frame 72 (before the
# pendants drop), one row lower than frame 120.
GLOBE_CENTRE, GLOBE_RADIUS = (962.6, 355.2), 37.5
PENDANT_SHAPES = [
    ('box', (947, 46, 980, 64)),  # ceiling rose
    ('line', (963.2, 58), (963.2, 300), 3.4),  # cord
    ('box', (950, 292, 976, 327)),  # brass gallery
    ('circle', GLOBE_CENTRE, 40.5),  # glass globe
]


def pendant_alpha(F, B, region, crop):
    diff = np.abs(F - B).max(axis=2)
    # Through the glass the hood shifts slightly (refraction): ask for a bigger difference
    # inside the globe so clear glass stays clear, while the rim and bulb stay opaque.
    yy, xx = np.mgrid[crop[0], crop[1]]
    inside = smoothstep(GLOBE_RADIUS - 1.5, GLOBE_RADIUS - 5, np.hypot(xx - GLOBE_CENTRE[0], yy - GLOBE_CENTRE[1]))
    low, high = 10 + 8 * inside, 46 + 26 * inside
    t = np.clip((diff - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t) * np.clip(region * 1.6, 0, 1)


# ---- Counter stool: second from the left. Clean plate: frame 92, before the stools arrive.
UPHOLSTERY = [(741, 690), (745, 664), (790, 660), (862, 660), (901, 664), (907, 690), (918, 731),
              (919, 763), (907, 782), (880, 788), (770, 788), (743, 775)]
STOOL_SHAPES = [
    ('poly', UPHOLSTERY),  # seat and back
    ('line', (768.5, 774), (753.5, 982), 5.5),  # front-left leg
    ('line', (778.5, 776), (771, 948), 5.5),  # back-left leg
    ('line', (879.5, 774), (885, 983), 5.5),  # front-right leg
    ('line', (891.5, 770), (901, 949), 5.5),  # back-right leg
    ('line', (758, 910.5), (884, 910.5), 4.2),  # footrest
    ('poly', [(760, 872), (786, 872), (786, 914), (760, 914)]),  # left side stretcher
    ('poly', [(872, 868), (899, 868), (899, 914), (872, 914)]),  # right side stretcher
]
SEAT_SEED = (826, 720)  # a pixel inside the upholstery
upholstery_mask = shape_mask([('poly', UPHOLSTERY)])
seat_rail_mask = shape_mask([('poly', [(752, 771), (902, 768), (902, 786), (752, 789)])])


def edge_quad(left, right, y0, y1):
    """Leg polygon between two fitted edge lines x = k * y + b (frame px)."""
    (kl, bl), (kr, br) = left, right
    return ('poly', [(kl * y0 + bl, y0), (kr * y0 + br, y0), (kr * y1 + br, y1), (kl * y1 + bl, y1)])


# Black legs barely differ from the dark island behind them, so they are drawn from edges
# fitted to per-row darkness profiles of frame 120 (right edges include their last pixel).
stool_frame = shape_mask([
    edge_quad((-0.0888, 838.53), (-0.0999, 853.42), 772, 980.5),  # front-left leg
    edge_quad((-0.0638, 828.84), (-0.0638, 833.44), 774, 946.5),  # back-left leg
    edge_quad((0.0514, 833.23), (0.0402, 848.52), 772, 980.5),  # front-right leg
    edge_quad((0.0720, 831.93), (0.0565, 849.53), 768, 946.5),  # back-right leg
    ('box', (760, 909.5, 882, 913.5)),  # footrest
    ('line', (771.5, 875), (764.5, 899), 1.6),  # left side stretcher
    ('line', (893.8, 877), (886.3, 906), 2.0),  # right side stretcher
])


def stool_alpha(F, B, region, crop):
    diff = np.abs(F - B).max(axis=2)
    luminance = np.array([0.299, 0.587, 0.114])
    darker = B @ luminance - F @ luminance
    # Upholstery against the dark island: a high threshold keeps its cast shadow out of the edge.
    alpha = smoothstep(18, 44, diff)
    # The seat rail only differs by being darker than the island behind it.
    alpha = np.maximum(alpha, smoothstep(8, 20, darker) * seat_rail_mask[crop])
    alpha *= np.clip(upholstery_mask[crop] * 1.6, 0, 1)
    body = flood(alpha > 0.3, (SEAT_SEED[0] - crop[1].start, SEAT_SEED[1] - crop[0].start))  # drop specks
    alpha *= dilate(body.astype(np.float64), 2)
    # Solid inside (including pockets where the plate matches the fabric, e.g. a brass pull);
    # soft alpha survives only in the outer ring, so the silhouette stays anti-aliased.
    return np.maximum(alpha, erode(fill_holes(body).astype(np.float64), 1))


pendant, _ = build('pendant', frame, shifted(load(72), 0, 1), PENDANT_SHAPES, 5, pendant_alpha)
stool, stool_body = build('stool', frame, load(92), STOOL_SHAPES, 6, stool_alpha, solid=stool_frame, opaque=True)
boxes = {'pendant': pendant, 'stool': stool}

# Material swatches for the list, from the same frame (x0, y0, x1, y1).
SWATCHES = {'marble': (1480, 458, 1600, 578), 'joinery': (1530, 300, 1670, 440), 'oak': (1480, 860, 1620, 1000)}
final = Image.open(f'{args.frames}/frame_{FINAL_FRAME:04d}.webp').convert('RGB')
for name, box in SWATCHES.items():
    final.crop(box).resize((320, 320), Image.LANCZOS).save(f'{args.out}/swatch-{name}.webp', 'WEBP', quality=86, method=6)

# The stool's studio renders: the back view takes over from the blurry cut-out once the stool
# has taken off; the front view is set large in the studio statement.
if args.stool_back and Path(args.stool_back).exists():
    boxes['stool']['render'] = studio_image(args.stool_back, 'stool-back', max_height=1000, register_to=stool_body)
if args.stool_front and Path(args.stool_front).exists():
    boxes['stool']['showcase'] = studio_image(args.stool_front, 'stool-front')

print('Frame-space boxes for src/data/kitchenPieces.js:')
print(json.dumps(boxes, indent=2))
