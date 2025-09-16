#!/bin/bash

# Script de despliegue automático para Django con Gunicorn y Nginx
# Autor: DevOps Assistant
# Uso: ./deploy.sh [branch]

set -e  # Salir si cualquier comando falla

# Configuración
PROJECT_DIR="/var/www/Proyecto-Lenguaje-Gestos"
BACKEND_DIR="$PROJECT_DIR/Backend"
FRONTEND_DIR="$PROJECT_DIR/Frontend"
BRANCH="${1:-VISTA-2-ADRIEL}"  # Usar branch pasado como parámetro o 'VISTA-2-ADRIEL' por defecto
VENV_PATH="$PROJECT_DIR/venv"
GUNICORN_SERVICE="gunicorn"
NGINX_SERVICE="nginx"
USER_NAME="root"


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

# Verificar que el script se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    log_error "Este script debe ejecutarse como root para gestionar servicios del sistema."
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
    
    # Crear directorio de backups si no existe
    BACKUP_DIR="$PROJECT_DIR/backups"
    mkdir -p $BACKUP_DIR
    
    # Crear backup con timestamp
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.json"
    
    cd $BACKEND_DIR
    source $VENV_PATH/bin/activate
    
    # Hacer backup usando dumpdata de Django
    python manage.py dumpdata --natural-foreign --natural-primary > $BACKUP_FILE
    
    if [ $? -eq 0 ]; then
        log_success "Backup creado: $BACKUP_FILE"
        # Mantener solo los últimos 5 backups
        ls -t $BACKUP_DIR/db_backup_*.json | tail -n +6 | xargs -r rm
    else
        log_error "Error al crear backup"
        exit 1
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
    
    # Compilar frontend si existe
    if [ -d "$FRONTEND_DIR" ]; then
        log "Compilando frontend..."
        cd $FRONTEND_DIR
        if [ -f "package.json" ]; then
            npm install
            npm run build
            log_success "Frontend compilado"
        else
            log_warning "No se encontró package.json en el frontend"
        fi
        cd $BACKEND_DIR
    fi
    
    # Reiniciar Gunicorn
    log "Reiniciando Gunicorn..."
    systemctl restart $GUNICORN_SERVICE
    sleep 2
    
    if check_service $GUNICORN_SERVICE; then
        log_success "Gunicorn reiniciado correctamente"
    else
        log_error "Error al reiniciar Gunicorn"
        journalctl -u $GUNICORN_SERVICE --no-pager -n 20
        exit 1
    fi
    
    # Recargar Nginx
    log "Recargando Nginx..."
    systemctl reload $NGINX_SERVICE
    
    if check_service $NGINX_SERVICE; then
        log_success "Nginx recargado correctamente"
    else
        log_error "Error al recargar Nginx"
        tail -n 20 /var/log/nginx/error.log
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
    journalctl -u $GUNICORN_SERVICE --no-pager -n 20
    echo ""
    
    echo "Nginx error logs (últimas 20 líneas):"
    tail -n 20 /var/log/nginx/error.log
    echo ""
    
    echo "Nginx access logs (últimas 10 líneas):"
    tail -n 10 /var/log/nginx/access.log
}

# Función para rollback
rollback() {
    log "Iniciando rollback..."
    
    # Buscar el último backup
    BACKUP_DIR="$PROJECT_DIR/backups"
    LATEST_BACKUP=$(ls -t $BACKUP_DIR/db_backup_*.json 2>/dev/null | head -n 1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        log_error "No se encontraron backups para rollback"
        exit 1
    fi
    
    log "Usando backup: $LATEST_BACKUP"
    
    cd $BACKEND_DIR
    source $VENV_PATH/bin/activate
    
    # Restaurar backup
    python manage.py flush --noinput
    python manage.py loaddata $LATEST_BACKUP
    
    if [ $? -eq 0 ]; then
        log_success "Rollback completado"
        
        # Reiniciar servicios
        systemctl restart $GUNICORN_SERVICE
        systemctl reload $NGINX_SERVICE
        
        log_success "Servicios reiniciados"
    else
        log_error "Error durante el rollback"
        exit 1
    fi
}

# Función principal
main() {
    case "${1:-deploy}" in
        "deploy")
            BRANCH="${2:-$BRANCH}"
            log "=== INICIANDO DESPLIEGUE ==="
            log "Branch: $BRANCH"
            log "Directorio del proyecto: $PROJECT_DIR"
            
            # Verificar que el directorio del proyecto existe
            if [ ! -d "$PROJECT_DIR" ]; then
                log_error "El directorio del proyecto no existe: $PROJECT_DIR"
                exit 1
            fi
            
            # Cambiar al directorio del proyecto
            cd $PROJECT_DIR
            
            # Hacer backup antes del despliegue
            backup_database
            
            # Ejecutar despliegue
            deploy
            
            log_success "=== DESPLIEGUE COMPLETADO ==="
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

