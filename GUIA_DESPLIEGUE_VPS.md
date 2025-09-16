# 🚀 Guía de Despliegue y Reinicio en VPS

**Proyecto:** Proyecto-Lenguaje-Gestos  
**Repositorio:** https://github.com/ct-leo/Proyecto-Lenguaje-Gestos.git  
**Dominio:** devproyectos.com  
**Servidor:** Ubuntu 22.04 + Nginx + Gunicorn + Certbot  
**Usuario:** root  

---

## 1. 🔄 Actualizar Servidor

```bash
# Actualizar paquetes del sistema
apt update && apt upgrade -y

# Limpiar paquetes innecesarios
apt autoremove -y
apt autoclean

# Verificar espacio en disco
df -h
```

---

## 2. 📥 Obtener Cambios del Repositorio

### Opción A: Actualizar branch VISTA-2-ADRIEL (recomendado)
```bash
# Ir al directorio del proyecto
cd /var/www/Proyecto-Lenguaje-Gestos

# Obtener todos los cambios remotos
git fetch --all

# Cambiar al branch VISTA-2-ADRIEL
git checkout VISTA-2-ADRIEL

# Forzar actualización (descarta cambios locales)
git reset --hard origin/VISTA-2-ADRIEL

# Verificar branch actual
git branch
git log --oneline -5
```

### Opción B: Actualizar branch main
```bash
# Ir al directorio del proyecto
cd /var/www/Proyecto-Lenguaje-Gestos

# Obtener todos los cambios remotos
git fetch --all

# Cambiar al branch main
git checkout main

# Forzar actualización (descarta cambios locales)
git reset --hard origin/main

# Verificar branch actual
git branch
git log --oneline -5
```

---

## 3. 🐍 Recrear Entorno Virtual

```bash
# Ir al directorio del proyecto
cd /var/www/Proyecto-Lenguaje-Gestos

# Eliminar entorno virtual anterior
rm -rf venv

# Crear nuevo entorno virtual
python3 -m venv venv

# Activar entorno virtual
source venv/bin/activate

# Actualizar pip
pip install --upgrade pip

# Instalar dependencias del backend
pip install -r Backend/requirements.txt

# Verificar instalación
pip list | grep -E "Django|gunicorn|psycopg2|pillow"
```

---

## 4. 🗃️ Migraciones y Archivos Estáticos

```bash
# Ir al directorio del backend
cd /var/www/Proyecto-Lenguaje-Gestos/Backend

# Activar entorno virtual
source ../venv/bin/activate

# Verificar configuración de Django
python manage.py check

# Ejecutar migraciones
python manage.py migrate

# Recopilar archivos estáticos
python manage.py collectstatic --noinput

# Verificar archivos estáticos
ls -la /var/www/Proyecto-Lenguaje-Gestos/Backend/staticfiles/
```

---

## 5. 🔧 Compilar Frontend (si aplica)

```bash
# Ir al directorio del frontend
cd /var/www/Proyecto-Lenguaje-Gestos/Frontend

# Verificar si existe package.json
if [ -f "package.json" ]; then
    echo "Frontend encontrado, compilando..."
    
    # Instalar dependencias
    npm install
    
    # Compilar para producción
    npm run build
    
    # Verificar archivos compilados
    ls -la dist/
else
    echo "No se encontró package.json, saltando compilación de frontend"
fi
```

---

## 6. 🔄 Reiniciar Servicios

```bash
# Recargar configuración de systemd
systemctl daemon-reload

# Reiniciar Gunicorn
systemctl restart gunicorn

# Reiniciar Nginx
systemctl restart nginx

# Verificar que los servicios estén activos
systemctl is-active gunicorn
systemctl is-active nginx
```

---

## 7. ✅ Verificar Estado de Servicios

```bash
# Estado de Gunicorn
echo "=== ESTADO GUNICORN ==="
systemctl status gunicorn --no-pager

echo ""
echo "=== ESTADO NGINX ==="
# Estado de Nginx
systemctl status nginx --no-pager

echo ""
echo "=== VERIFICAR SOCKET GUNICORN ==="
# Verificar socket de Gunicorn
ls -la /run/gunicorn.sock

echo ""
echo "=== PROCESOS ACTIVOS ==="
# Verificar procesos
ps aux | grep -E "gunicorn|nginx" | grep -v grep
```

