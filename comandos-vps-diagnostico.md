# Comandos para Diagnóstico y Configuración del VPS

## 1. Verificar Estado Actual del Sistema

### Verificar si Nginx está instalado y corriendo
```bash
sudo systemctl status nginx
nginx -v
```

### Verificar si Gunicorn está corriendo
```bash
ps aux | grep gunicorn
sudo netstat -tlnp | grep :8000
```

### Verificar configuración DNS actual
```bash
nslookup devproyectos.com
nslookup www.devproyectos.com
nslookup api.devproyectos.com
```

### Verificar qué está escuchando en los puertos
```bash
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
sudo netstat -tlnp | grep :8000
```

## 2. Configurar Nginx

### Copiar configuración al servidor
```bash
# Subir el archivo nginx-devproyectos.conf al VPS
sudo cp nginx-devproyectos.conf /etc/nginx/sites-available/devproyectos.com
```

### Habilitar el sitio
```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/devproyectos.com /etc/nginx/sites-enabled/

# Deshabilitar sitio por defecto si existe
sudo rm -f /etc/nginx/sites-enabled/default
```

### Verificar configuración de Nginx
```bash
sudo nginx -t
```

### Reiniciar Nginx
```bash
sudo systemctl reload nginx
sudo systemctl restart nginx
```

## 3. Configurar Gunicorn como Servicio

### Crear archivo de servicio systemd
```bash
sudo nano /etc/systemd/system/gunicorn-django.service
```

### Contenido del archivo de servicio:
```ini
[Unit]
Description=Gunicorn instance to serve Django
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/your/Backend
Environment="PATH=/path/to/your/venv/bin"
ExecStart=/path/to/your/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 core.wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

### Habilitar y iniciar el servicio
```bash
sudo systemctl daemon-reload
sudo systemctl enable gunicorn-django
sudo systemctl start gunicorn-django
sudo systemctl status gunicorn-django
```

## 4. Resolver Problema de IPv6

### Verificar configuración DNS actual
```bash
dig devproyectos.com A
dig devproyectos.com AAAA
```

### Opciones para resolver IPv6:

#### Opción A: Eliminar registro AAAA en el panel de Hostinger
- Ir al panel de control de Hostinger
- Eliminar el registro AAAA: `2a02:4780:13:1944:0:2e82:d814:d`
- Mantener solo registros A apuntando a `89.116.186.216`

#### Opción B: Configurar IPv6 en el VPS (más complejo)
```bash
# Verificar si el VPS tiene IPv6 configurado
ip -6 addr show
# Si no tiene IPv6, es mejor eliminar el registro AAAA
```

## 5. Verificar Configuración Django

### Probar Django directamente
```bash
# En el directorio del backend
cd /path/to/Backend
source venv/bin/activate
python manage.py runserver 127.0.0.1:8000
```

### Probar endpoint específico
```bash
curl -X POST http://127.0.0.1:8000/vista02/api/predict \
  -H "Content-Type: application/json" \
  -d '{"landmarks": [], "feature": []}'
```

## 6. Logs para Diagnóstico

### Ver logs de Nginx
```bash
sudo tail -f /var/log/nginx/devproyectos_access.log
sudo tail -f /var/log/nginx/devproyectos_error.log
sudo tail -f /var/log/nginx/error.log
```

### Ver logs de Gunicorn
```bash
sudo journalctl -u gunicorn-django -f
```

### Ver logs del sistema
```bash
sudo journalctl -f
```

## 7. Pruebas de Conectividad

### Desde el VPS, probar conectividad local
```bash
curl -I http://127.0.0.1:8000/vista02/api/predict
wget -O- http://127.0.0.1:8000/vista02/api/predict
```

### Desde exterior, probar el dominio
```bash
curl -I https://devproyectos.com/vista02/api/predict
```

## 8. Configuración de Firewall (si aplica)

### Verificar reglas de firewall
```bash
sudo ufw status
sudo iptables -L
```

### Abrir puertos necesarios
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
# NO abrir puerto 8000 externamente (solo interno)
```

## 9. Certificados SSL

### Si usas Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d devproyectos.com -d www.devproyectos.com
```

### Verificar certificados
```bash
sudo certbot certificates
```

## 10. Monitoreo Continuo

### Script para monitorear el servicio
```bash
#!/bin/bash
# monitor.sh
while true; do
    echo "$(date): Checking services..."
    systemctl is-active nginx
    systemctl is-active gunicorn-django
    curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/vista02/api/predict
    echo ""
    sleep 30
done
```

## Resumen de Pasos Críticos:

1. **Eliminar registro AAAA IPv6** en Hostinger
2. **Instalar configuración Nginx** proporcionada
3. **Configurar Gunicorn como servicio** systemd
4. **Verificar que Django responde** en puerto 8000
5. **Probar proxy de Nginx** hacia Django
6. **Verificar logs** para errores específicos

## Comandos de Emergencia:

```bash
# Reiniciar todos los servicios
sudo systemctl restart nginx
sudo systemctl restart gunicorn-django

# Ver estado completo
sudo systemctl status nginx gunicorn-django

# Verificar conectividad completa
curl -v https://devproyectos.com/vista02/api/predict
```