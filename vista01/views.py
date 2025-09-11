import json
import os
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from .models import DatosTemporales, DatosEntrenados
import logging

# Configurar logging
logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def guardar_resultado_mano(request):
    """
    Endpoint para guardar resultados de reconocimiento de manos ya procesados en el frontend
    """
    try:
        # Obtener datos del request
        try:
            data = json.loads(request.body)
            imagen_base64 = data.get('imagen')
            letra_detectada = data.get('letra_detectada')
            confianza = data.get('confianza')
            coordenadas_mano = data.get('coordenadas_mano')
            
            # Validar datos requeridos
            if not imagen_base64:
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'No se proporcionó imagen en base64'
                }, status=400)
                
            if not letra_detectada:
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'No se proporcionó letra detectada'
                }, status=400)
                
            if confianza is None:
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'No se proporcionó nivel de confianza'
                }, status=400)
                
            if not coordenadas_mano:
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'No se proporcionaron coordenadas de la mano'
                }, status=400)
                
            # Validar que la letra sea una vocal válida
            if letra_detectada not in ['A', 'E', 'I', 'O', 'U']:
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'La letra detectada debe ser una vocal (A, E, I, O, U)'
                }, status=400)
                
            # Validar rango de confianza
            if not (0.0 <= confianza <= 1.0):
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'La confianza debe estar entre 0.0 y 1.0'
                }, status=400)
                
        except json.JSONDecodeError:
            return JsonResponse({
                'estado': 'error',
                'mensaje': 'Formato JSON inválido'
            }, status=400)
        
        # Guardar en base de datos temporal
        try:
            dato_temporal = DatosTemporales.objects.create(
                imagen_base64=imagen_base64,
                letra_detectada=letra_detectada,
                confianza=float(confianza),
                coordenadas_mano=coordenadas_mano
            )
            
            # Respuesta exitosa
            return JsonResponse({
                'estado': 'exito',
                'letra_detectada': letra_detectada,
                'confianza': float(confianza),
                'coordenadas_mano': coordenadas_mano,
                'id_temporal': dato_temporal.id,
                'timestamp': dato_temporal.timestamp.isoformat(),
                'mensaje': f'Resultado guardado: vocal "{letra_detectada}" con confianza {float(confianza):.2f}'
            })
            
        except Exception as e:
            logger.error(f"Error guardando en base de datos: {str(e)}")
            return JsonResponse({
                'estado': 'error',
                'mensaje': 'Error al guardar en la base de datos'
            }, status=500)
            
    except Exception as e:
        logger.error(f"Error general en guardar_resultado_mano: {str(e)}")
        return JsonResponse({
            'estado': 'error',
            'mensaje': 'Error interno del servidor'
        }, status=500)


def frontend_view(request):
    """
    Vista para servir el archivo HTML del frontend
    """
    try:
        # Ruta al archivo HTML del frontend
        html_path = os.path.join(settings.BASE_DIR, 'ejemplo_frontend.html')
        
        with open(html_path, 'r', encoding='utf-8') as file:
            html_content = file.read()
        
        return HttpResponse(html_content, content_type='text/html')
        
    except FileNotFoundError:
        return HttpResponse('Archivo frontend no encontrado', status=404)
    except Exception as e:
        logger.error(f"Error sirviendo frontend: {str(e)}")
        return HttpResponse('Error interno del servidor', status=500)


@require_http_methods(["GET"])
def estadisticas_deteccion(request):
    """
    Endpoint para obtener estadísticas de las detecciones
    """
    try:
        total_detecciones = DatosTemporales.objects.count()
        detecciones_por_letra = {}
        
        for letra in ['A', 'E', 'I', 'O', 'U']:
            count = DatosTemporales.objects.filter(letra_detectada=letra).count()
            detecciones_por_letra[letra] = count
        
        return JsonResponse({
            'estado': 'exito',
            'total_detecciones': total_detecciones,
            'detecciones_por_letra': detecciones_por_letra,
            'datos_entrenados': DatosEntrenados.objects.count()
        })
        
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas: {str(e)}")
        return JsonResponse({
            'estado': 'error',
            'mensaje': 'Error al obtener estadísticas'
        }, status=500)
