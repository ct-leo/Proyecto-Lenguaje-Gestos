from typing import Dict, List, Tuple

# Input: by_letter = {"A": [[f1..],[f1..],...], "B": [...], ...}
# Output: {"A": [centroid], "B": [centroid], ...}

def _mean(vecs: List[List[float]]) -> List[float]:
    if not vecs:
        return []
    n = len(vecs)
    m = len(vecs[0])
    acc = [0.0] * m
    for v in vecs:
        if len(v) != m:
            continue
        for i in range(m):
            acc[i] += float(v[i])
    return [x / max(1, n) for x in acc]


def compute_centroids(by_letter: Dict[str, List[List[float]]]) -> Dict[str, List[float]]:
    centroids: Dict[str, List[float]] = {}
    for letter, vecs in by_letter.items():
        if not vecs:
            continue
        centroids[letter] = _mean(vecs)
    return centroids


# ========== Reconocimiento ==========
def _l2(a: List[float], b: List[float]) -> float:
    m = min(len(a), len(b))
    s = 0.0
    for i in range(m):
        d = float(a[i]) - float(b[i])
        s += d * d
    return s ** 0.5


def compute_thresholds(
    by_letter: Dict[str, List[List[float]]],
    centroids: Dict[str, List[float]],
    k_std: float = 2.0,
) -> Dict[str, float]:
    """Para cada letra calcula un umbral de aceptación = media(distancias) + k_std*std.

    Si una letra tiene muy pocas muestras, usa un umbral mínimo razonable.
    """
    thresholds: Dict[str, float] = {}
    MIN_THRESH = 0.25  # umbral mínimo (depende de la escala del feature)
    for letter, vecs in by_letter.items():
        c = centroids.get(letter)
        if not c or not vecs:
            continue
        ds = [_l2(v, c) for v in vecs]
        if not ds:
            continue
        mean = sum(ds) / len(ds)
        var = sum((d - mean) ** 2 for d in ds) / len(ds)
        std = var ** 0.5
        thr = max(MIN_THRESH, mean + k_std * std)
        thresholds[letter] = thr
    return thresholds


def predict_with_thresholds(
    fv: List[float],
    centroids: Dict[str, List[float]],
    thresholds: Dict[str, float],
) -> Tuple[str | None, float, float]:
    """Devuelve (letra_o_none, distancia_best, umbral_best).

    Solo acepta si distancia <= umbral de la letra. Si no hay centroides, devuelve (None, inf, 0).
    """
    best = None
    best_d = float("inf")
    best_thr = 0.0
    for L, c in centroids.items():
        d = _l2(fv, c)
        if d < best_d:
            best_d = d
            best = L
            best_thr = thresholds.get(L, 0.0)
    if best is None:
        return None, float("inf"), 0.0
    if best_d <= best_thr and best_thr > 0:
        return best, best_d, best_thr
    return None, best_d, best_thr
