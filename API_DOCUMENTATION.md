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

---

## API de Reconocimiento de Manos - Vista02

### Descripción breve
Vista02 implementa un flujo de entrenamiento y reconocimiento de lenguaje de señas A..Z en el navegador (frontend) y en el backend (Django):
- El frontend usa MediaPipe Hands (vía CDN) para extraer landmarks en tiempo real.
- El backend guarda muestras etiquetadas por letra, entrena un modelo simple por centroides y reconoce en vivo con umbrales por letra.

### Instalación
1) Instalar dependencias
```bash
pip install -r requirements.txt
```

2) Migraciones
```bash
python manage.py migrate
```

3) Ejecutar el servidor
```bash
python manage.py runserver
```

4) Abrir la demo (Vista02)
- URL: `http://127.0.0.1:8000/vista02/demo/`

### Dependencias y recursos
- Backend (requirements): Django y librerías científicas incluidas en `requirements.txt`.
- Frontend (CDN): MediaPipe se carga por URL (hands, camera_utils, drawing_utils). No requiere instalar el paquete de MediaPipe en Python para la demo del navegador.

### Flujo de uso (entrenamiento y predicción)
1) Capturar muestras por letra
- En la demo, selecciona una letra y pulsa “Entrenar (capturar muestras)”.
- Se envían lotes a `POST /vista02/api/samples/batch` y el backend guarda `HandSample` con la etiqueta (A..Z).

2) Entrenar modelo
- Pulsa “Entrenar Modelo” → `POST /vista02/api/train` calcula centroides (`TrainingModel`).

3) Reconocimiento en vivo (backend)
- El frontend envía landmarks periódicamente a `POST /vista02/api/predict`.
- El backend compara con los centroides y umbrales por letra.
- Si coincide con una postura entrenada, responde la letra; si no, `null`.
- La demo muestra “Letra detectada” en el panel derecho.

### Notas sobre compartir el modelo
- Si compartes el proyecto sin `db.sqlite3`, tu compañero deberá capturar y entrenar en su máquina para obtener un modelo.
- Alternativa: versionar temporalmente `db.sqlite3` o exportar/importar datos con `dumpdata/loaddata` (HandSample y TrainingModel) para reproducir el modelo.

### Endpoints clave (Vista02)
- `POST /vista02/api/samples/batch` — guarda muestras etiquetadas.
- `POST /vista02/api/train` — entrena y guarda centroides.
- `GET  /vista02/api/model` — obtiene el último modelo.
- `POST /vista02/api/predict` — reconocimiento en vivo (devuelve letra o null).
- `GET  /vista02/api/progress` — totales de muestras.
- `POST /vista02/api/reset` — limpia todas las muestras/modelos (uso opcional).

### Observaciones
- La demo usa un “overlay” con landmarks y un panel lateral con la “Letra detectada” y confianza.
- La barra de progreso de captura en la demo refleja el progreso de la sesión; los totales reales están en la BD y se muestran aparte.
