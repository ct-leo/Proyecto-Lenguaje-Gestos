import json
import os
from django.http import JsonResponse, HttpResponse
from django.conf import settings
import logging

# Configurar logging
logger = logging.getLogger(__name__)


def guardar_resultado_mano(request):
    """
    Endpoint deshabilitado en vista01: almacenamiento ahora es exclusivamente en localStorage del navegador.
    """
    return JsonResponse({'estado': 'error', 'mensaje': 'Endpoint deshabilitado. Use localStorage (localStorageVista01).'}, status=410)


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


def estadisticas_deteccion(request):
    """
    Endpoint deshabilitado en vista01: estadísticas se gestionan en el cliente usando localStorage.
    """
    return JsonResponse({'estado': 'error', 'mensaje': 'Endpoint deshabilitado. Use localStorage.'}, status=410)
