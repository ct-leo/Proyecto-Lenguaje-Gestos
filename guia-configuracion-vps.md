# Guía Completa de Configuración VPS - Django con Gunicorn y Nginx

## 📋 Índice
1. [Configuración Inicial del VPS](#configuración-inicial-del-vps)
2. [Configuración de Servicios Systemd](#configuración-de-servicios-systemd)
3. [Configuración de Nginx](#configuración-de-nginx)
4. [Script de Despliegue](#script-de-despliegue)
5. [Automatización con Git Hooks](#automatización-con-git-hooks)
6. [GitHub Actions CI/CD](#github-actions-cicd)
7. [API de Control de Servicios](#api-de-control-de-servicios)
8. [Logs y Debugging](#logs-y-debugging)
9. [Troubleshooting](#troubleshooting)

---

## 🚀 Configuración Inicial del VPS

### 1. Preparar el entorno

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y


# Instalar dependencias básicas
sudo apt install -y python3 python3-pip python3-venv git nginx curl supervisor

# Crear usuario para la aplicación (opcional, recomendado)
sudo useradd -m -s /bin/bash django-app
sudo usermod -aG sudo django-app
```

### 2. Configurar el proyecto

```bash
# Ir al directorio web
cd /var/www

# Clonar el repositorio
sudo git clone https://github.com/tu-usuario/Proyecto-Lenguaje-Gestos.git
sudo chown -R $USER:$USER Proyecto-Lenguaje-Gestos
cd Proyecto-Lenguaje-Gestos

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
cd Backend
pip install -r requirements.txt
pip install gunicorn

# Configurar Django
python manage.py migrate
python manage.py collectstatic --noinput
```


---

## ⚙️ Configuración de Servicios Systemd

### 1. Instalar archivos de servicio

```bash
# Copiar archivos de configuración
sudo cp /var/www/Proyecto-Lenguaje-Gestos/gunicorn.service /etc/systemd/system/
sudo cp /var/www/Proyecto-Lenguaje-Gestos/gunicorn.socket /etc/systemd/system/

# IMPORTANTE: Editar el archivo de servicio con tu usuario real
sudo nano /etc/systemd/system/gunicorn.service
# Cambiar 'www-data' por tu usuario actual (ej: ubuntu, django-app, etc.)
```

### 2. Configurar permisos y rutas

```bash
# Verificar que las rutas en gunicorn.service son correctas:
# - WorkingDirectory=/var/www/Proyecto-Lenguaje-Gestos/Backend
# - ExecStart=/var/www/Proyecto-Lenguaje-Gestos/venv/bin/gunicorn

# Ajustar permisos
sudo chown -R $USER:www-data /var/www/Proyecto-Lenguaje-Gestos
sudo chmod -R 755 /var/www/Proyecto-Lenguaje-Gestos
```

### 3. Habilitar y iniciar servicios

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar servicios para inicio automático
sudo systemctl enable gunicorn.socket
sudo systemctl enable gunicorn.service
sudo systemctl enable nginx

# Iniciar servicios
sudo systemctl start gunicorn.socket
sudo systemctl start gunicorn.service
sudo systemctl start nginx

# Verificar estado
sudo systemctl status gunicorn.socket
sudo systemctl status gunicorn.service
sudo systemctl status nginx
```

---

## 🌐 Configuración de Nginx

### 1. Configurar sitio

```bash
# Copiar configuración de Nginx
sudo cp /var/www/Proyecto-Lenguaje-Gestos/nginx-devproyectos.conf /etc/nginx/sites-available/devproyectos

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/devproyectos /etc/nginx/sites-enabled/

# Deshabilitar sitio por defecto
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

### 2. Configurar SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d devproyectos.com -d www.devproyectos.com

# Verificar renovación automática
sudo certbot renew --dry-run
```

---

## 🔄 Script de Despliegue

### 1. Instalar script

```bash
# Copiar script de despliegue
sudo cp /var/www/Proyecto-Lenguaje-Gestos/deploy.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/deploy.sh

# Crear enlace simbólico para fácil acceso
sudo ln -s /usr/local/bin/deploy.sh /var/www/Proyecto-Lenguaje-Gestos/deploy.sh
```

### 2. Uso del script

```bash
# Despliegue básico
./deploy.sh

# Despliegue de branch específico
./deploy.sh deploy develop

# Ver estado de servicios
./deploy.sh status

# Ver logs
./deploy.sh logs

# Rollback al commit anterior
./deploy.sh rollback
```

---

## 🔗 Automatización con Git Hooks

### 1. Configurar repositorio bare (en el VPS)

```bash
# Crear repositorio bare para hooks
sudo mkdir -p /var/git/Proyecto-Lenguaje-Gestos.git
cd /var/git/Proyecto-Lenguaje-Gestos.git
sudo git init --bare
sudo chown -R $USER:$USER /var/git/Proyecto-Lenguaje-Gestos.git
```

### 2. Crear hook post-receive

```bash
# Crear archivo hook
cat > /var/git/Proyecto-Lenguaje-Gestos.git/hooks/post-receive << 'EOF'
#!/bin/bash

# Hook post-receive para despliegue automático
echo "=== Iniciando despliegue automático ==="

# Directorio de trabajo
WORK_TREE=/var/www/Proyecto-Lenguaje-Gestos
GIT_DIR=/var/git/Proyecto-Lenguaje-Gestos.git

# Checkout del código
git --git-dir=$GIT_DIR --work-tree=$WORK_TREE checkout -f main

# Ejecutar script de despliegue
cd $WORK_TREE
./deploy.sh

echo "=== Despliegue completado ==="
EOF

# Hacer ejecutable
chmod +x /var/git/Proyecto-Lenguaje-Gestos.git/hooks/post-receive
```

### 3. Configurar remote en tu repositorio local

```bash
# En tu máquina local, agregar remote del VPS
git remote add production usuario@tu-vps-ip:/var/git/Proyecto-Lenguaje-Gestos.git

# Desplegar con:
git push production main
```

---

## 🤖 GitHub Actions CI/CD

### 1. Crear workflow

Crea `.github/workflows/deploy.yml` en tu repositorio:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Deploy to VPS
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USERNAME }}
        key: ${{ secrets.VPS_SSH_KEY }}
        script: |
          cd /var/www/Proyecto-Lenguaje-Gestos
          git pull origin main
          ./deploy.sh
```

### 2. Configurar secrets en GitHub

- `VPS_HOST`: IP de tu VPS
- `VPS_USERNAME`: Usuario SSH
- `VPS_SSH_KEY`: Clave privada SSH

---

## 🔐 API de Control de Servicios

### 1. Crear API con Flask (Opcional)

```python
# /var/www/service-control-api/app.py
from flask import Flask, request, jsonify
import subprocess
import hashlib
import hmac
import os

app = Flask(__name__)
SECRET_TOKEN = os.environ.get('SERVICE_API_TOKEN', 'tu-token-secreto')

def verify_token(token):
    return hmac.compare_digest(token, SECRET_TOKEN)

@app.route('/restart/<service>', methods=['POST'])
def restart_service(service):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not verify_token(token):
        return jsonify({'error': 'Unauthorized'}), 401
    
    allowed_services = ['gunicorn', 'nginx']
    if service not in allowed_services:
        return jsonify({'error': 'Service not allowed'}), 400
    
    try:
        result = subprocess.run(['sudo', 'systemctl', 'restart', service], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            return jsonify({'status': 'success', 'message': f'{service} restarted'})
        else:
            return jsonify({'status': 'error', 'message': result.stderr}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/deploy', methods=['POST'])
def deploy():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not verify_token(token):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        result = subprocess.run(['/var/www/Proyecto-Lenguaje-Gestos/deploy.sh'], 
                              capture_output=True, text=True)
        return jsonify({
            'status': 'success' if result.returncode == 0 else 'error',
            'output': result.stdout,
            'error': result.stderr
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001)
```

### 2. Configurar servicio para la API

```bash
# Crear servicio systemd para la API
sudo tee /etc/systemd/system/service-control-api.service > /dev/null << EOF
[Unit]
Description=Service Control API
After=network.target

[Service]
User=$USER
WorkingDirectory=/var/www/service-control-api
Environment=SERVICE_API_TOKEN=tu-token-muy-secreto
ExecStart=/var/www/service-control-api/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Habilitar e iniciar
sudo systemctl enable service-control-api
sudo systemctl start service-control-api
```

### 3. Uso de la API

```bash
# Reiniciar Gunicorn
curl -X POST http://localhost:5001/restart/gunicorn \
     -H "Authorization: Bearer tu-token-muy-secreto"

# Ejecutar despliegue
curl -X POST http://localhost:5001/deploy \
     -H "Authorization: Bearer tu-token-muy-secreto"
```

**⚠️ Riesgos de Seguridad:**
- Exponer comandos de sistema via API
- Token comprometido = acceso total
- Ataques de fuerza bruta
- Logs pueden exponer tokens

**🛡️ Mitigaciones:**
- Usar HTTPS siempre
- Tokens largos y aleatorios
- Rate limiting
- Logs sin tokens
- Firewall restrictivo
- Monitoreo de accesos

---

## 📊 Logs y Debugging

### 1. Comandos esenciales de logs

```bash
# Logs de Gunicorn
sudo journalctl -u gunicorn -f                    # Tiempo real
sudo journalctl -u gunicorn --since "1 hour ago" # Última hora
sudo journalctl -u gunicorn -n 50                # Últimas 50 líneas

# Logs de Nginx
sudo tail -f /var/log/nginx/error.log            # Errores en tiempo real
sudo tail -f /var/log/nginx/access.log           # Accesos en tiempo real
sudo grep "ERROR" /var/log/nginx/error.log       # Filtrar errores

# Logs del sistema
sudo journalctl -f                               # Todos los logs del sistema
sudo dmesg | tail                                # Mensajes del kernel

# Logs de Django (si configurado)
tail -f /var/www/Proyecto-Lenguaje-Gestos/Backend/logs/django.log
```

### 2. Script de monitoreo

```bash
# Crear script de monitoreo
cat > /usr/local/bin/monitor-services.sh << 'EOF'
#!/bin/bash

echo "=== ESTADO DE SERVICIOS ==="
echo "Gunicorn: $(systemctl is-active gunicorn)"
echo "Nginx: $(systemctl is-active nginx)"
echo ""

echo "=== ÚLTIMOS ERRORES ==="
echo "Gunicorn (últimos 5 errores):"
journalctl -u gunicorn --since "1 hour ago" | grep -i error | tail -5
echo ""

echo "Nginx (últimos 5 errores):"
tail -20 /var/log/nginx/error.log | grep -i error | tail -5
echo ""

echo "=== USO DE RECURSOS ==="
echo "CPU y Memoria:"
ps aux | grep -E "(gunicorn|nginx)" | grep -v grep
echo ""

echo "=== CONECTIVIDAD ==="
echo "Puerto 80: $(ss -tlnp | grep :80 || echo 'No activo')"
echo "Socket Gunicorn: $(ls -la /run/gunicorn.sock 2>/dev/null || echo 'No encontrado')"
EOF

chmod +x /usr/local/bin/monitor-services.sh
```

### 3. Configurar logrotate

```bash
# Configurar rotación de logs personalizados
sudo tee /etc/logrotate.d/django-app > /dev/null << EOF
/var/www/Proyecto-Lenguaje-Gestos/Backend/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        systemctl reload gunicorn
    endscript
}
EOF
```

---

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. Gunicorn no inicia
```bash
# Verificar configuración
sudo systemctl status gunicorn
sudo journalctl -u gunicorn --no-pager

# Verificar permisos
ls -la /var/www/Proyecto-Lenguaje-Gestos/
ls -la /run/gunicorn.sock

# Probar manualmente
cd /var/www/Proyecto-Lenguaje-Gestos/Backend
source ../venv/bin/activate
gunicorn --bind 127.0.0.1:8000 core.wsgi:application
```

#### 2. Nginx 502 Bad Gateway
```bash
# Verificar socket de Gunicorn
sudo systemctl status gunicorn.socket
ls -la /run/gunicorn.sock

# Verificar configuración de Nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log

# Verificar permisos del socket
sudo chown www-data:www-data /run/gunicorn.sock
```

#### 3. Problemas de permisos
```bash
# Ajustar permisos del proyecto
sudo chown -R $USER:www-data /var/www/Proyecto-Lenguaje-Gestos
sudo chmod -R 755 /var/www/Proyecto-Lenguaje-Gestos
sudo chmod -R 775 /var/www/Proyecto-Lenguaje-Gestos/Backend/static
sudo chmod -R 775 /var/www/Proyecto-Lenguaje-Gestos/Backend/media
```

#### 4. Django ALLOWED_HOSTS
```bash
# Verificar configuración
cd /var/www/Proyecto-Lenguaje-Gestos/Backend
python manage.py shell
>>> from django.conf import settings
>>> print(settings.ALLOWED_HOSTS)
```

### Comandos de Emergencia

```bash
# Reinicio completo de servicios
sudo systemctl restart gunicorn nginx

# Verificación rápida
curl -I http://localhost
curl -I https://devproyectos.com

# Rollback rápido
cd /var/www/Proyecto-Lenguaje-Gestos
git reset --hard HEAD~1
./deploy.sh

# Modo de mantenimiento (opcional)
echo "Sitio en mantenimiento" | sudo tee /var/www/html/maintenance.html
# Configurar Nginx para mostrar página de mantenimiento
```

---

## ✅ Checklist de Configuración

- [ ] VPS actualizado y dependencias instaladas
- [ ] Proyecto clonado en `/var/www/Proyecto-Lenguaje-Gestos`
- [ ] Entorno virtual creado y dependencias instaladas
- [ ] Archivos `gunicorn.service` y `gunicorn.socket` copiados a `/etc/systemd/system/`
- [ ] Usuario correcto configurado en `gunicorn.service`
- [ ] Servicios habilitados con `systemctl enable`
- [ ] Nginx configurado con el archivo `nginx-devproyectos.conf`
- [ ] SSL configurado con Let's Encrypt
- [ ] Script `deploy.sh` instalado y ejecutable
- [ ] Permisos correctos en directorios del proyecto
- [ ] Logs funcionando correctamente
- [ ] Backup automático configurado
- [ ] Monitoreo básico implementado

---

**🎯 Resultado Final:**
- Despliegue automático con `./deploy.sh`
- Servicios que se inician automáticamente al reiniciar el VPS
- Logs centralizados y fáciles de consultar
- Rollback rápido en caso de problemas
- Opciones de automatización avanzada con Git hooks o GitHub Actions