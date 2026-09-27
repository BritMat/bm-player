#!/usr/bin/env python3
"""BM Player 3D fox: a closed low-poly head, hand-placed, previewed from any angle.

Coordinates: X right, Y up, Z towards the viewer. The front surface is the
approved flat design (its points already carried depth); the back, sides and
ear thickness are added here. Left half and centre line only; mirrored.
"""
import math, sys, json
from PIL import Image, ImageDraw

MAT = {
    'orange': (232, 118, 43), 'orange_hi': (243, 146, 69), 'cream': (251, 236, 216),
    'ear_in': (74, 42, 34), 'ear_back': (70, 44, 34), 'ear_tip': (44, 30, 26), 'ear_fur': (238, 222, 205), 'eye': (28, 20, 19), 'iris': (240, 165, 49),
    'iris_hi': (247, 201, 91), 'pupil': (28, 20, 19), 'glint': (255, 250, 240), 'nose': (29, 22, 20),
    'nose_hi': (107, 90, 85), 'tear': (58, 34, 28),
}

def S(x, y, z):                     # flat-design coordinates to model space
    return ((x - 200) / 100.0, (200 - y) / 100.0, z / 100.0)

P = {
    # ── front, from the approved design ──
    'crown': S(200, 100, 44), 'brow_c': S(200, 170, 74), 'bridge': S(200, 236, 112),
    'nose_top': S(200, 314, 146), 'chin': S(200, 362, 96),
    'ear_tip': S(104, 20, 0), 'ear_out': S(66, 156, 12), 'ear_in': S(162, 108, 30),
    'ie_tip': S(112, 64, 8), 'ie_o': S(88, 136, 14), 'ie_i': S(146, 116, 22),
    'crown2': S(172, 128, 48), 'forehead': S(150, 164, 62), 'brow': S(118, 188, 54),
    'temple': S(64, 196, 24), 'cheek_top': S(88, 238, 40), 'tuft': S(30, 254, 6),
    'notch': S(68, 272, 22), 'tuft2': S(56, 306, 10), 'cheek_low': S(92, 292, 36),
    'jaw': S(138, 330, 60), 'muz_side': S(164, 284, 106), 'muz_low': S(174, 330, 90),
    'eye_out': S(108, 206, 56), 'eye_top': S(148, 200, 64), 'eye_in': S(176, 228, 80),
    'eye_bot': S(144, 240, 60), 'under_eye': S(158, 262, 88),
}

