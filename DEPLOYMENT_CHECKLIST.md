# 📋 Checklist de Despliegue - Proyecto Lenguaje Gestos

## 🌐 Configuración DNS en Hostinger

### Registros DNS Requeridos

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|----- |
| A | @ | 89.116.186.216 | 3600 |
| A | www | 89.116.186.216 | 3600 |
| CNAME | * | devproyectos.com | 3600 |

### ⚠️ Registros a ELIMINAR
- **AAAA (IPv6)**: Eliminar todos los registros AAAA si no usas IPv6
- **Registros duplicados**: Verificar que no haya registros A duplicados

---

## 🚀 Pasos de Instalación en VPS

### 1. Preparar el VPS
```bash
# Conectar como root
ssh root@89.116.186.216

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Git si no está instalado
apt install git -y
```

### 2. Clonar y ejecutar setup
```bash
# Clonar el repositorio
git clone https://github.com/ct-leo/Proyecto-Lenguaje-Gestos.git /var/www/Proyecto-Lenguaje-Gestos

# Ir al directorio
cd /var/www/Proyecto-Lenguaje-Gestos

# Cambiar al branch correcto
git checkout VISTA-2-ADRIEL

# Hacer ejecutable el script
chmod +x setup-vps.sh

# Ejecutar setup (como root)
./setup-vps.sh
```

### 3. Configurar SSL con Certbot
```bash
# Obtener certificados SSL
certbot --nginx -d devproyectos.com -d www.devproyectos.com

# Verificar renovación automática
certbot renew --dry-run
```

---

## 🔧 Comandos de Verificación

### Verificar Nginx
```bash
# Probar configuración
nginx -t

# Estado del servicio
systemctl status nginx

# Recargar configuración
systemctl reload nginx

# Ver logs de error
tail -f /var/log/nginx/error.log
```

### Verificar Gunicorn
```bash
# Estado del servicio
systemctl status gunicorn

# Ver logs
journalctl -u gunicorn -f

# Reiniciar servicio
systemctl restart gunicorn

# Verificar socket
ls -la /run/gunicorn.sock
```

### Verificar Django
```bash
# Ir al directorio del backend
cd /var/www/Proyecto-Lenguaje-Gestos/Backend

# Activar entorno virtual
source /var/www/Proyecto-Lenguaje-Gestos/venv/bin/activate

# Verificar configuración
python manage.py check

# Ver migraciones pendientes
python manage.py showmigrations

# Probar collectstatic
python manage.py collectstatic --dry-run
```

---

## 🧪 Pruebas de Funcionamiento

### Pruebas desde el servidor
```bash
# Probar conexión local
curl -I http://localhost

# Probar API local
curl http://localhost/vista02/api/

# Probar HTTPS local
curl -I https://localhost
```

### Pruebas externas
```bash
# Probar dominio HTTP (debe redirigir a HTTPS)
curl -I http://devproyectos.com

# Probar dominio HTTPS
curl -I https://devproyectos.com

# Probar API
curl https://devproyectos.com/vista02/api/

# Probar www
curl -I https://www.devproyectos.com
```

---

## 📦 Uso del Script de Despliegue

### Comandos disponibles
```bash
# Despliegue normal (branch por defecto: VISTA-2-ADRIEL)
./deploy.sh deploy

# Despliegue desde branch específico
./deploy.sh deploy main
./deploy.sh deploy VISTA-2-ADRIEL

# Ver estado de servicios
./deploy.sh status

# Ver logs
./deploy.sh logs

# Rollback a backup anterior
./deploy.sh rollback

# Ayuda
./deploy.sh help
```

---

## 🔍 Diagnóstico de Problemas

### Error 500 - Internal Server Error
```bash
# Verificar logs de Django
journalctl -u gunicorn -n 50

# Verificar logs de Nginx
tail -n 50 /var/log/nginx/error.log

# Verificar permisos
ls -la /var/www/Proyecto-Lenguaje-Gestos/
ls -la /run/gunicorn.sock
```

### Error 502 - Bad Gateway
```bash
# Verificar que Gunicorn esté corriendo
systemctl status gunicorn

# Verificar socket
ls -la /run/gunicorn.sock

# Reiniciar Gunicorn
systemctl restart gunicorn
```

### Error 404 - Not Found
```bash
# Verificar archivos estáticos
ls -la /var/www/Proyecto-Lenguaje-Gestos/Frontend/dist/

# Verificar configuración de Nginx
nginx -t
cat /etc/nginx/sites-available/devproyectos.conf
```

---

## 📁 Estructura de Archivos

```
/var/www/Proyecto-Lenguaje-Gestos/
├── Backend/                 # Django backend
│   ├── manage.py
│   ├── core/               # Configuración Django
│   └── ...
├── Frontend/               # Frontend React/Vue
│   ├── dist/              # Archivos compilados
│   ├── package.json
│   └── ...
├── venv/                  # Entorno virtual Python
├── backups/               # Backups de base de datos
├── setup-vps.sh          # Script de instalación
├── deploy.sh              # Script de despliegue
├── nginx-devproyectos.conf # Configuración Nginx
├── gunicorn.service       # Servicio Gunicorn
└── gunicorn.socket        # Socket Gunicorn
```

---

## ✅ Checklist Final

- [ ] DNS configurado en Hostinger
- [ ] Registros AAAA eliminados
- [ ] VPS actualizado y preparado
- [ ] Repositorio clonado en `/var/www/Proyecto-Lenguaje-Gestos`
- [ ] Branch `VISTA-2-ADRIEL` activo
- [ ] Script `setup-vps.sh` ejecutado exitosamente
- [ ] Nginx configurado y funcionando
- [ ] Gunicorn configurado y funcionando
- [ ] SSL configurado con Let's Encrypt
- [ ] Frontend accesible en `https://devproyectos.com`
- [ ] API accesible en `https://devproyectos.com/vista02/api/`
- [ ] Script `deploy.sh` funcional
- [ ] Backups automáticos configurados
- [ ] Logs monitoreados

---

## 🆘 Contacto y Soporte

Si encuentras problemas:
1. Revisa los logs con `./deploy.sh logs`
2. Verifica el estado con `./deploy.sh status`
3. Consulta este checklist
4. Ejecuta las pruebas de diagnóstico

**¡Tu aplicación Django debería estar funcionando en https://devproyectos.com! 🎉**