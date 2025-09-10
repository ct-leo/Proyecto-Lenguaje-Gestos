from django.db import models
from django.utils import timezone


class DatosTemporales(models.Model):
    """
    Modelo para bd.temporal - Almacena datos de reconocimiento temporal
    """
    imagen_base64 = models.TextField(help_text="Imagen en formato base64")
    letra_detectada = models.CharField(max_length=1, help_text="Letra vocal detectada (A, E, I, O, U)")
    confianza = models.FloatField(help_text="Nivel de confianza de la detección (0.0 - 1.0)")
    coordenadas_mano = models.JSONField(help_text="Coordenadas de los puntos de la mano detectada")
    timestamp = models.DateTimeField(default=timezone.now, help_text="Fecha y hora de la detección")
    procesado = models.BooleanField(default=False, help_text="Indica si ya fue procesado para entrenamiento")
    
    class Meta:
        db_table = 'bd_temporal'
        verbose_name = 'Dato Temporal'
        verbose_name_plural = 'Datos Temporales'
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"Detección {self.letra_detectada} - {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"


class DatosEntrenados(models.Model):
    """
    Modelo para bd.entrenada - Almacena datos validados para entrenamiento supervisado
    """
    letra_vocal = models.CharField(max_length=1, choices=[
        ('A', 'A'),
        ('E', 'E'), 
        ('I', 'I'),
        ('O', 'O'),
        ('U', 'U')
    ], help_text="Letra vocal validada")
    coordenadas_mano = models.JSONField(help_text="Coordenadas normalizadas de los puntos de la mano")
    caracteristicas = models.JSONField(help_text="Características extraídas para el modelo de ML")
    validado_por_usuario = models.BooleanField(default=False, help_text="Indica si fue validado manualmente")
    timestamp_entrenamiento = models.DateTimeField(default=timezone.now, help_text="Fecha de inclusión en entrenamiento")
    fuente_temporal = models.ForeignKey(
        DatosTemporales, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        help_text="Referencia al dato temporal original"
    )
    
    class Meta:
        db_table = 'bd_entrenada'
        verbose_name = 'Dato Entrenado'
        verbose_name_plural = 'Datos Entrenados'
        ordering = ['-timestamp_entrenamiento']
    
    def __str__(self):
        return f"Entrenamiento {self.letra_vocal} - {self.timestamp_entrenamiento.strftime('%Y-%m-%d %H:%M:%S')}"
