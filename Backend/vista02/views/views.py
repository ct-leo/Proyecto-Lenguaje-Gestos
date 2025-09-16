_MODEL_CACHE: dict | None = None  # {'id':int,'centroids':dict,'thresholds':dict,'letters':list,'feature_version':str}

def _load_latest_model_from_db():
    model = TrainingModel.objects.order_by("-created_at").only(
        "id", "feature_version", "centroids", "letters", "thresholds", "created_at"
    ).first()
    if not model:
        return None
    return {
        "id": model.id,
        "feature_version": model.feature_version,
        "centroids": model.centroids,
        "letters": model.letters,
        "thresholds": getattr(model, 'thresholds', {}) or {},
        "created_at": model.created_at,
    }

def _get_cached_model():
    global _MODEL_CACHE
    if _MODEL_CACHE is None:
        _MODEL_CACHE = _load_latest_model_from_db()
    return _MODEL_CACHE

def _invalidate_model_cache():
    global _MODEL_CACHE
    _MODEL_CACHE = None
"""Views for vista02 with lightweight in-process cache for the latest TrainingModel."""

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count
import json

from ..models import HandSample, TrainingModel
from ..services.feature_extractor import extract_feature_vector
from ..services.trainer import compute_centroids, compute_thresholds, predict_with_thresholds
from django.conf import settings
import os
import re


