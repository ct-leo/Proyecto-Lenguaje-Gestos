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
  - Procesamiento completamente en el cliente para extracción de landmarks (MediaPipe vía CDN)

---

# API de Reconocimiento de Manos — Vista02 (Entrenamiento A–Z)

## Descripción general
Vista02 implementa un entrenamiento y reconocimiento de gestos del alfabeto de señas (A..Z). El sistema es estricto por forma: la confianza solo sube cuando la postura completa coincide con el gesto entrenado, dedo por dedo.

- Frontend: obtención de landmarks con MediaPipe Hands (CDN) y UI de demo (`ejemplo2_frontend.html`).
- Backend (Django): almacenamiento de muestras por letra, entrenamiento por centroides y reconocimiento en vivo con umbrales por letra y verificación estricta de forma.

## Principios de reconocimiento (Vista02)
- Umbrales por percentil: durante el entrenamiento se calcula un umbral por letra usando percentil (P90). Esto reduce la influencia de datos raros.
- Verificación estricta de forma (shape gate): además de cumplir el umbral, se exige coincidencia por dedo en características como curl (doblado/estirado), extensión MCP→TIP, oposición del pulgar y relaciones entre dedos. Si cambias un dedo, no sube la confianza.
- Respuesta del backend:
  - `letter`: letra aceptada o `null`.
  - `distance`: distancia al centroide de la letra candidata.
  - `threshold`: umbral para esa letra (percentil P90).
  - `shape_ok`: `true/false` indicando si la forma estricta coincide.
- Política del frontend:
  - Muestra “Procesando…” cuando `shape_ok=false` o `distance>threshold`.
  - Solo muestra la letra cuando `shape_ok=true` y la detección supera el umbral.
  - UI fija una confianza mínima visual del 50% para letras aceptadas (evita parpadeos), pero la aceptación depende solo del backend.

## Estructura del módulo `vista02/`
- `vista02/dbmodels/` — Modelos Django persistentes:
  - `HandSample`: muestra etiquetada con landmarks y feature vector opcional.
  - `TrainingModel`: centroides, umbrales por letra y metadatos del entrenamiento.
- `vista02/services/` — Lógica de ML ligera:
  - `feature_extractor.py`: extrae un vector de características normalizado e invariante a traslación/escala; resalta detalles por dedo (curl, extensión, oposición, relaciones angulares, etc.).
  - `trainer.py`: calcula centroides, umbrales por percentil y realiza la predicción con verificación estricta de forma (per-finger).
- `vista02/views/views.py` — Endpoints REST (JSON) para capturar, entrenar, consultar modelo y predecir.
- `vista02/urls/` — Rutas de la app.
- `ejemplo2_frontend.html` — Demo web provisional (HTML/JS puro con MediaPipe vía CDN). Se migrará a React + TypeScript.

## Endpoints (Vista02)
- `POST /vista02/api/samples/batch`
  - Guarda un lote de muestras etiquetadas por `letter`.
  - Body: `{ "letter": "A", "samples": [{"landmarks": [...], "feature": [...]}, ...] }` (el backend puede recalcular el feature).

- `POST /vista02/api/train`
  - Entrena y persiste `TrainingModel` con centroides y umbrales por letra (percentil P90).

- `GET /vista02/api/model`
  - Devuelve el último modelo: letters, centroids, thresholds y parámetros.

- `POST /vista02/api/predict`
  - Reconocimiento en vivo.
  - Body: `{ "landmarks": [...], "feature": [...] }` (se prefiere `landmarks`).
  - Respuesta: `{ status, letter, distance, threshold, shape_ok, candidate?, candidate_distance? }`.

- `GET /vista02/api/progress`
  - Totales de muestras por letra y total global.

- `POST /vista02/api/reset`
  - Limpia todas las muestras y modelos (uso opcional para reiniciar el dataset).

