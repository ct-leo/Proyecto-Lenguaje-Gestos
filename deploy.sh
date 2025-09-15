#!/bin/bash

# Script de despliegue automático para Django con Gunicorn y Nginx
# Autor: DevOps Assistant
# Uso: ./deploy.sh [branch]

set -e  # Salir si cualquier comando falla

# Configuración
PROJECT_DIR="/var/www/Proyecto-Lenguaje-Gestos"
BACKEND_DIR="$PROJECT_DIR/Backend"
BRANCH="${1:-main}"  # Usar branch pasado como parámetro o 'main' por defecto
VENV_PATH="$PROJECT_DIR/venv"  # Ajustar según tu configuración
GUNICORN_SERVICE="gunicorn"
NGINX_SERVICE="nginx"


# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que el script se ejecuta como usuario correcto
if [ "$EUID" -eq 0 ]; then
    log_error "No ejecutar este script como root. Usar usuario con permisos sudo."
    exit 1
fi

# Función para verificar servicios
check_service() {
    if systemctl is-active --quiet $1; then
        log_success "Servicio $1 está activo"
        return 0
    else
        log_error "Servicio $1 no está activo"
        return 1
    fi
}

# Función para backup de la base de datos
backup_database() {
    log "Creando backup de la base de datos..."
    BACKUP_DIR="$PROJECT_DIR/backups"
    mkdir -p $BACKUP_DIR
    
    if [ -f "$BACKEND_DIR/db.sqlite3" ]; then
        cp "$BACKEND_DIR/db.sqlite3" "$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sqlite3"
        log_success "Backup de SQLite creado"
    else
        log_warning "No se encontró db.sqlite3, saltando backup"
    fi
}

# Función principal de despliegue
deploy() {
    log "=== INICIANDO DESPLIEGUE ==="
    log "Branch: $BRANCH"
    log "Directorio: $PROJECT_DIR"
    
    # 1. Verificar que el directorio existe
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "Directorio del proyecto no encontrado: $PROJECT_DIR"
        exit 1
    fi
    
    # 2. Ir al directorio del proyecto
    log "Cambiando al directorio del proyecto..."
    cd $PROJECT_DIR
    
    # 3. Verificar estado de Git
    log "Verificando estado de Git..."
    if [ ! -d ".git" ]; then
        log_error "No es un repositorio Git válido"
        exit 1
    fi
    
    # 4. Stash cambios locales si existen
    if ! git diff-index --quiet HEAD --; then
        log_warning "Hay cambios locales, guardando en stash..."
        git stash push -m "Auto-stash before deploy $(date)"
    fi
    
    # 5. Fetch y pull
    log "Actualizando código desde Git..."
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
    
    # 6. Backup de base de datos
    backup_database
    
    # 7. Activar entorno virtual si existe
    if [ -d "$VENV_PATH" ]; then
        log "Activando entorno virtual..."
        source $VENV_PATH/bin/activate
    else
        log_warning "No se encontró entorno virtual en $VENV_PATH"
    fi
    
    # 8. Ir al directorio del backend
    cd $BACKEND_DIR
    
    # 9. Instalar/actualizar dependencias
    log "Instalando dependencias..."
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt --upgrade
        log_success "Dependencias instaladas"
    else
        log_error "No se encontró requirements.txt"
        exit 1
    fi
    
    # 10. Ejecutar migraciones
    log "Ejecutando migraciones..."
    python manage.py migrate --noinput
    log_success "Migraciones completadas"
    
    # 11. Recopilar archivos estáticos
    log "Recopilando archivos estáticos..."
    python manage.py collectstatic --noinput --clear
    log_success "Archivos estáticos recopilados"
    
    # 12. Verificar configuración de Django
    log "Verificando configuración de Django..."
    python manage.py check --deploy
    
    # 13. Reiniciar servicios
    log "Reiniciando servicios..."
    
    # Reiniciar Gunicorn
    log "Reiniciando Gunicorn..."
    sudo systemctl restart $GUNICORN_SERVICE
    sleep 2
    
    if check_service $GUNICORN_SERVICE; then
        log_success "Gunicorn reiniciado correctamente"
    else
        log_error "Error al reiniciar Gunicorn"
        sudo journalctl -u $GUNICORN_SERVICE --no-pager -n 20
        exit 1
    fi
    
    # Recargar Nginx
    log "Recargando Nginx..."
    sudo systemctl reload $NGINX_SERVICE
    
    if check_service $NGINX_SERVICE; then
        log_success "Nginx recargado correctamente"
    else
        log_error "Error al recargar Nginx"
        sudo tail -n 20 /var/log/nginx/error.log
        exit 1
    fi
    
    # 14. Verificar que la aplicación responde
    log "Verificando que la aplicación responde..."
    sleep 3
    
    # Intentar hacer una petición a la aplicación
    if curl -f -s http://localhost/vista02/api/predict -X POST -H "Content-Type: application/json" -d '{}' > /dev/null 2>&1; then
        log_success "Aplicación responde correctamente"
    else
        log_warning "La aplicación podría no estar respondiendo correctamente"
    fi
    
    log_success "=== DESPLIEGUE COMPLETADO EXITOSAMENTE ==="
    log "Timestamp: $(date)"
    log "Branch desplegado: $BRANCH"
    log "Commit: $(git rev-parse --short HEAD)"
}

