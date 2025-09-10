import base64
import json
import numpy as np
import cv2
from PIL import Image
from io import BytesIO
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import DatosTemporales, DatosEntrenados
import logging

# Configurar logging
logger = logging.getLogger(__name__)

# Variables globales para Mediapipe (inicializadas en apps.py)
mp_hands = None
hands = None
mp_drawing = None


def detectar_gesto_vocal(landmarks):
    """
    Detecta el gesto de la mano y lo traduce a letras vocales (A, E, I, O, U)
    basándose en la posición de los dedos y la forma de la mano
    """
    try:
        # Extraer coordenadas de puntos clave
        # Pulgar
        thumb_tip = landmarks[4]
        thumb_ip = landmarks[3]
        thumb_mcp = landmarks[2]
        
        # Índice
        index_tip = landmarks[8]
        index_pip = landmarks[6]
        index_mcp = landmarks[5]
        
        # Medio
        middle_tip = landmarks[12]
        middle_pip = landmarks[10]
        middle_mcp = landmarks[9]
        
        # Anular
        ring_tip = landmarks[16]
        ring_pip = landmarks[14]
        ring_mcp = landmarks[13]
        
        # Meñique
        pinky_tip = landmarks[20]
        pinky_pip = landmarks[18]
        pinky_mcp = landmarks[17]
        
        # Muñeca
        wrist = landmarks[0]
        
        # Función auxiliar para calcular si un dedo está extendido
        def dedo_extendido(tip, pip, mcp):
            return tip.y < pip.y and pip.y < mcp.y
        
        # Función auxiliar para calcular si un dedo está doblado
        def dedo_doblado(tip, pip, mcp):
            return tip.y > pip.y and pip.y > mcp.y
        
        # Detectar gestos específicos para cada vocal
        
        # A - Mano cerrada con pulgar extendido
        if (dedo_extendido(thumb_tip, thumb_ip, thumb_mcp) and
            dedo_doblado(index_tip, index_pip, index_mcp) and
            dedo_doblado(middle_tip, middle_pip, middle_mcp) and
            dedo_doblado(ring_tip, ring_pip, ring_mcp) and
            dedo_doblado(pinky_tip, pinky_pip, pinky_mcp)):
            return 'A', 0.9
        
        # E - Todos los dedos extendidos
        elif (dedo_extendido(thumb_tip, thumb_ip, thumb_mcp) and
              dedo_extendido(index_tip, index_pip, index_mcp) and
              dedo_extendido(middle_tip, middle_pip, middle_mcp) and
              dedo_extendido(ring_tip, ring_pip, ring_mcp) and
              dedo_extendido(pinky_tip, pinky_pip, pinky_mcp)):
            return 'E', 0.9
        
        # I - Solo índice y medio extendidos
        elif (dedo_doblado(thumb_tip, thumb_ip, thumb_mcp) and
              dedo_extendido(index_tip, index_pip, index_mcp) and
              dedo_extendido(middle_tip, middle_pip, middle_mcp) and
              dedo_doblado(ring_tip, ring_pip, ring_mcp) and
              dedo_doblado(pinky_tip, pinky_pip, pinky_mcp)):
            return 'I', 0.8
        
        # O - Mano cerrada en forma de círculo
        elif (dedo_doblado(thumb_tip, thumb_ip, thumb_mcp) and
              dedo_doblado(index_tip, index_pip, index_mcp) and
              dedo_doblado(middle_tip, middle_pip, middle_mcp) and
              dedo_doblado(ring_tip, ring_pip, ring_mcp) and
              dedo_doblado(pinky_tip, pinky_pip, pinky_mcp) and
              abs(thumb_tip.x - index_tip.x) < 0.1):
            return 'O', 0.8
        
        # U - Índice y medio juntos, otros doblados
        elif (dedo_doblado(thumb_tip, thumb_ip, thumb_mcp) and
              dedo_extendido(index_tip, index_pip, index_mcp) and
              dedo_extendido(middle_tip, middle_pip, middle_mcp) and
              dedo_doblado(ring_tip, ring_pip, ring_mcp) and
              dedo_doblado(pinky_tip, pinky_pip, pinky_mcp) and
              abs(index_tip.x - middle_tip.x) < 0.05):
            return 'U', 0.8
        
        else:
            return None, 0.0
            
    except Exception as e:
        logger.error(f"Error en detección de gesto: {str(e)}")
        return None, 0.0


