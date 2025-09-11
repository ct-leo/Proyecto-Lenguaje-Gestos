# Estructura del Proyecto - Vista 01

## Implementación Completada ✅

### App Vista01 - Reconocimiento de Manos
- **Mediapipe Integration**: Configurado en `apps.py` para inicialización automática
- **Modelos de Base de Datos**:
  - `DatosTemporales` (bd.temporal): Almacena detecciones temporales
  - `DatosEntrenados` (bd.entrenada): Almacena datos para entrenamiento supervisado
- **API Endpoints**:
  - `POST /vista01/reconocer/`: Reconoce gestos de mano desde imagen base64
  - `GET /vista01/estadisticas/`: Obtiene estadísticas de detecciones
- **Detección de Gestos**: Implementa reconocimiento de vocales A, E, I, O, U
- **Respuestas JSON**: Formato estandarizado con estado, datos y mensajes

### Archivos Creados/Modificados:
- `vista01/apps.py` - Inicialización de Mediapipe
- `vista01/models.py` - Modelos de base de datos
- `vista01/views.py` - Lógica de reconocimiento y endpoints
- `vista01/urls.py` - Mapeo de rutas
- `core/urls.py` - Inclusión de rutas de vista01
- `core/settings.py` - Configuración de app y corrección de URLs
- `manage.py` - Corrección de configuración de Django
- `requirements.txt` - Dependencias actualizadas
- `API_DOCUMENTATION.md` - Documentación completa de la API
- `ejemplo_frontend.html` - Ejemplo de uso desde frontend

### Próximas Vistas:
- Vista 02: [Por implementar]
- Vista 03: [Por implementar]
