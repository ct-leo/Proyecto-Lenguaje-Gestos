# API de Reconocimiento de Manos - Vista01

## Descripción
Esta API implementa el reconocimiento de gestos de mano utilizando Mediapipe en el frontend para detectar letras vocales (A, E, I, O, U). El backend Django solo maneja el almacenamiento de resultados ya procesados en la base de datos temporal.

## Arquitectura
- **Frontend**: Procesa video en tiempo real, detecta manos y reconoce gestos usando Mediapipe desde CDN
- **Backend**: Recibe resultados procesados y los almacena en la base de datos temporal
- **Comunicación**: JSON entre frontend y backend

## Endpoints Disponibles

### 1. GET /vista01/
Sirve la interfaz web del frontend con Mediapipe integrado.

**Response:** HTML con interfaz de reconocimiento de manos

### 2. POST /vista01/guardar-resultado/
Guarda resultados de reconocimiento de manos ya procesados en el frontend.

**Request:**
```json
{
    "imagen": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "letra_detectada": "A",
    "confianza": 0.9,
    "coordenadas_mano": [
        {
            "x": 0.5,
            "y": 0.3,
            "z": 0.1
        }
        // ... más coordenadas (21 landmarks)
    ]
}
```

**Response (Éxito):**
```json
{
    "estado": "exito",
    "letra_detectada": "A",
    "confianza": 0.9,
    "coordenadas_mano": [
        {
            "x": 0.5,
            "y": 0.3,
            "z": 0.1
        }
        // ... más coordenadas
    ],
    "id_temporal": 1,
    "timestamp": "2024-01-15T10:30:00Z",
    "mensaje": "Resultado guardado: vocal \"A\" con confianza 0.90"
}
```

**Response (Error):**
```json
{
    "estado": "error",
    "mensaje": "La letra detectada debe ser una vocal (A, E, I, O, U)"
}
```

### 3. GET /vista01/estadisticas/
Obtiene estadísticas de las detecciones realizadas.

**Response:**
```json
{
    "estado": "exito",
    "total_detecciones": 150,
    "detecciones_por_letra": {
        "A": 30,
        "E": 25,
        "I": 35,
        "O": 30,
        "U": 30
    },
    "datos_entrenados": 75
}
```

## Frontend - Mediapipe desde CDN

### Librerías Cargadas
- `@mediapipe/hands@0.4.1646424915` - Detección de manos
- `@mediapipe/camera_utils@0.3.1646424915` - Utilidades de cámara
- `@mediapipe/drawing_utils@0.3.1620248257` - Utilidades de dibujo

### Funcionalidades del Frontend
- **Acceso a cámara**: Captura video en tiempo real
- **Detección de manos**: Procesa frames con Mediapipe Hands
- **Reconocimiento de gestos**: Detecta vocales A, E, I, O, U
- **Visualización**: Muestra landmarks de la mano en tiempo real
- **Envío de datos**: Envía resultados procesados al backend

## Gestos Reconocidos

### A - Pulgar extendido, otros dedos cerrados
- Pulgar: extendido
- Índice, Medio, Anular, Meñique: doblados

### E - Todos los dedos extendidos
- Todos los dedos: extendidos

### I - Índice y medio extendidos
- Pulgar, Anular, Meñique: doblados
- Índice, Medio: extendidos

### O - Mano cerrada en forma de círculo
- Todos los dedos: doblados
- Pulgar e índice formando círculo

### U - Índice y medio juntos, otros doblados
- Pulgar, Anular, Meñique: doblados
- Índice y Medio: extendidos y juntos

## Base de Datos

### bd_temporal (DatosTemporales)
Almacena temporalmente las detecciones para posterior procesamiento:
- `imagen_base64`: Imagen original capturada
- `letra_detectada`: Vocal detectada (A, E, I, O, U)
- `confianza`: Nivel de confianza (0.0-1.0)
- `coordenadas_mano`: Array de 21 landmarks de Mediapipe
- `timestamp`: Fecha y hora de detección
- `procesado`: Indica si ya fue procesado para entrenamiento

### bd_entrenada (DatosEntrenados)
Almacena datos validados para entrenamiento supervisado:
- `letra_vocal`: Vocal validada
- `coordenadas_mano`: Coordenadas normalizadas
- `caracteristicas`: Características extraídas para ML
- `validado_por_usuario`: Validación manual
- `fuente_temporal`: Referencia al dato temporal original

## Instalación y Configuración

1. Instalar dependencias:
```bash
pip install -r requirements.txt
```

2. Aplicar migraciones:
```bash
python manage.py migrate
```

3. Ejecutar servidor:
```bash
python manage.py runserver
```

4. Abrir navegador:
```
http://localhost:8000/vista01/
```

## Dependencias Principales
- Django 5.2.6
- asgiref 3.9.1
- sqlparse 0.5.3
- tzdata 2025.2

**Nota**: Mediapipe, TensorFlow, OpenCV y otras dependencias pesadas han sido eliminadas del backend y se cargan desde CDN en el frontend.

## Notas Técnicas

### Frontend
- Utiliza Mediapipe Hands para detección de landmarks en tiempo real
- Los gestos se detectan basándose en la posición relativa de los dedos
- Visualización de landmarks de la mano en el canvas
- Procesamiento completamente en el cliente

### Backend
- Solo maneja almacenamiento de resultados ya procesados
- Validación de datos recibidos del frontend
- Sin dependencias de procesamiento de imágenes
- Arquitectura ligera y escalable

### Requisitos del Cliente
- Navegador moderno con soporte para:
  - WebRTC (acceso a cámara)
  - ES6 Modules
  - Canvas API
- Conexión a internet (para cargar Mediapipe desde CDN)

### Flujo de Trabajo
1. Usuario accede a `/vista01/`
2. Frontend carga Mediapipe desde CDN
3. Usuario permite acceso a cámara
4. Frontend procesa video en tiempo real
5. Usuario hace gesto y hace clic en "Capturar y Reconocer"
6. Frontend detecta gesto y envía resultado al backend
7. Backend valida y almacena en `bd_temporal`
8. Frontend muestra resultado al usuario