@csrf_exempt
@require_http_methods(["POST"])
def reconocer_mano(request):
    """
    Endpoint para reconocer gestos de mano desde imagen base64
    """
    try:
        # Verificar que Mediapipe esté inicializado
        if hands is None:
            return JsonResponse({
                'estado': 'error',
                'mensaje': 'Mediapipe no está inicializado correctamente'
            }, status=500)
        
        # Obtener datos del request
        try:
            data = json.loads(request.body)
            imagen_base64 = data.get('imagen')
            
            if not imagen_base64:
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'No se proporcionó imagen en base64'
                }, status=400)
                
        except json.JSONDecodeError:
            return JsonResponse({
                'estado': 'error',
                'mensaje': 'Formato JSON inválido'
            }, status=400)
        
        # Decodificar imagen base64
        try:
            # Remover prefijo data:image si existe
            if ',' in imagen_base64:
                imagen_base64 = imagen_base64.split(',')[1]
            
            imagen_bytes = base64.b64decode(imagen_base64)
            imagen = Image.open(BytesIO(imagen_bytes))
            
            # Convertir a formato OpenCV
            imagen_cv = cv2.cvtColor(np.array(imagen), cv2.COLOR_RGB2BGR)
            
        except Exception as e:
            logger.error(f"Error decodificando imagen: {str(e)}")
            return JsonResponse({
                'estado': 'error',
                'mensaje': 'Error al procesar la imagen base64'
            }, status=400)
        
        # Procesar con Mediapipe
        try:
            imagen_rgb = cv2.cvtColor(imagen_cv, cv2.COLOR_BGR2RGB)
            resultados = hands.process(imagen_rgb)
            
            if not resultados.multi_hand_landmarks:
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'No se detectó ninguna mano en la imagen'
                }, status=400)
            
            # Obtener la primera mano detectada
            mano_landmarks = resultados.multi_hand_landmarks[0]
            
            # Detectar gesto vocal
            letra_detectada, confianza = detectar_gesto_vocal(mano_landmarks.landmark)
            
            if letra_detectada is None:
                return JsonResponse({
                    'estado': 'error',
                    'mensaje': 'No se pudo reconocer un gesto vocal válido (A, E, I, O, U)'
                }, status=400)
            
            # Extraer coordenadas de la mano
            coordenadas_mano = []
            for landmark in mano_landmarks.landmark:
                coordenadas_mano.append({
                    'x': float(landmark.x),
                    'y': float(landmark.y),
                    'z': float(landmark.z)
                })
            
            # Guardar en base de datos temporal
            dato_temporal = DatosTemporales.objects.create(
                imagen_base64=imagen_base64,
                letra_detectada=letra_detectada,
                confianza=confianza,
                coordenadas_mano=coordenadas_mano
            )
            
            # Respuesta exitosa
            return JsonResponse({
                'estado': 'exito',
                'letra_detectada': letra_detectada,
                'confianza': confianza,
                'coordenadas_mano': coordenadas_mano,
                'id_temporal': dato_temporal.id,
                'timestamp': dato_temporal.timestamp.isoformat(),
                'mensaje': f'Gesto reconocido como vocal "{letra_detectada}" con confianza {confianza:.2f}'
            })
            
        except Exception as e:
            logger.error(f"Error procesando con Mediapipe: {str(e)}")
            return JsonResponse({
                'estado': 'error',
                'mensaje': 'Error al procesar la imagen con Mediapipe'
            }, status=500)
            
    except Exception as e:
        logger.error(f"Error general en reconocer_mano: {str(e)}")
        return JsonResponse({
            'estado': 'error',
            'mensaje': 'Error interno del servidor'
        }, status=500)


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
