from django.db import models
from django.utils import timezone

# Letras válidas A..Z
LETTER_CHOICES = [(chr(c), chr(c)) for c in range(ord('A'), ord('Z') + 1)]

class HandSample(models.Model):
    letter = models.CharField(max_length=1, choices=LETTER_CHOICES)
    # Landmarks crudos de MediaPipe: lista de 21 elementos con x,y,z normalizados
    landmarks = models.JSONField()
    # Vector de características preprocesado (opcional si se envía desde el cliente)
    feature_vector = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["letter", "created_at"]),
        ]
        ordering = ["-created_at"]

class TrainingModel(models.Model):
    created_at = models.DateTimeField(default=timezone.now)
    feature_version = models.CharField(max_length=32, default="v1")
    # Centroides por letra: {"A": [...], "B": [...], ...}
    centroids = models.JSONField()
    letters = models.JSONField()  # lista de letras incluidas
    # Umbrales por letra persistidos tras el entrenamiento
    thresholds = models.JSONField(default=dict)
    # Desviaciones estándar por letra (lista por feature) para distancia estandarizada
    feature_stds = models.JSONField(default=dict)
    # Metadata opcional sobre cómo fueron calculados los umbrales
    threshold_method = models.CharField(max_length=32, default="percentile")
    threshold_param = models.FloatField(default=0.88)  # p.ej., percentil usado

    class Meta:
        ordering = ["-created_at"]
