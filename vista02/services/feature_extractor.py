from typing import List, Dict
import math

# Landmarks: list of 21 dicts with keys x,y,z in normalized image coordinates
# Output: small, normalized feature vector robust to scale/translation

def _dist(a, b):
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    dz = a[2] - b[2]
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def _to_tuple_list(landmarks: List[Dict[str, float]]):
    return [(float(p.get("x", 0.0)), float(p.get("y", 0.0)), float(p.get("z", 0.0))) for p in landmarks]


def extract_feature_vector(landmarks: List[Dict[str, float]]) -> List[float]:
    """
    Convert 21 landmarks into a compact feature vector.
    Steps:
      - translate by wrist (0)
      - scale by hand size (wrist to middle_mcp length + spread)
      - include finger bend distances tip-pip, pip-mcp for 5 fingers
      - include pairwise tips distances (index-middle, middle-ring, ring-pinky)
    """
    pts = _to_tuple_list(landmarks)
    if len(pts) != 21:
        raise ValueError("expected 21 landmarks")

    wrist = pts[0]
    # translate
    pts_rel = [(p[0] - wrist[0], p[1] - wrist[1], p[2] - wrist[2]) for p in pts]

    # scale factor based on palm size (wrist to middle_mcp) and finger spread
    middle_mcp = pts_rel[9]
    base = _dist((0.0, 0.0, 0.0), middle_mcp)
    # spread among MCPs of index (5), middle (9), ring (13), pinky (17)
    mcp_points = [pts_rel[5], pts_rel[9], pts_rel[13], pts_rel[17]]
    spread = sum(_dist(mcp_points[i], mcp_points[i + 1]) for i in range(3)) / 3.0
    scale = max(1e-6, base + spread)
    pts_n = [(p[0] / scale, p[1] / scale, p[2] / scale) for p in pts_rel]

    # finger indices
    fingers = {
        "thumb": (2, 3, 4),
        "index": (5, 6, 8),
        "middle": (9, 10, 12),
        "ring": (13, 14, 16),
        "pinky": (17, 18, 20),
    }

    feat: List[float] = []
    # per finger distances tip-pip, pip-mcp
    for name, (mcp_i, pip_i, tip_i) in fingers.items():
        tip = pts_n[tip_i]
        pip = pts_n[pip_i]
        mcp = pts_n[mcp_i]
        feat.append(_dist(tip, pip))
        feat.append(_dist(pip, mcp))

    # tips distances between adjacent fingers (index-middle, middle-ring, ring-pinky)
    tip_indices = [8, 12, 16, 20]
    for i in range(len(tip_indices) - 1):
        a = pts_n[tip_indices[i]]
        b = pts_n[tip_indices[i + 1]]
        feat.append(_dist(a, b))

    # also include z spread summary (std-like proxy)
    zs = [p[2] for p in pts_n]
    mean_z = sum(zs) / len(zs)
    var_z = sum((z - mean_z) * (z - mean_z) for z in zs) / len(zs)
    feat.append(var_z)

    return feat
