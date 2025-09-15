#!/bin/bash

# Script de configuración automática del VPS
# Ejecutar como: curl -sSL https://raw.githubusercontent.com/tu-usuario/repo/main/setup-vps.sh | bash
# O descargar y ejecutar: chmod +x setup-vps.sh && ./setup-vps.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
PROJECT_NAME="Proyecto-Lenguaje-Gestos"
PROJECT_DIR="/var/www/$PROJECT_NAME"
GIT_REPO="https://github.com/tu-usuario/$PROJECT_NAME.git"  # CAMBIAR POR TU REPO
DOMAIN="devproyectos.com"  # CAMBIAR POR TU DOMINIO
USER_NAME="$(whoami)"

# Funciones de logging
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

# Verificar que se ejecuta en Ubuntu
if [ ! -f /etc/lsb-release ]; then
    log_error "Este script está diseñado para Ubuntu"
    exit 1
fi

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Función para instalar paquetes
install_packages() {
    log "Actualizando sistema e instalando paquetes..."
    sudo apt update
    sudo apt upgrade -y
    
    # Paquetes esenciales
    sudo apt install -y \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        git \
        nginx \
        curl \
        wget \
        unzip \
        supervisor \
        certbot \
        python3-certbot-nginx \
        build-essential \
        libpq-dev \
        postgresql-client
    
    log_success "Paquetes instalados"
}

# Función para configurar firewall
setup_firewall() {
    log "Configurando firewall..."
    
    # Habilitar UFW si no está activo
    if ! sudo ufw status | grep -q "Status: active"; then
        sudo ufw --force enable
    fi
    
    # Reglas básicas
    sudo ufw allow ssh
    sudo ufw allow 'Nginx Full'
    sudo ufw allow 80
    sudo ufw allow 443
    
    log_success "Firewall configurado"
}

# Función para clonar el proyecto
setup_project() {
    log "Configurando proyecto..."
    
    # Crear directorio si no existe
    if [ ! -d "$PROJECT_DIR" ]; then
        log "Clonando repositorio..."
        sudo git clone $GIT_REPO $PROJECT_DIR
        sudo chown -R $USER_NAME:$USER_NAME $PROJECT_DIR
    else
        log "Directorio del proyecto ya existe, actualizando..."
        cd $PROJECT_DIR
        git pull origin main
    fi
    
    cd $PROJECT_DIR
    
    # Crear entorno virtual
    if [ ! -d "venv" ]; then
        log "Creando entorno virtual..."
        python3 -m venv venv
    fi
    
    # Activar entorno virtual e instalar dependencias
    source venv/bin/activate
    
    if [ -f "Backend/requirements.txt" ]; then
        log "Instalando dependencias de Python..."
        cd Backend
        pip install --upgrade pip
        pip install -r requirements.txt
        pip install gunicorn
        cd ..
    else
        log_error "No se encontró Backend/requirements.txt"
        exit 1
    fi
    
    log_success "Proyecto configurado"
}

# Función para configurar Django
setup_django() {
    log "Configurando Django..."
    
    cd $PROJECT_DIR/Backend
    source ../venv/bin/activate
    
    # Ejecutar migraciones
    python manage.py migrate
    
    # Recopilar archivos estáticos
    python manage.py collectstatic --noinput
    
    # Crear superusuario si no existe
    echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@example.com', 'admin123')" | python manage.py shell
    
    log_success "Django configurado"
}

# Función para configurar servicios systemd
setup_systemd() {
    log "Configurando servicios systemd..."
    
    # Copiar archivos de servicio
    if [ -f "$PROJECT_DIR/gunicorn.service" ]; then
        # Personalizar archivo de servicio con el usuario actual
        sed "s/User=www-data/User=$USER_NAME/g; s/Group=www-data/Group=$USER_NAME/g" $PROJECT_DIR/gunicorn.service | sudo tee /etc/systemd/system/gunicorn.service > /dev/null
        sudo cp $PROJECT_DIR/gunicorn.socket /etc/systemd/system/
    else
        log_error "No se encontraron archivos de servicio"
        exit 1
    fi
    
    # Ajustar permisos
    sudo chown -R $USER_NAME:www-data $PROJECT_DIR
    sudo chmod -R 755 $PROJECT_DIR
    
    # Recargar systemd
    sudo systemctl daemon-reload
    
    # Habilitar servicios
    sudo systemctl enable gunicorn.socket
    sudo systemctl enable gunicorn.service
    sudo systemctl enable nginx
    
    # Iniciar servicios
    sudo systemctl start gunicorn.socket
    sudo systemctl start gunicorn.service
    
    log_success "Servicios systemd configurados"
}

