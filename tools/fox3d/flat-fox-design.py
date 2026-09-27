#!/usr/bin/env python3
"""BM Player fox: a hand-placed low-poly fox head.

Every point has a depth (z, towards the viewer). Each triangle's colour is
its material shaded by a real facet normal against one light from the upper
left, so the flat facets read as a solid form. The left half is designed and
mirrored, so the face is symmetrical and the lighting is not.
"""
import math, sys

W = 400
MAT = {
    'orange': (232, 118, 43),
    'orange_hi': (243, 146, 69),
    'cream': (251, 236, 216),
    'ear_in': (74, 42, 34),
    'dark': (34, 24, 22),
}

# (x, y, z) on a 400x400 face, left half and centre line only.
P = {
    'crown':      (200, 100, 44),
    'brow_c':     (200, 170, 74),
    'bridge':     (200, 236, 98),
    'nose_top':   (200, 314, 116),
    'chin':       (200, 362, 76),

    # ear: outer triangle T/O/I, with an inset inner ear t/o/i
    'ear_tip':    (104, 20, 0),
    'ear_out':    (66, 156, 12),
    'ear_in':     (162, 108, 30),
    'ie_tip':     (110, 50, 6),
    'ie_o':       (88, 136, 14),
    'ie_i':       (146, 116, 22),

    'crown2':     (172, 128, 48),
    'forehead':   (150, 164, 62),
    'brow':       (118, 188, 54),
    'temple':     (64, 196, 24),
    'cheek_top':  (88, 238, 40),
    'tuft':       (30, 254, 6),
    'notch':      (68, 272, 22),
    'tuft2':      (56, 306, 10),
    'cheek_low':  (92, 292, 36),
    'jaw':        (138, 330, 54),
    'muz_side':   (164, 284, 90),
    'muz_low':    (174, 330, 72),
    'eye_out':    (108, 206, 56),
    'eye_top':    (148, 200, 64),
    'eye_in':     (176, 228, 72),
    'eye_bot':    (144, 240, 60),
    'under_eye':  (158, 262, 78),
}

F = [
    # ear rim and inner ear
    (('ear_tip', 'ear_out', 'ie_o'), 'orange'),
    (('ear_tip', 'ie_o', 'ie_tip'), 'orange'),
    (('ear_out', 'ear_in', 'ie_i'), 'orange'),
    (('ear_out', 'ie_i', 'ie_o'), 'orange'),
    (('ear_in', 'ear_tip', 'ie_tip'), 'orange'),
    (('ear_in', 'ie_tip', 'ie_i'), 'orange'),
    (('ie_tip', 'ie_o', 'ie_i'), 'ear_in'),
    # skull
    (('ear_in', 'crown', 'crown2'), 'orange'),
    (('ear_in', 'crown2', 'forehead'), 'orange'),
    (('crown2', 'crown', 'brow_c'), 'orange'),
    (('crown2', 'brow_c', 'forehead'), 'orange'),
    (('ear_out', 'ear_in', 'forehead'), 'orange'),
    (('ear_out', 'forehead', 'brow'), 'orange'),
    (('ear_out', 'brow', 'temple'), 'orange'),
    (('temple', 'brow', 'eye_out'), 'orange'),
    (('temple', 'eye_out', 'cheek_top'), 'orange'),
    (('brow', 'forehead', 'eye_top'), 'orange'),
    (('brow', 'eye_top', 'eye_out'), 'orange'),
    (('eye_top', 'forehead', 'eye_in'), 'orange'),
    (('forehead', 'brow_c', 'eye_in'), 'orange'),
    # the orange bridge runs down to the nose
    (('brow_c', 'bridge', 'eye_in'), 'orange_hi'),
    (('eye_in', 'bridge', 'under_eye'), 'orange_hi'),
    (('bridge', 'nose_top', 'under_eye'), 'orange_hi'),
    (('under_eye', 'nose_top', 'muz_side'), 'orange_hi'),
    # cream muzzle sides, chin and cheeks
    (('nose_top', 'muz_low', 'muz_side'), 'cream'),
    (('nose_top', 'chin', 'muz_low'), 'cream'),
    (('muz_side', 'muz_low', 'jaw'), 'cream'),
    (('muz_low', 'chin', 'jaw'), 'cream'),
    (('eye_out', 'eye_bot', 'cheek_top'), 'orange'),
    (('eye_bot', 'under_eye', 'muz_side'), 'cream'),
    (('cheek_top', 'eye_bot', 'muz_side'), 'cream'),
    (('cheek_top', 'muz_side', 'cheek_low'), 'cream'),
    (('temple', 'cheek_top', 'tuft'), 'cream'),
    (('cheek_top', 'notch', 'tuft'), 'cream'),
    (('cheek_top', 'cheek_low', 'notch'), 'cream'),
    (('notch', 'cheek_low', 'tuft2'), 'cream'),
    (('cheek_low', 'jaw', 'tuft2'), 'cream'),
    (('cheek_low', 'muz_side', 'jaw'), 'cream'),
]