# Función para mostrar ayuda
show_help() {
    echo "Uso: $0 [OPCIÓN] [BRANCH]"
    echo ""
    echo "Opciones:"
    echo "  deploy [branch]    Ejecutar despliegue (default: main)"
    echo "  status            Mostrar estado de servicios"
    echo "  logs              Mostrar logs recientes"
    echo "  rollback          Rollback al commit anterior"
    echo "  help              Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 deploy main"
    echo "  $0 deploy develop"
    echo "  $0 status"
    echo "  $0 logs"
}

# Función para mostrar estado de servicios
show_status() {
    log "=== ESTADO DE SERVICIOS ==="
    
    echo "Gunicorn:"
    systemctl status $GUNICORN_SERVICE --no-pager -l
    echo ""
    
    echo "Nginx:"
    systemctl status $NGINX_SERVICE --no-pager -l
    echo ""
    
    echo "Procesos:"
    ps aux | grep -E "(gunicorn|nginx)" | grep -v grep
}

# Función para mostrar logs
show_logs() {
    log "=== LOGS RECIENTES ==="
    
    echo "Gunicorn logs (últimas 20 líneas):"
    sudo journalctl -u $GUNICORN_SERVICE --no-pager -n 20
    echo ""
    
    echo "Nginx error logs (últimas 20 líneas):"
    sudo tail -n 20 /var/log/nginx/error.log
    echo ""
    
    echo "Nginx access logs (últimas 10 líneas):"
    sudo tail -n 10 /var/log/nginx/access.log
}

# Función para rollback
rollback() {
    log "=== INICIANDO ROLLBACK ==="
    
    cd $PROJECT_DIR
    
    # Obtener el commit anterior
    PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
    CURRENT_COMMIT=$(git rev-parse HEAD)
    
    log "Commit actual: $CURRENT_COMMIT"
    log "Rollback a: $PREVIOUS_COMMIT"
    
    # Confirmar rollback
    read -p "¿Confirmar rollback? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Rollback cancelado"
        exit 0
    fi
    
    # Hacer rollback
    git reset --hard HEAD~1
    
    # Ejecutar despliegue con el código anterior
    deploy
}

# Función principal
main() {
    case "${1:-deploy}" in
        "deploy")
            deploy
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "rollback")
            rollback
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Opción no válida: $1"
            show_help
            exit 1
            ;;
    esac
}

# Ejecutar función principal con todos los argumentos
main "$@"