---

## 8. 📋 Revisar Logs

```bash
echo "=== LOGS GUNICORN (últimas 50 líneas) ==="
journalctl -u gunicorn -n 50 --no-pager

echo ""
echo "=== LOGS NGINX ERROR (últimas 50 líneas) ==="
tail -n 50 /var/log/nginx/error.log

echo ""
echo "=== LOGS NGINX ACCESS (últimas 20 líneas) ==="
tail -n 20 /var/log/nginx/access.log
```

---

## 9. 🧪 Comprobación Final

```bash
echo "=== PRUEBAS DE CONECTIVIDAD ==="

# Probar conexión local HTTP
echo "Probando HTTP local..."
curl -I http://localhost

echo ""
# Probar conexión local HTTPS
echo "Probando HTTPS local..."
curl -I https://localhost

echo ""
# Probar dominio HTTP (debe redirigir a HTTPS)
echo "Probando dominio HTTP..."
curl -I http://devproyectos.com

echo ""
# Probar dominio HTTPS
echo "Probando dominio HTTPS..."
curl -I https://devproyectos.com

echo ""
# Probar API
echo "Probando API..."
curl -I https://devproyectos.com/vista02/api/

echo ""
# Verificar certificado SSL
echo "Verificando certificado SSL..."
echo | openssl s_client -servername devproyectos.com -connect devproyectos.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## 10. 🔧 Comandos de Diagnóstico Adicionales

### Si hay problemas con Gunicorn:
```bash
# Verificar configuración de Gunicorn
cat /etc/systemd/system/gunicorn.service

# Probar Gunicorn manualmente
cd /var/www/Proyecto-Lenguaje-Gestos/Backend
source ../venv/bin/activate
gunicorn --bind unix:/run/gunicorn.sock core.wsgi:application
```

### Si hay problemas con Nginx:
```bash
# Verificar configuración de Nginx
nginx -t

# Ver configuración del sitio
cat /etc/nginx/sites-available/devproyectos.conf

# Verificar que el sitio esté habilitado
ls -la /etc/nginx/sites-enabled/
```

### Si hay problemas con SSL:
```bash
# Verificar certificados
certbot certificates

# Renovar certificados (si es necesario)
certbot renew --dry-run
```

---

## 📝 Script de Despliegue Rápido

**Para uso futuro, puedes usar el script automatizado:**

```bash
# Hacer ejecutable el script de despliegue
chmod +x /var/www/Proyecto-Lenguaje-Gestos/deploy.sh

# Despliegue desde branch VISTA-2-ADRIEL
/var/www/Proyecto-Lenguaje-Gestos/deploy.sh deploy VISTA-2-ADRIEL

# Despliegue desde branch main
/var/www/Proyecto-Lenguaje-Gestos/deploy.sh deploy main

# Ver estado de servicios
/var/www/Proyecto-Lenguaje-Gestos/deploy.sh status

# Ver logs
/var/www/Proyecto-Lenguaje-Gestos/deploy.sh logs
```

---

## ⚠️ Notas Importantes

1. **Backup**: Siempre haz backup de la base de datos antes de desplegar:
   ```bash
   cd /var/www/Proyecto-Lenguaje-Gestos/Backend
   source ../venv/bin/activate
   python manage.py dumpdata > backup_$(date +%Y%m%d_%H%M%S).json
   ```

2. **Permisos**: Verifica que los permisos sean correctos:
   ```bash
   chown -R root:www-data /var/www/Proyecto-Lenguaje-Gestos
   chmod -R 755 /var/www/Proyecto-Lenguaje-Gestos
   ```

3. **Firewall**: Asegúrate de que el firewall permita tráfico HTTP/HTTPS:
   ```bash
   ufw status
   ufw allow 'Nginx Full'
   ```

---

## 🎯 Resultado Esperado

Después de ejecutar todos estos comandos:

- ✅ **Frontend**: Disponible en https://devproyectos.com
- ✅ **API**: Disponible en https://devproyectos.com/vista02/api/
- ✅ **SSL**: Certificado válido y renovación automática
- ✅ **Servicios**: Gunicorn y Nginx funcionando correctamente
- ✅ **Logs**: Sin errores críticos

**¡Tu aplicación Django está lista en producción! 🚀**