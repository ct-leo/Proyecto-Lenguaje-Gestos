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


# Indices de features según feature_extractor.extract_feature_vector
# [0..4]   = curls por dedo (thumb,index,middle,ring,pinky)  -> 5
# [5..9]   = extensiones MCP->TIP por dedo                   -> 5
# [10..11] = oposición del pulgar a índice y medio           -> 2
# [12..14] = distancias entre puntas adyacentes              -> 3
# [15..17] = ángulos cos entre direcciones de dedos          -> 3
# [18]     = varianza en Z                                    -> 1
_CURL_IDX = [0, 1, 2, 3, 4]
_EXT_IDX = [5, 6, 7, 8, 9]
_OPP_IDX = [10, 11]      # thumb opposition to index/middle
_TIPS_SPACING_IDX = [12, 13, 14]  # fingertip spacing adjacents
_ANGLE_REL_IDX = [15, 16, 17]     # inter-finger direction cosines


def _matches_shape(fv: List[float], centroid: List[float]) -> bool:
    """Verifica coincidencia estricta por dedo.
    Reglas:
      - Cada curl debe estar cerca del centroid: |curl_i - mu_i| <= CURL_TOL
      - Cada extensión también: |ext_i - mu_i| <= EXT_TOL
    Si alguna regla falla, se rechaza aunque la distancia global pase el umbral.
    """
    if not fv or not centroid:
        return False
    m = min(len(fv), len(centroid))
    if m < 19:
        # vector incompleto
        return False
    CURL_TOL = 0.14   # tolerancia estricta de forma para curl de cada dedo
    EXT_TOL = 0.16    # tolerancia estricta para extensión
    OPP_TOL = 0.12    # oposición del pulgar (más estricta para casos como 'B')
    TIPS_TOL = 0.12   # espaciamiento de puntas (evita dedos demasiado abiertos)
    ANGL_TOL = 0.12   # relaciones angulares entre dedos
    for i in _CURL_IDX:
        if abs(float(fv[i]) - float(centroid[i])) > CURL_TOL:
            return False
    for i in _EXT_IDX:
        if abs(float(fv[i]) - float(centroid[i])) > EXT_TOL:
            return False
    for i in _OPP_IDX:
        if abs(float(fv[i]) - float(centroid[i])) > OPP_TOL:
            return False
    for i in _TIPS_SPACING_IDX:
        if abs(float(fv[i]) - float(centroid[i])) > TIPS_TOL:
            return False
    for i in _ANGLE_REL_IDX:
        if abs(float(fv[i]) - float(centroid[i])) > ANGL_TOL:
            return False
    return True


def compute_thresholds(
    by_letter: Dict[str, List[List[float]]],
    centroids: Dict[str, List[float]],
    percentile: float = 0.90,
) -> Dict[str, float]:
    """Calcula umbral por letra usando percentil (por defecto P95) de las distancias al centroide.

    Esto hace el reconocimiento más estricto y robusto a outliers que media+std.
    """
    thresholds: Dict[str, float] = {}
    MIN_THRESH = 0.60  # umbral mínimo (depende de la escala del feature)
    for letter, vecs in by_letter.items():
        c = centroids.get(letter)
        if not c or not vecs:
            continue
        ds = sorted(_l2(v, c) for v in vecs)
        if not ds:
            continue
        p = max(0.0, min(1.0, percentile))
        idx = int(round(p * (len(ds) - 1)))
        thr = max(MIN_THRESH, ds[idx])
        thresholds[letter] = thr
    return thresholds


def predict_with_thresholds(
    fv: List[float],
    centroids: Dict[str, List[float]],
    thresholds: Dict[str, float],
) -> Tuple[str | None, float, float, bool]:
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
        return None, float("inf"), 0.0, False
    # Gate 1: distancia global bajo umbral por letra
    if not (best_d <= best_thr and best_thr > 0):
        return None, best_d, best_thr, False
    # Gate 2: verificación estricta por dedo (curl/ext)
    c = centroids.get(best)
    ok = (c is not None) and _matches_shape(fv, c)
    if not ok:
        return None, best_d, best_thr, False
    return best, best_d, best_thr, True
