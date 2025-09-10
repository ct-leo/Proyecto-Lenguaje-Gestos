# API de Reconocimiento de Manos - Vista01

## Descripción
Esta API implementa el reconocimiento de gestos de mano utilizando Mediapipe y TensorFlow para detectar letras vocales (A, E, I, O, U) desde imágenes en base64.

## Endpoints Disponibles

### 1. POST /vista01/reconocer/
Reconoce gestos de mano desde una imagen en base64.

**Request:**
```json
{
    "imagen": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
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
    "mensaje": "Gesto reconocido como vocal \"A\" con confianza 0.90"
}
```

**Response (Error):**
```json
{
    "estado": "error",
    "mensaje": "No se detectó ninguna mano en la imagen"
}
```

### 2. GET /vista01/estadisticas/
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
- `imagen_base64`: Imagen original
- `letra_detectada`: Vocal detectada
- `confianza`: Nivel de confianza (0.0-1.0)
- `coordenadas_mano`: Puntos de landmarks de Mediapipe
- `timestamp`: Fecha y hora de detección
- `procesado`: Indica si ya fue procesado

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

## Dependencias Principales
- Django 5.2.6
- Mediapipe 0.10.8
- TensorFlow 2.15.0
- OpenCV 4.8.1.78
- NumPy 1.24.3
- Pillow 10.1.0

## Notas Técnicas
- La API utiliza Mediapipe para detección de landmarks de mano
- Los gestos se detectan basándose en la posición relativa de los dedos
- Las imágenes deben contener una mano claramente visible
- La confianza mínima de detección es 0.7
- Los datos se almacenan temporalmente para posterior entrenamiento supervisado