## Flujo de uso
1. Captura de muestras
   - Selecciona una letra y presiona “Entrenar (capturar muestras)”.
   - Se envían lotes a `/vista02/api/samples/batch`.
2. Entrenamiento del modelo
   - Presiona “Entrenar Modelo” → `/vista02/api/train` calcula centroides y umbrales P90 por letra.
3. Reconocimiento en vivo
   - La demo envía landmarks periódicamente a `/vista02/api/predict`.
   - Si cumple umbral y forma estricta (`shape_ok=true`), devuelve la letra; en otro caso, `null` y la UI muestra “Procesando…”.

## Requisitos del proyecto
- Python 3.10+
- Django 5.2.6 (ver `requirements.txt`)
- Navegador moderno con WebRTC, Canvas y ES6.
- Conexión a Internet para cargar MediaPipe (CDN) en la demo.

## Instalación y ejecución
```bash
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```
- Demo: `http://127.0.0.1:8000/vista02/demo/`

### Guía rápida de ejecución (Vista02)

1) Backend (Windows, con entorno virtual)

- Abrir terminal en la carpeta del backend:
  - `cd Backend`
- Crear entorno virtual (usa tu Python por defecto):
  - `python -m venv env`
- Activar entorno virtual:
  - `env\Scripts\activate`
- Instalar dependencias y preparar BD:
  - `pip install -r requirements.txt`
  - `python manage.py makemigrations`
  - `python manage.py migrate`
- Ejecutar el servidor de desarrollo:
  - `python manage.py runserver`

2) Frontend (Vite + React)

- Abrir otra terminal en la carpeta del frontend:
  - `cd Frontend`
- Instalar dependencias:
  - `npm i`
- Iniciar el servidor de desarrollo:
  - `npm run dev`

3) Configuración de API en el Frontend (desarrollo)

- El archivo `Frontend/vite.config.ts` ya trae un proxy que reenvía `/vista02/api` → `http://127.0.0.1:8000`.
- En `Frontend/.env` asegúrate de usar:
  - `VITE_API_BASE=/vista02/api`
- De esta forma evitas CORS en desarrollo y las llamadas del frontend se rutean al backend por el proxy de Vite.

4) Abrir en el navegador

- Frontend (Vite): muestra la app de React.
- Backend demo HTML puro (opcional): `http://127.0.0.1:8000/vista02/demo/`

### Instalación con y sin entorno virtual (Windows)

#### Opción A) Con entorno virtual (recomendada)

1. Crear un entorno virtual (elige Python 3.10+):
```powershell
py -3.10 -m venv env
# Si no tienes 'py':
python -m venv env
```
2. Activar el entorno virtual:
```powershell
.\env\Scripts\activate
```
3. Instalar dependencias y preparar la BD:
```powershell
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
```
4. Ejecutar el servidor de desarrollo:
```powershell
python manage.py runserver
```
5. (Opcional) Desactivar el entorno cuando termines:
```powershell
deactivate
```

Ventajas: aislamiento de dependencias por proyecto, menos conflictos con otros proyectos o con el Python del sistema, reproducibilidad.

#### Opción B) Sin entorno virtual (no recomendada)

Puedes ejecutar los mismos comandos directamente, pero instalarás paquetes en el entorno global de tu usuario/sistema:
```powershell
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
Riesgos: posibles conflictos de versiones con otros proyectos y dificultad para limpiar dependencias. Si decides esta opción y `pip` pide permisos, evita ejecutar como administrador; considera mejor crear un entorno virtual o, como último recurso, usar `pip install --user`.

## Notas y roadmap
- El frontend de demo (`ejemplo2_frontend.html`) es provisional. La migración prevista es a **React + TypeScript**, reusando los endpoints de `vista02`.
- El sistema es deliberadamente estricto: gestos “parecidos” no son aceptados si cambias la postura de un dedo clave (por ejemplo, asomar el pulgar en la letra B).