LIGHT = (-0.45, 0.55, 0.70)          # upper left, towards the viewer (x right, y up, z out)

def norm(v):
    l = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / l for c in v)

L = norm(LIGHT)

def shade(tri, mat):
    a, b, c = [(p[0], -p[1], p[2]) for p in tri]      # SVG y points down
    u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
    n = norm((u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]))
    if n[2] < 0: n = tuple(-x for x in n)
    d = max(0.0, sum(n[i] * L[i] for i in range(3)))
    k = 0.70 + 0.38 * d
    r, g, bb = MAT[mat]
    return '#%02x%02x%02x' % tuple(min(255, int(ch * k)) for ch in (r, g, bb))

def mirror(p): return (W - p[0], p[1], p[2])

def polys():
    out = []
    for names, mat in F:
        tri = [P[n] for n in names]
        out.append((tri, mat))
        out.append(([mirror(p) for p in tri], mat))
    return out

def svg(extra=''):
    parts = []
    for tri, mat in polys():
        pts = ' '.join(f'{x:.1f},{y:.1f}' for x, y, _ in tri)
        col = shade(tri, mat)
        # a hairline stroke in the same colour closes anti-aliasing seams
        parts.append(f'<polygon points="{pts}" fill="{col}" stroke="{col}" stroke-width="0.8" stroke-linejoin="round"/>')
    for side in (1, -1):
        def X(x): return x if side == 1 else W - x
        eye = [P['eye_out'], P['eye_top'], P['eye_in'], P['eye_bot']]
        parts.append('<polygon points="%s" fill="#1c1413"/>' % ' '.join(f'{X(x)},{y}' for x, y, _ in eye))
        iris = [(124, 210), (150, 205), (168, 224), (146, 234)]
        parts.append('<polygon points="%s" fill="#f0a531"/>' % ' '.join(f'{X(x)},{y}' for x, y in iris))
        parts.append('<polygon points="%s" fill="#f7c95b"/>' % ' '.join(f'{X(x)},{y}' for x, y in [(124, 210), (150, 205), (146, 218)]))
        parts.append('<polygon points="%s" fill="#1c1413"/>' % ' '.join(f'{X(x)},{y}' for x, y in [(147, 208), (152, 220), (147, 232), (142, 220)]))
        parts.append('<polygon points="%s" fill="#fffaf0"/>' % ' '.join(f'{X(x)},{y}' for x, y in [(135, 211), (141, 209), (139, 215)]))
    parts.append('<polygon points="178,312 222,312 200,340" fill="#1d1614"/>')
    parts.append('<polygon points="186,315 204,315 194,322" fill="#6b5a55"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}">{extra}{"".join(parts)}</svg>'

if __name__ == '__main__':
    bg = '<rect width="400" height="400" fill="#0f1426"/>'
    open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fox.svg', 'w').write(svg(bg))