@csrf_exempt
@require_http_methods(["POST"])
def samples_batch(request):
    """
    Recibe un lote de muestras para una letra.
    Body JSON:
    {
    "letter": "A",
    "samples": [
        {"landmarks": [ {"x":..,"y":..,"z":..}, ... (21) ... ], "feature": [ ... ]},
        ...
    ]
    }
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"status": "error", "message": "JSON inválido"}, status=400)

    import re
    letter = str(payload.get("letter", "")).upper()
    # Aceptar letras estáticas A..Z y Ñ (ampliable si añaden más)
    if not re.match(r"^[A-ZÑ]$", letter):
        return JsonResponse({"status": "error", "message": "Letra inválida"}, status=400)

    samples = payload.get("samples", [])
    if not isinstance(samples, list) or not samples:
        return JsonResponse({"status": "error", "message": "samples vacío"}, status=400)

    to_create = []
    for s in samples:
        lm = s.get("landmarks")
        fv = s.get("feature")
        if not isinstance(lm, list) or len(lm) != 21:
            continue
        # Si no viene feature, lo calculamos aquí
        if fv is None:
            try:
                fv = extract_feature_vector(lm)
            except Exception:
                continue
        to_create.append(HandSample(letter=letter, landmarks=lm, feature_vector=fv))

    if not to_create:
        return JsonResponse({"status": "error", "message": "No se pudieron procesar muestras válidas"}, status=400)

    HandSample.objects.bulk_create(to_create, batch_size=200)

    counts = HandSample.objects.values("letter").annotate(c=Count("id"))
    summary = {row["letter"]: row["c"] for row in counts}

    return JsonResponse({
        "status": "ok",
        "inserted": len(to_create),
        "totals": summary,
    })


@csrf_exempt
@require_http_methods(["POST"])
def train_model(request):
    """
    Recalcula centroides por letra a partir de HandSample.feature_vector y guarda TrainingModel.
    """
    # Recolectar features por letra
    by_letter = {}
    qs = HandSample.objects.all().only("letter", "feature_vector")
    for hs in qs:
        fv = hs.feature_vector
        if not isinstance(fv, list):
            # Recalcular si no existe
            try:
                fv = extract_feature_vector(hs.landmarks)
            except Exception:
                continue
        by_letter.setdefault(hs.letter, []).append(fv)

    if not by_letter:
        return JsonResponse({"status": "error", "message": "No hay muestras para entrenar"}, status=400)

    centroids = compute_centroids(by_letter)
    # Calcular umbrales por percentil (usa valor por defecto en trainer.py)
    thresholds = compute_thresholds(by_letter, centroids)  # devuelve { 'A': thrA, ... }
    model = TrainingModel.objects.create(
        feature_version="v1",
        centroids=centroids,
        letters=sorted(list(by_letter.keys())),
        thresholds=thresholds,
        threshold_method="percentile",
        threshold_param=0.88,
    )
    _invalidate_model_cache()
    return JsonResponse({
        "status": "ok",
        "model_id": model.id,
        "letters": model.letters,
        "centroids": model.centroids,
        "thresholds": model.thresholds,
        "created_at": model.created_at.isoformat(),
    })


@require_http_methods(["GET"])
def progress(request):
    """Devuelve conteo por letra y total."""
    counts = HandSample.objects.values("letter").annotate(c=Count("id"))
    summary = {row["letter"]: row["c"] for row in counts}
    total = sum(summary.values())
    return JsonResponse({"status": "ok", "totals": summary, "total": total})


@require_http_methods(["GET"])
def get_model(request):
    """Devuelve el último modelo entrenado."""
    model_cached = _get_cached_model()
    if not model_cached:
        return JsonResponse({"status": "error", "message": "Modelo no encontrado"}, status=404)
    return JsonResponse({
        "status": "ok",
        "model_id": model_cached["id"],
        "feature_version": model_cached.get("feature_version"),
        "centroids": model_cached.get("centroids"),
        "letters": model_cached.get("letters"),
        "thresholds": model_cached.get("thresholds", {}),
        "threshold_method": 'percentile',
        "threshold_param": 0.88,
        "created_at": model_cached.get("created_at").isoformat() if model_cached.get("created_at") else None,
    })


@require_http_methods(["GET"])
def last_detected(request):
    """Devuelve la última letra que se guardó (última muestra)."""
    hs = HandSample.objects.order_by("-created_at").first()
    if not hs:
        return JsonResponse({"status": "ok", "letter": None})
    return JsonResponse({"status": "ok", "letter": hs.letter, "created_at": hs.created_at.isoformat()})

# Create your views here.


@require_http_methods(["GET"])
def demo(request):
    """Sirve el archivo ejemplo2_frontend.html desde la raíz del proyecto para evitar CORS."""
    root = str(getattr(settings, 'BASE_DIR', '.'))
    html_path = os.path.join(root, 'ejemplo2_frontend.html')
    if not os.path.exists(html_path):
        return JsonResponse({"status": "error", "message": "ejemplo2_frontend.html no encontrado"}, status=404)
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
        from django.http import HttpResponse
        return HttpResponse(content, content_type='text/html; charset=utf-8')
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


# Nota: endpoints de purga/eliminación específicos fueron retirados para simplificar la API.


# Nota: endpoint reset_letter retirado.


@csrf_exempt
@require_http_methods(["POST"])
def reset_data(request):
    """Elimina todas las muestras y modelos entrenados."""
    try:
        HandSample.objects.all().delete()
        TrainingModel.objects.all().delete()
        _invalidate_model_cache()
        return JsonResponse({"status": "ok", "message": "Datos reiniciados"})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reset_letter(request):
    """Elimina todas las muestras de una letra específica y borra los modelos entrenados.

    Body JSON: { "letter": "A" }
    Acepta A..Z y Ñ.
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"status": "error", "message": "JSON inválido"}, status=400)

    letter = str(payload.get("letter", "")).upper()
    if not re.match(r"^[A-ZÑ]$", letter):
        return JsonResponse({"status": "error", "message": "Letra inválida"}, status=400)

    try:
        # Eliminar muestras de la letra
        HandSample.objects.filter(letter=letter).delete()
        # Actualizar modelos entrenados: quitar solo la letra seleccionada
        to_delete_ids = []
        for m in TrainingModel.objects.all():
            # Copias mutables de los campos JSON
            centroids = dict(m.centroids or {})
            thresholds = dict(getattr(m, 'thresholds', {}) or {})
            letters_list = list(m.letters or [])
            changed = False
            if letter in centroids:
                centroids.pop(letter, None)
                changed = True
            if letter in thresholds:
                thresholds.pop(letter, None)
                changed = True
            if letter in letters_list:
                letters_list = [L for L in letters_list if L != letter]
                changed = True
            # Si tras quitar la letra no quedan letras, marcar para borrar el modelo
            if changed and not letters_list:
                to_delete_ids.append(m.id)
                continue
            if changed:
                m.centroids = centroids
                m.thresholds = thresholds
                m.letters = letters_list
                m.save(update_fields=["centroids", "thresholds", "letters"])
        if to_delete_ids:
            TrainingModel.objects.filter(id__in=to_delete_ids).delete()
        _invalidate_model_cache()
        # Devolver resumen actualizado
        counts = HandSample.objects.values("letter").annotate(c=Count("id"))
        summary = {row["letter"]: row["c"] for row in counts}
        total = sum(summary.values())
        latest = _get_cached_model()
        out_model_letters = latest.get("letters") if latest else None
        return JsonResponse({
            "status": "ok",
            "message": f"Letra {letter} eliminada de muestras y modelos actualizados",
            "totals": summary,
            "total": total,
            "model_letters": out_model_letters,
        })
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def predict(request):
    """Reconocimiento en backend.

    Body JSON:
    {
      "landmarks": [ {"x":..,"y":..,"z":..}, ... 21 ... ],
      "feature": [ ... ]  // opcional
    }

    Devuelve: {"status":"ok", "letter": "A" | null, "distance": float, "threshold": float}
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"status": "error", "message": "JSON inválido"}, status=400)

    lms = payload.get("landmarks")
    fv = payload.get("feature")
    dynamic = bool(payload.get("dynamic", False))
    # Preferimos extraer en servidor para asegurar coherencia con el modelo entrenado
    if isinstance(lms, list) and len(lms) == 21:
        try:
            fv = extract_feature_vector(lms)
        except Exception:
            return JsonResponse({"status": "error", "message": "no se pudo extraer feature"}, status=400)
    elif fv is None:
        return JsonResponse({"status": "error", "message": "landmarks o feature faltan"}, status=400)

    # Cargar último modelo (centroides) usando caché en memoria
    model_cached = _get_cached_model()
    if not model_cached:
        return JsonResponse({"status": "ok", "letter": None, "distance": None, "threshold": None})

    centroids = model_cached["centroids"] or {}
    thresholds = model_cached.get("thresholds", {}) or {}
    letter, dist, thr, shape_ok = predict_with_thresholds(fv, centroids, thresholds)
    # Además, calcular candidato más cercano (aunque no pase umbral) para diagnóstico
    bestL = None
    bestD = float('inf')
    for L, c in centroids.items():
        # l2 aquí replicando trainer._l2 para evitar import interno
        m = min(len(fv), len(c))
        s = 0.0
        for i in range(m):
            d = float(fv[i]) - float(c[i])
            s += d * d
        dL = s ** 0.5
        if dL < bestD:
            bestD = dL
            bestL = L
    # Aceptación suave para gestos dinámicos (p. ej., 'J') cuando dynamic=true
    accepted_dynamic = False
    DYNAMIC_LETTERS = {"J", "Ñ", "Z"}
    if dynamic and (letter is None) and (bestL in DYNAMIC_LETTERS):
        thr_best = float(thresholds.get(bestL, 0.0) or 0.0)
        # margen de aceptación cercano al umbral para dinámicos
        if thr_best > 0 and bestD <= (thr_best * 1.6):
            letter = bestL
            dist = bestD
            thr = thr_best
            # la forma estricta puede no cumplirse en movimiento
            shape_ok = False
            accepted_dynamic = True

    return JsonResponse({
        "status": "ok",
        "letter": letter,
        "distance": dist,
        "threshold": thr,
        "shape_ok": bool(shape_ok),
        "candidate": bestL,
        "candidate_distance": bestD,
        "accepted_dynamic": accepted_dynamic,
        "dynamic": dynamic,
    })