def _lerp(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
P['et_o'] = _lerp(P['ear_tip'], P['ear_out'], 0.27)            # the dark tip cap
P['et_i'] = _lerp(P['ear_tip'], P['ear_in'], 0.27)
P['ie_tf'] = _lerp(P['ie_tip'], _lerp(P['ie_o'], P['ie_i'], 0.5), 0.55)   # top of the fur tuft

FRONT = [
    (('ear_tip', 'et_o', 'et_i'), 'ear_tip', 'ear'),
    (('et_o', 'ear_out', 'ie_o'), 'orange', 'ear'), (('et_o', 'ie_o', 'ie_tip'), 'orange', 'ear'),
    (('et_i', 'et_o', 'ie_tip'), 'orange', 'ear'), (('ear_in', 'et_i', 'ie_tip'), 'orange', 'ear'),
    (('ear_out', 'ear_in', 'ie_i'), 'orange', 'ear'), (('ear_out', 'ie_i', 'ie_o'), 'orange', 'ear'),
    (('ear_in', 'ie_tip', 'ie_i'), 'orange', 'ear'),
    (('ie_tip', 'ie_o', 'ie_tf'), 'ear_in', 'ear'), (('ie_tip', 'ie_tf', 'ie_i'), 'ear_in', 'ear'),
    (('ie_tf', 'ie_o', 'ie_i'), 'ear_fur', 'ear'),
    (('ear_in', 'crown', 'crown2'), 'orange', 'head'), (('ear_in', 'crown2', 'forehead'), 'orange', 'head'),
    (('crown2', 'crown', 'brow_c'), 'orange', 'head'), (('crown2', 'brow_c', 'forehead'), 'orange', 'head'),
    (('ear_out', 'ear_in', 'forehead'), 'orange', 'head'), (('ear_out', 'forehead', 'brow'), 'orange', 'head'),
    (('ear_out', 'brow', 'temple'), 'orange', 'head'), (('temple', 'brow', 'eye_out'), 'orange', 'head'),
    (('temple', 'eye_out', 'cheek_top'), 'orange', 'head'), (('brow', 'forehead', 'eye_top'), 'orange', 'head'),
    (('brow', 'eye_top', 'eye_out'), 'orange', 'head'), (('eye_top', 'forehead', 'eye_in'), 'orange', 'head'),
    (('forehead', 'brow_c', 'eye_in'), 'orange', 'head'),
    (('brow_c', 'bridge', 'eye_in'), 'orange_hi', 'head'), (('eye_in', 'bridge', 'under_eye'), 'orange_hi', 'head'),
    (('bridge', 'nose_top', 'under_eye'), 'orange_hi', 'head'), (('under_eye', 'nose_top', 'muz_side'), 'orange_hi', 'head'),
    (('nose_top', 'muz_low', 'muz_side'), 'cream', 'head'), (('nose_top', 'chin', 'muz_low'), 'cream', 'head'),
    (('muz_side', 'muz_low', 'jaw'), 'cream', 'head'), (('muz_low', 'chin', 'jaw'), 'cream', 'head'),
    (('eye_out', 'eye_bot', 'cheek_top'), 'orange', 'head'), (('eye_bot', 'under_eye', 'muz_side'), 'cream', 'head'),
    (('cheek_top', 'eye_bot', 'muz_side'), 'cream', 'head'), (('cheek_top', 'muz_side', 'cheek_low'), 'cream', 'head'),
    (('temple', 'cheek_top', 'tuft'), 'cream', 'head'), (('cheek_top', 'notch', 'tuft'), 'cream', 'head'),
    (('cheek_top', 'cheek_low', 'notch'), 'cream', 'head'), (('notch', 'cheek_low', 'tuft2'), 'cream', 'head'),
    (('cheek_low', 'jaw', 'tuft2'), 'cream', 'head'), (('cheek_low', 'muz_side', 'jaw'), 'cream', 'head'),
    # the hole beside each eye becomes a dark tear line, which foxes have
    (('eye_in', 'under_eye', 'eye_bot'), 'tear', 'head'),
]
# ── the rest of the head: a ring just behind the face outline, a rounded
#    back of the skull, the throat, and thickness for the ears ──
P.update({
    's_crown': (0.0, 1.02, -0.30), 's_ear_in': (-0.42, 0.95, -0.28), 's_ear_out': (-1.18, 0.46, -0.30),
    's_temple': (-1.30, 0.02, -0.28), 's_tuft': (-1.52, -0.52, -0.16), 's_tuft2': (-1.25, -1.00, -0.12),
    's_jaw': (-0.60, -1.28, -0.10), 's_chin': (0.0, -1.46, 0.22),
    'b_top': (0.0, 0.72, -0.95), 'b_side': (-0.82, 0.10, -0.88), 'b_low_side': (-0.70, -0.72, -0.62),
    'b_center': (0.0, 0.0, -1.12), 'b_bottom': (0.0, -0.95, -0.72),
})
ET, EO, EI = P['ear_tip'], P['ear_out'], P['ear_in']
P.update({
    'eb_tip': (ET[0] + 0.06, ET[1] - 0.02, ET[2] - 0.16),
    'eb_out': (EO[0] + 0.05, EO[1], EO[2] - 0.26),
    'eb_in':  (EI[0] - 0.02, EI[1], EI[2] - 0.28),
})
EAR_CENTER = tuple(sum(v) / 6 for v in zip(ET, EO, EI, P['eb_tip'], P['eb_out'], P['eb_in']))

BACK = [
    # side strip: face outline to the ring behind it
    (('crown', 'ear_in', 's_ear_in'), 'orange', 'head', 'out'), (('crown', 's_ear_in', 's_crown'), 'orange', 'head', 'out'),
    (('ear_in', 'ear_out', 's_ear_out'), 'orange', 'head', 'out'), (('ear_in', 's_ear_out', 's_ear_in'), 'orange', 'head', 'out'),
    (('ear_out', 'temple', 's_temple'), 'orange', 'head', 'out'), (('ear_out', 's_temple', 's_ear_out'), 'orange', 'head', 'out'),
    (('temple', 'tuft', 's_tuft'), 'cream', 'head', 'out'), (('temple', 's_tuft', 's_temple'), 'cream', 'head', 'out'),
    (('tuft', 'notch', 's_tuft'), 'cream', 'head', 'out'), (('notch', 'tuft2', 's_tuft2'), 'cream', 'head', 'out'),
    (('notch', 's_tuft2', 's_tuft'), 'cream', 'head', 'out'),
    (('tuft2', 'jaw', 's_jaw'), 'cream', 'head', 'out'), (('tuft2', 's_jaw', 's_tuft2'), 'cream', 'head', 'out'),
    (('jaw', 'chin', 's_chin'), 'cream', 'head', 'out'), (('jaw', 's_chin', 's_jaw'), 'cream', 'head', 'out'),
    # back of the skull
    (('s_crown', 's_ear_in', 'b_top'), 'orange', 'head', 'out'),
    (('s_ear_in', 's_ear_out', 'b_side'), 'orange', 'head', 'out'), (('s_ear_in', 'b_side', 'b_top'), 'orange', 'head', 'out'),
    (('s_ear_out', 's_temple', 'b_side'), 'orange', 'head', 'out'),
    (('s_temple', 's_tuft', 'b_side'), 'orange', 'head', 'out'), (('s_tuft', 'b_low_side', 'b_side'), 'orange', 'head', 'out'),
    (('s_tuft', 's_tuft2', 'b_low_side'), 'orange', 'head', 'out'),
    (('b_top', 'b_side', 'b_center'), 'orange', 'head', 'out'), (('b_side', 'b_low_side', 'b_center'), 'orange', 'head', 'out'),
    (('b_low_side', 'b_bottom', 'b_center'), 'orange', 'head', 'out'),
    # throat
    (('s_tuft2', 's_jaw', 'b_low_side'), 'cream', 'head', 'out'), (('s_jaw', 'b_bottom', 'b_low_side'), 'cream', 'head', 'out'),
    (('s_jaw', 's_chin', 'b_bottom'), 'cream', 'head', 'out'),
    # ears: an orange back, and the two edges
    (('eb_tip', 'eb_out', 'eb_in'), 'ear_back', 'ear', 'back_ear'),
    (('ear_tip', 'ear_out', 'eb_out'), 'orange', 'ear', 'ear_side'), (('ear_tip', 'eb_out', 'eb_tip'), 'orange', 'ear', 'ear_side'),
    (('ear_tip', 'eb_tip', 'eb_in'), 'orange', 'ear', 'ear_side'), (('ear_tip', 'eb_in', 'ear_in'), 'orange', 'ear', 'ear_side'),
]

def V(p, d=0.0, n=(0, 0, 1)):
    return tuple(p[i] + n[i] * d for i in range(3))

def mirror(p): return (-p[0], p[1], p[2])

CENTER = (0.0, 0.1, -0.35)       # inside the head: back and side faces point away from it

def orient(t, outward):
    """Wind a triangle so its normal points the right way (the flat design never cared)."""
    n = normal(t)
    if outward == 'front': good = n[2] > 0
    elif outward == 'back_ear': good = n[2] < 0
    elif outward == 'ear_side':
        ref = EAR_CENTER if sum(p[0] for p in t) < 0 else mirror(EAR_CENTER)
        c = [sum(p[i] for p in t) / 3 - ref[i] for i in range(3)]
        good = sum(n[i] * c[i] for i in range(3)) > 0
    else:
        c = [sum(p[i] for p in t) / 3 - CENTER[i] for i in range(3)]
        good = sum(n[i] * c[i] for i in range(3)) > 0
    return t if good else [t[0], t[2], t[1]]

def build():
    """All triangles: ([p0, p1, p2], material, part), wound to face outward."""
    tris = []
    for names, mat, part, *rest in [f + ('front',) for f in FRONT] + BACK:
        way = rest[0] if rest else 'out'
        t = orient([P[n] for n in names], way)
        tl = part + '_l' if part in ('ear', 'eye') else part
        tr = part + '_r' if part in ('ear', 'eye') else part
        tris.append((t, mat, tl))
        tris.append((orient([mirror(p) for p in t], way), mat, tr))
    for t, mat, part in chest_ruff():
        tris.append((orient(t, 'out'), mat, part))
    for t, mat, part in eyes_and_nose():
        tris.append((orient(t, 'front' if part != 'nose' else 'out'), mat, part))
    return tris

def chest_ruff():
    """A neck and chest of fur under the head: a ring hidden inside the head's
    underside, down to a spiky ruff edge, cream at the front and orange at the
    back. Grounds the head, which used to float."""
    out = []
    top = [(0.78 * math.cos(a), -1.02, -0.18 + 0.60 * math.sin(a)) for a in (i / 8 * 2 * math.pi for i in range(8))]
    bot = []
    for i in range(16):
        a = i / 16 * 2 * math.pi
        spike = i % 2 == 0
        k = 1.12 if spike else 0.90
        bot.append((1.30 * k * math.cos(a), -2.08 if spike else -1.80, -0.08 + 0.92 * k * math.sin(a)))
    ctr = (0.0, -1.84, -0.08)
    def col(t):
        cz = sum(p[2] for p in t) / 3
        return 'cream' if cz > 0.05 else 'orange'
    for i in range(8):
        a, b = top[i], top[(i + 1) % 8]
        m0, m1, m2 = bot[2 * i], bot[(2 * i + 1) % 16], bot[(2 * i + 2) % 16]
        for t in ([a, m0, m1], [a, m1, b], [b, m1, m2]): out.append((t, col(t), 'head'))
    for i in range(16):
        t = [bot[i], bot[(i + 1) % 16], ctr]
        out.append((t, 'cream', 'head'))
    return out

def eyes_and_nose():
    out = []
    for side in (1, -1):
        X = (lambda p: p) if side == 1 else mirror
        tag = 'eye_l' if side == 1 else 'eye_r'
        almond = [P['eye_out'], P['eye_top'], P['eye_in'], P['eye_bot']]
        # the almond's plane normal, pointing out of the face
        a, b, c = almond[0], almond[1], almond[2]
        n = normal((a, b, c)); n = n if n[2] > 0 else tuple(-x for x in n)
        def layer(pts2d, mat, d):
            pts = [lift(S(x, y, 0)[0:2], almond, n, d) for x, y in pts2d]
            pts = [X(p) for p in pts]
            if side == -1: pts = pts[::-1]
            return [(pts[0], pts[i], pts[i + 1]) for i in range(1, len(pts) - 1)]
        for t in [(X(almond[0]), X(almond[1]), X(almond[2])), (X(almond[0]), X(almond[2]), X(almond[3]))]:
            out.append((list(t if side == 1 else t[::-1]), 'eye', tag))
        for t in layer([(124, 210), (150, 205), (168, 224), (146, 234)], 'iris', 0.012): out.append((list(t), 'iris', tag))
        for t in layer([(124, 210), (150, 205), (146, 218)], 'iris_hi', 0.018): out.append((list(t), 'iris_hi', tag))
        for t in layer([(147, 208), (153, 220), (147, 232), (141, 220)], 'pupil', 0.024): out.append((list(t), 'pupil', tag))
        for t in layer([(135, 211), (141, 209), (139, 215)], 'glint', 0.030): out.append((list(t), 'glint', tag))
    # nose: a small pyramid at the tip of the snout
    nl, nr, nb, nt = (-0.22, -1.12, 1.50), (0.22, -1.12, 1.50), (0.0, -1.40, 1.30), (0.0, -1.21, 1.62)
    out += [([nl, nb, nt], 'nose', 'nose'), ([nr, nt, nb], 'nose', 'nose'), ([nl, nt, nr], 'nose_hi', 'nose')]
    return out

def lift(xy, plane_pts, n, d):
    """Put a 2D design point onto the eye's plane (by its x,y), pushed out by d."""
    a = plane_pts[0]
    # plane: n . (p - a) = 0  ->  z = a.z - (n.x (x - a.x) + n.y (y - a.y)) / n.z
    z = a[2] - (n[0] * (xy[0] - a[0]) + n[1] * (xy[1] - a[1])) / n[2]
    return (xy[0] + n[0] * d, xy[1] + n[1] * d, z + n[2] * d)

def normal(t):
    a, b, c = t
    u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
    n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
    l = math.sqrt(sum(x * x for x in n)) or 1
    return tuple(x / l for x in n)

LIGHT = (lambda v: tuple(x / math.sqrt(sum(y * y for y in v)) for x in v))((-0.45, 0.55, 0.70))

def rot(p, yaw, pitch):
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
    x, y, z = p
    x, z = x * cy + z * sy, -x * sy + z * cy          # yaw about Y
    y, z = y * cp - z * sp, y * sp + z * cp            # pitch about X
    return (x, y, z)

def render(tris, yaw=0.0, pitch=0.0, size=360, ss=3, bg=(15, 20, 38)):
    W = size * ss
    img = Image.new('RGB', (W, W), bg)
    dr = ImageDraw.Draw(img)
    cam = 22.0; f = W * 4.6
    items = []
    for t, mat, part in tris:
        r = [rot(p, math.radians(yaw), math.radians(pitch)) for p in t]
        n = normal(r)
        # the fox is drawn facing the viewer: drop faces turned away (cull)
        cx = sum(p[0] for p in r) / 3; cy = sum(p[1] for p in r) / 3; cz = sum(p[2] for p in r) / 3
        view = (-cx, -cy, cam - cz)
        if n[0] * view[0] + n[1] * view[1] + n[2] * view[2] <= 0: continue
        d = max(0.0, sum(n[i] * LIGHT[i] for i in range(3)))
        k = 0.70 + 0.38 * d if mat not in ('glint',) else 1.0
        col = tuple(min(255, int(c * k)) for c in MAT[mat])
        pts = [(W / 2 + f * p[0] / (cam - p[2]) * 0.78, W / 2 - f * (p[1] - 0.05) / (cam - p[2]) * 0.78) for p in r]
        items.append((max(p[2] for p in r) * 0.3 + cz * 0.7, pts, col))
    for _, pts, col in sorted(items, key=lambda i: i[0]):
        dr.polygon(pts, fill=col, outline=col)
    return img.resize((size, size), Image.LANCZOS)

def sheet(path, views):
    tris = build()
    ims = [render(tris, y, p) for y, p in views]
    out = Image.new('RGB', (360 * len(ims), 360))
    for i, im in enumerate(ims): out.paste(im, (360 * i, 0))
    out.save(path)

if __name__ == '__main__':
    sheet(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fox3d.png', [(0, 0), (-25, 0), (-50, 0), (-80, 0), (30, -12)])

def export_js(path):
    """The mesh as a JS module: one flat list per triangle, grouped for animation."""
    tris = build()
    mats = sorted({m for _, m, _ in tris}); parts = ['head', 'nose', 'ear_l', 'ear_r', 'eye_l', 'eye_r']
    rows = []
    for t, mat, part in tris:
        n = normal(t)
        rows.append([round(c, 3) for p in t for c in p] + [round(c, 3) for c in n] + [mats.index(mat), parts.index(part)])
    pivots = {
        'ear_l': [round((P['ear_out'][i] + P['ear_in'][i]) / 2, 3) for i in range(3)],
        'ear_axis_l': [round(P['ear_in'][i] - P['ear_out'][i], 3) for i in range(3)],
        'eye_l': [round(c, 3) for c in (-0.56, -0.22, (P['eye_top'][2] + P['eye_bot'][2]) / 2)],
        'ear_up_l': [round(P['ear_tip'][i] - (P['ear_out'][i] + P['ear_in'][i]) / 2, 3) for i in range(3)],   # for the swivel
        'nose': [0.0, -1.24, 1.50],                                                                        # for the sniff
    }
    body = ('// Generated by tools/fox3d/fox3d.py from the hand-placed design. Do not edit by hand.\n'
            f'// {len(rows)} triangles: 9 position values, 3 normal values, material, part.\n'
            f'export const MATERIALS = {json.dumps({m: MAT[m] for m in mats})};\n'
            f'export const MATERIAL_ORDER = {json.dumps(mats)};\n'
            f'export const PARTS = {json.dumps(parts)};\n'
            f'export const PIVOTS = {json.dumps(pivots)};\n'
            'export const TRIANGLES = [\n' + ',\n'.join(json.dumps(r, separators=(',', ':')) for r in rows) + '\n];\n')
    open(path, 'w').write(body)
    return len(rows)