# Función para configurar Nginx
setup_nginx() {
    log "Configurando Nginx..."
    
    # Copiar configuración de Nginx
    if [ -f "$PROJECT_DIR/nginx-devproyectos.conf" ]; then
        # Personalizar configuración con el dominio
        sed "s/devproyectos.com/$DOMAIN/g" $PROJECT_DIR/nginx-devproyectos.conf | sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null
        
        # Habilitar sitio
        sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
        
        # Deshabilitar sitio por defecto
        sudo rm -f /etc/nginx/sites-enabled/default
        
        # Verificar configuración
        sudo nginx -t
        
        # Recargar Nginx
        sudo systemctl reload nginx
    else
        log_error "No se encontró configuración de Nginx"
        exit 1
    fi
    
    log_success "Nginx configurado"
}

# Función para configurar SSL
setup_ssl() {
    log "Configurando SSL..."
    
    # Verificar que el dominio apunta al servidor
    DOMAIN_IP=$(dig +short $DOMAIN)
    SERVER_IP=$(curl -s ifconfig.me)
    
    if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
        log_warning "El dominio $DOMAIN no apunta a este servidor ($SERVER_IP vs $DOMAIN_IP)"
        log_warning "Saltando configuración SSL. Configúralo manualmente después."
        return
    fi
    
    # Obtener certificado SSL
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    # Verificar renovación automática
    sudo certbot renew --dry-run
    
    log_success "SSL configurado"
}

# Función para instalar script de despliegue
setup_deploy_script() {
    log "Instalando script de despliegue..."
    
    if [ -f "$PROJECT_DIR/deploy.sh" ]; then
        sudo cp $PROJECT_DIR/deploy.sh /usr/local/bin/
        sudo chmod +x /usr/local/bin/deploy.sh
        
        # Crear enlace simbólico
        ln -sf /usr/local/bin/deploy.sh $PROJECT_DIR/deploy.sh
    else
        log_error "No se encontró script de despliegue"
        exit 1
    fi
    
    log_success "Script de despliegue instalado"
}

# Función para verificar instalación
verify_installation() {
    log "Verificando instalación..."
    
    # Verificar servicios
    if systemctl is-active --quiet gunicorn; then
        log_success "Gunicorn está activo"
    else
        log_error "Gunicorn no está activo"
        sudo systemctl status gunicorn
    fi
    
    if systemctl is-active --quiet nginx; then
        log_success "Nginx está activo"
    else
        log_error "Nginx no está activo"
        sudo systemctl status nginx
    fi
    
    # Test de conectividad local
    if curl -f -s http://localhost/vista02/api/predict -X POST -H "Content-Type: application/json" -d '{}' > /dev/null; then
        log_success "API responde correctamente"
    else
        log_warning "API no responde o requiere datos específicos"
    fi
    
    log_success "Verificación completada"
}

# Función para mostrar resumen
show_summary() {
    echo ""
    echo "======================================"
    echo "🎉 INSTALACIÓN COMPLETADA"
    echo "======================================"
    echo ""
    echo "📁 Proyecto: $PROJECT_DIR"
    echo "🌐 Dominio: $DOMAIN"
    echo "👤 Usuario: $USER_NAME"
    echo ""
    echo "🔧 Comandos útiles:"
    echo "  - Desplegar: cd $PROJECT_DIR && ./deploy.sh"
    echo "  - Ver logs: sudo journalctl -u gunicorn -f"
    echo "  - Estado: ./deploy.sh status"
    echo "  - Rollback: ./deploy.sh rollback"
    echo ""
    echo "📊 URLs importantes:"
    echo "  - Sitio: https://$DOMAIN"
    echo "  - API: https://$DOMAIN/vista02/api/predict"
    echo "  - Admin: https://$DOMAIN/admin (admin/admin123)"
    echo ""
    echo "⚠️  IMPORTANTE:"
    echo "  1. Cambiar contraseña del admin de Django"
    echo "  2. Configurar variables de entorno de producción"
    echo "  3. Configurar backup automático"
    echo "  4. Revisar configuración de seguridad"
    echo ""
    echo "📚 Documentación: $PROJECT_DIR/guia-configuracion-vps.md"
    echo "======================================"
}

# Función principal
main() {
    log "=== INICIANDO CONFIGURACIÓN DEL VPS ==="
    
    # Verificar que no se ejecuta como root
    if [ "$EUID" -eq 0 ]; then
        log_error "No ejecutar este script como root"
        exit 1
    fi
    
    # Verificar configuración
    if [ "$GIT_REPO" = "https://github.com/tu-usuario/Proyecto-Lenguaje-Gestos.git" ]; then
        log_error "Debes cambiar GIT_REPO por tu repositorio real"
        exit 1
    fi
    
    # Ejecutar configuración paso a paso
    install_packages
    setup_firewall
    setup_project
    setup_django
    setup_systemd
    setup_nginx
    setup_ssl
    setup_deploy_script
    verify_installation
    show_summary
    
    log_success "=== CONFIGURACIÓN COMPLETADA ==="
}

# Manejo de errores
trap 'log_error "Error en línea $LINENO. Saliendo..."; exit 1' ERR

# Ejecutar función principal
main "$@"



