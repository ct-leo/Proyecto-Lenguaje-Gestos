# Proyecto Lenguaje de Gestos

Aplicación web para reconocimiento de gestos de manos orientado a alfabeto de señas. Consta de un Backend en Django y un Frontend en React + Vite. El reconocimiento de landmarks se realiza en el cliente con MediaPipe; el backend gestiona persistencia, entrenamiento ligero y endpoints de predicción.

## Tabla de contenidos
- Descripción general
- Arquitectura
- Funcionalidades
- Stack y herramientas
- Requisitos
- Instalación y ejecución
  - Backend (Django)
  - Frontend (Vite + React)
- Configuración de entorno
- Endpoints principales (resumen)
- Estructura del proyecto
- Scripts útiles
- Notas de producción y seguridad
- Troubleshooting

---

## Descripción general
El proyecto ofrece dos vistas/flows principales:

- Vista01: detección de vocales A, E, I, O, U. El frontend obtiene landmarks con MediaPipe y envía resultados ya procesados; el backend persiste y expone estadísticas.
- Vista02: flujo de entrenamiento A–Z con un modelo ligero basado en centroides y umbrales por letra. Incluye verificación estricta de forma por dedo (shape gate) para mayor precisión.

Consulta documentación detallada de la API en `API_DOCUMENTATION.md`.

## Arquitectura
- Frontend (`Frontend/`): React 19 + Vite 7 + TypeScript. Uso de `react-webcam` para cámara y UI moderna con `framer-motion`. En desarrollo, Vite actúa como proxy hacia el backend.
- Backend (`Backend/`): Django 5.2.6 con SQLite por defecto. Expone endpoints REST para almacenamiento de muestras, entrenamiento y predicción. CORS configurado.
- Comunicación: JSON sobre HTTP. Landmarks/rasgos procesados via frontend para Vista01 y flujo completo de captura/entrenamiento/predicción para Vista02.

## Funcionalidades
- Vista01
  - Detección de vocales (A, E, I, O, U) en tiempo real usando MediaPipe (CDN) desde el frontend.
  - Envío de resultados al backend para persistencia temporal y estadísticas.
- Vista02
  - Captura de muestras etiquetadas por letra A–Z.
  - Entrenamiento: cálculo de centroides y umbrales por percentil (P90) por letra.
  - Predicción: verificación estricta de forma por dedo (curl/extensión, oposición, relaciones angulares). Devuelve `letter`, `distance`, `threshold`, `shape_ok`.

## Stack y herramientas
- Backend (Django)
  - Django 5.2.6, `asgiref`, `sqlparse`, `tzdata`.
  - `django-cors-headers` para CORS.
  - `numpy`, `opencv-python`, `Pillow` (para procesamiento/imagen cuando se requiera).
- Frontend (React + Vite + TS)
  - React 19, Vite 7, TypeScript 5.
  - `react-webcam` para acceso a cámara.
  - `framer-motion` para animaciones UI.
  - `tsparticles-*` y `react-tsparticles` para efectos visuales.
  - MediaPipe Hands vía CDN en demos.

## Requisitos
- Python 3.10+
- Node.js 18+ y npm
- Navegador moderno con WebRTC y Canvas

## Instalación y ejecución

### 1) Backend (Django)
Ubicación: `Backend/`

Recomendado usar entorno virtual en Windows:

```powershell
cd Backend
py -3.10 -m venv env
./env/Scripts/activate
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

Servidor por defecto: `http://127.0.0.1:8000/`

Rutas de demo útiles:
- Vista02 demo HTML: `http://127.0.0.1:8000/vista02/demo/`

### 2) Frontend (Vite + React)
Ubicación: `Frontend/`

```powershell
cd Frontend
npm i
npm run dev
```

Servidor de desarrollo Vite (por defecto): `http://127.0.0.1:5173/`

En desarrollo, el `vite.config.ts` incluye proxy para evitar CORS y redirigir `/vista02/api` al backend (`http://127.0.0.1:8000`).

## Configuración de entorno
- Backend
  - Archivo: `Backend/core/settings.py`
  - Variables recomendadas para producción:
    - `SECRET_KEY` via variable de entorno (no hardcodear).
    - `DEBUG=False` (ya está por defecto en repo).
    - `ALLOWED_HOSTS` con dominios propios.
    - `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` ajustados a tus dominios.
    - Base de datos: cambiar a Postgres/MySQL según despliegue.
- Frontend
  - Archivo: `Frontend/.env`
  - Desarrollo típico:
    - `VITE_API_BASE=/vista02/api`
  - Revisa también `Frontend/.env.production` para despliegues.

## Endpoints principales (resumen)
Consulta la especificación completa en `API_DOCUMENTATION.md`.

- Vista01
  - `GET /vista01/` — Interfaz con MediaPipe integrado.
  - `POST /vista01/guardar-resultado/` — Guarda resultado procesado (imagen base64, letra detectada, confianza, landmarks).
  - `GET /vista01/estadisticas/` — Agregados y métricas de detecciones.

- Vista02
  - `POST /vista02/api/samples/batch` — Guardar lote de muestras etiquetadas.
  - `POST /vista02/api/train` — Entrena y persiste modelo con centroides y umbrales P90.
  - `GET /vista02/api/model` — Obtiene último modelo.
  - `POST /vista02/api/predict` — Predicción en vivo (devuelve `letter`, `distance`, `threshold`, `shape_ok`).
  - `GET /vista02/api/progress` — Conteo de muestras por letra.
  - `POST /vista02/api/reset` — Resetea dataset/modelos (uso opcional).

## Estructura del proyecto
```
Proyecto-Lenguaje-Gestos/
├─ Backend/
│  ├─ core/              # Proyecto Django (settings, urls, wsgi/asgi)
│  ├─ vista01/           # API y vistas de vocales
│  ├─ vista02/           # API de entrenamiento y predicción A–Z
│  ├─ requirements.txt
│  └─ db.sqlite3         # BD por defecto (desarrollo)
├─ Frontend/
│  ├─ src/               # Código React + TS
│  ├─ public/
│  ├─ package.json
│  └─ vite.config.ts
├─ API_DOCUMENTATION.md  # Detalle de endpoints y flujos
└─ README.md             # Este archivo
```

## Scripts útiles
- Backend
  - Migraciones: `python manage.py makemigrations && python manage.py migrate`
  - Servidor dev: `python manage.py runserver`
- Frontend
  - Desarrollo: `npm run dev`
  - Build prod: `npm run build`
  - Preview: `npm run preview`
  - Linter: `npm run lint`
