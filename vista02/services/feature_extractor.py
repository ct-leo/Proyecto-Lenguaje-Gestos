from typing import List, Dict
import math

# Landmarks: list of 21 dicts with keys x,y,z in normalized image coordinates
# Output: richer, normalized feature vector robust to translation/scale and sensitive a la forma (A..Z)

def _dist(a, b):
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    dz = a[2] - b[2]
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def _to_tuple_list(landmarks: List[Dict[str, float]]):
    return [(float(p.get("x", 0.0)), float(p.get("y", 0.0)), float(p.get("z", 0.0))) for p in landmarks]


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _norm(v):
    n = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if n < 1e-9:
        return (0.0, 0.0, 0.0)
    return (v[0] / n, v[1] / n, v[2] / n)


def _angle_cos(a, b):
    va = _norm(a)
    vb = _norm(b)
    c = max(-1.0, min(1.0, _dot(va, vb)))
    return c  # cosinus of angle


def _cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def extract_feature_vector(landmarks: List[Dict[str, float]]) -> List[float]:
    """Return a shape descriptor invariant to translation and scale.

    Steps:
      - center at wrist (0)
      - scale by palm size + MCP spread
      - per-finger: curl (cos angle), extension length (MCP->TIP)
      - thumb opposition: distances tip(4) to index/middle tips
      - fingertip spacing: adjacent tips distances
      - finger direction relations: angles between finger directions
      - z spread summary
    """
    pts = _to_tuple_list(landmarks)
    if len(pts) != 21:
        raise ValueError("expected 21 landmarks")

    wrist = pts[0]
    pts_rel = [(p[0] - wrist[0], p[1] - wrist[1], p[2] - wrist[2]) for p in pts]

    # scale factor based on palm size (wrist to middle_mcp) and finger spread
    middle_mcp = pts_rel[9]
    base = _dist((0.0, 0.0, 0.0), middle_mcp)
    mcp_points = [pts_rel[5], pts_rel[9], pts_rel[13], pts_rel[17]]
    spread = sum(_dist(mcp_points[i], mcp_points[i + 1]) for i in range(3)) / 3.0
    scale = max(1e-6, base + spread)
    Pn = [(p[0] / scale, p[1] / scale, p[2] / scale) for p in pts_rel]

    # Palm-local canonical frame for rotation invariance
    # x-axis: index_mcp->pinky_mcp, y-axis: wrist->middle_mcp, z-axis: normal
    idx_mcp = Pn[5]
    mid_mcp = Pn[9]
    rng_mcp = Pn[13]
    pky_mcp = Pn[17]
    vx = _norm(_sub(pky_mcp, idx_mcp))
    vy_temp = _norm(_sub(mid_mcp, (0.0, 0.0, 0.0)))
    vz = _norm(_cross(vx, vy_temp))
    # recompute vy to be orthonormal
    vy = _norm(_cross(vz, vx))

    def _to_local(p):
        # project onto local basis vectors
        return (
            _dot(p, vx),
            _dot(p, vy),
            _dot(p, vz),
        )

    P = [_to_local(p) for p in Pn]

    # Indices de articulaciones
    # thumb:    CMC(1), MCP(2), IP(3), TIP(4)
    # index:    MCP(5), PIP(6), DIP(7), TIP(8)
    # middle:   MCP(9), PIP(10), DIP(11), TIP(12)
    # ring:     MCP(13), PIP(14), DIP(15), TIP(16)
    # pinky:    MCP(17), PIP(18), DIP(19), TIP(20)
    fingers = {
        "thumb": (2, 3, 4),
        "index": (5, 6, 8),
        "middle": (9, 10, 12),
        "ring": (13, 14, 16),
        "pinky": (17, 18, 20),
    }

    feat: List[float] = []

    # 1) Curl por dedo (cos ang entre MCP->PIP y PIP->TIP). 5 valores
    for name, (mcp_i, pip_i, tip_i) in fingers.items():
        v1 = _sub(P[pip_i], P[mcp_i])
        v2 = _sub(P[tip_i], P[pip_i])
        curl = _angle_cos(v1, v2)  # 1: recto, -1: completamente doblado
        feat.append(curl)

    # 2) Extensión (longitud MCP->TIP normalizada). 5 valores
    for name, (mcp_i, _pip_i, tip_i) in fingers.items():
        ext = _dist(P[tip_i], P[mcp_i])
        feat.append(ext)

    # 3) Oposición del pulgar (distancia del tip(4) a index tip(8) y middle tip(12)). 2 valores
    opp1 = _dist(P[4], P[8])
    opp2 = _dist(P[4], P[12])
    feat.extend([opp1, opp2])

    # 4) Espaciado de puntas adyacentes: (8-12, 12-16, 16-20). 3 valores
    tip_pairs = [(8, 12), (12, 16), (16, 20)]
    for a, b in tip_pairs:
        feat.append(_dist(P[a], P[b]))

    # 5) Dirección relativa entre dedos (ángulo cos entre direcciones MCP->TIP)
    dirs = [
        _sub(P[8], P[5]),   # index dir
        _sub(P[12], P[9]),  # middle dir
        _sub(P[16], P[13]), # ring dir
        _sub(P[20], P[17]), # pinky dir
    ]
    feat.append(_angle_cos(dirs[0], dirs[1]))
    feat.append(_angle_cos(dirs[1], dirs[2]))
    feat.append(_angle_cos(dirs[2], dirs[3]))

    # 6) Dispersión en Z (profundidad). 1 valor
    zs = [p[2] for p in P]
    mean_z = sum(zs) / len(zs)
    var_z = sum((z - mean_z) * (z - mean_z) for z in zs) / len(zs)
    feat.append(var_z)

    return feat
