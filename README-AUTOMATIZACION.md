# 🚀 Sistema de Automatización de Despliegue Django

## 📋 Resumen

Sistema completo de automatización para despliegue de Django con Gunicorn y Nginx en VPS Ubuntu (Hostinger), incluyendo:

- ✅ **Script de despliegue automático** (`deploy.sh`)
- ✅ **Configuración de servicios systemd** (Gunicorn + Nginx)
- ✅ **Configuración SSL automática** (Let's Encrypt)
- ✅ **CI/CD con GitHub Actions**
- ✅ **Git hooks para despliegue automático**
- ✅ **API de control de servicios** (opcional)
- ✅ **Logs centralizados y debugging**
- ✅ **Script de configuración inicial del VPS**

---

## 🎯 Archivos Creados

| Archivo | Descripción | Ubicación Final |
|---------|-------------|----------------|
| `deploy.sh` | Script principal de despliegue | `/usr/local/bin/deploy.sh` |
| `gunicorn.service` | Servicio systemd para Gunicorn | `/etc/systemd/system/` |
| `gunicorn.socket` | Socket systemd para Gunicorn | `/etc/systemd/system/` |
| `nginx-devproyectos.conf` | Configuración de Nginx | `/etc/nginx/sites-available/` |
| `github-actions-deploy.yml` | Workflow CI/CD | `.github/workflows/deploy.yml` |
| `setup-vps.sh` | Configuración automática del VPS | Ejecutar una vez |
| `guia-configuracion-vps.md` | Documentación completa | Referencia |






---

## 🚀 Instalación Rápida

### Opción 1: Script Automático (Recomendado)

```bash
# 1. Conectar al VPS
ssh usuario@tu-vps-ip

# 2. Descargar y ejecutar script de configuración
wget https://raw.githubusercontent.com/tu-usuario/Proyecto-Lenguaje-Gestos/main/setup-vps.sh
chmod +x setup-vps.sh

# 3. IMPORTANTE: Editar el script antes de ejecutar
nano setup-vps.sh
# Cambiar:
# - GIT_REPO="https://github.com/TU-USUARIO/Proyecto-Lenguaje-Gestos.git"
# - DOMAIN="tu-dominio.com"

# 4. Ejecutar configuración
./setup-vps.sh
```

### Opción 2: Instalación Manual

Sigue la guía completa en `guia-configuracion-vps.md`

---

## 📦 Uso del Sistema

### Despliegue Manual

```bash
# Despliegue básico (branch main)
cd /var/www/Proyecto-Lenguaje-Gestos
./deploy.sh

# Despliegue de branch específico
./deploy.sh deploy develop

# Ver estado de servicios
./deploy.sh status

# Ver logs recientes
./deploy.sh logs

# Rollback al commit anterior
./deploy.sh rollback
```

### Despliegue Automático con Git

```bash
# En tu máquina local
git add .
git commit -m "Nueva funcionalidad"
git push production main  # Despliega automáticamente
```

### Despliegue con GitHub Actions

1. **Configurar secrets en GitHub:**
   - `VPS_HOST`: IP de tu VPS
   - `VPS_USERNAME`: Usuario SSH
   - `VPS_SSH_KEY`: Clave privada SSH

2. **Push automático:**
   ```bash
   git push origin main  # Despliega automáticamente
   ```

3. **Despliegue manual:**
   - Ir a Actions en GitHub
   - Ejecutar "Deploy Django to VPS" manualmente

---

## 🔧 Configuración Inicial Requerida

### 1. En el VPS

```bash
# Editar configuración de Gunicorn con tu usuario
sudo nano /etc/systemd/system/gunicorn.service
# Cambiar 'www-data' por tu usuario real (ej: ubuntu)

# Editar configuración de Nginx con tu dominio
sudo nano /etc/nginx/sites-available/devproyectos
# Cambiar 'devproyectos.com' por tu dominio real
```

### 2. En Django (settings.py)

```python
# Ya configurado en tu proyecto
ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    "devproyectos.com",
    "www.devproyectos.com",
    "api.devproyectos.com",  # Para subdominio API
]
```

### 3. DNS en Hostinger

```
Tipo  | Nombre | Valor
------|--------|-------
A     | @      | IP_DE_TU_VPS
A     | www    | IP_DE_TU_VPS
A     | api    | IP_DE_TU_VPS  (opcional)
```

---

## 📊 Monitoreo y Logs

### Comandos Esenciales

```bash
# Logs de Gunicorn
sudo journalctl -u gunicorn -f
sudo journalctl -u gunicorn --since "1 hour ago"

# Logs de Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Estado de servicios
sudo systemctl status gunicorn nginx

# Reiniciar servicios
sudo systemctl restart gunicorn nginx
```

### Script de Monitoreo

```bash
# Ejecutar script de monitoreo
/usr/local/bin/monitor-services.sh
```

---

## 🔒 API de Control (Opcional)

### Instalación

```bash
# Crear directorio para la API
sudo mkdir -p /var/www/service-control-api
cd /var/www/service-control-api

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate
pip install flask

# Copiar código de la API (ver guia-configuracion-vps.md)
# Configurar servicio systemd
# Configurar token secreto
```

### Uso

```bash
# Reiniciar Gunicorn
curl -X POST http://localhost:5001/restart/gunicorn \
     -H "Authorization: Bearer tu-token-secreto"

# Ejecutar despliegue
curl -X POST http://localhost:5001/deploy \
     -H "Authorization: Bearer tu-token-secreto"
```

---

## 🚨 Troubleshooting

### Problemas Comunes

#### 1. Gunicorn no inicia
```bash
# Verificar logs
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
# Verificar socket
sudo systemctl status gunicorn.socket
ls -la /run/gunicorn.sock

# Verificar configuración
sudo nginx -t

# Ajustar permisos
sudo chown www-data:www-data /run/gunicorn.sock
```

#### 3. SSL no funciona
```bash
# Verificar DNS
dig +short tu-dominio.com

# Renovar certificado
sudo certbot renew

# Verificar configuración
sudo nginx -t
```

### Comandos de Emergencia

```bash
# Reinicio completo
sudo systemctl restart gunicorn nginx

# Rollback rápido
cd /var/www/Proyecto-Lenguaje-Gestos
git reset --hard HEAD~1
./deploy.sh

# Verificación rápida
curl -I http://localhost
curl -I https://tu-dominio.com
```

---

## 📈 Flujo de Trabajo Recomendado

### Desarrollo Local
```bash
# 1. Desarrollar funcionalidad
git checkout -b nueva-funcionalidad
# ... hacer cambios ...
git add .
git commit -m "Nueva funcionalidad"

# 2. Push a branch de desarrollo
git push origin nueva-funcionalidad

# 3. Crear Pull Request
# 4. Merge a main después de review
```

### Despliegue a Producción
```bash
# Opción 1: Automático (GitHub Actions)
git push origin main  # Se despliega automáticamente

# Opción 2: Manual desde VPS
ssh usuario@vps-ip
cd /var/www/Proyecto-Lenguaje-Gestos
./deploy.sh

# Opción 3: Git hook
git push production main  # Si configuraste git hooks
```

### Monitoreo Post-Despliegue
```bash
# Verificar servicios
./deploy.sh status

# Ver logs en tiempo real
./deploy.sh logs

# Test de conectividad
curl -X POST https://tu-dominio.com/vista02/api/predict \
     -H "Content-Type: application/json" \
     -d '{"landmarks": [], "feature": []}'
```

---

## ✅ Checklist de Configuración

- [ ] VPS configurado con Ubuntu
- [ ] Dominio apuntando al VPS
- [ ] Repositorio Git configurado
- [ ] Script `setup-vps.sh` personalizado y ejecutado
- [ ] Servicios systemd funcionando
- [ ] Nginx configurado y SSL activo
- [ ] Script de despliegue probado
- [ ] GitHub Actions configurado (opcional)
- [ ] Git hooks configurados (opcional)
- [ ] API de control configurada (opcional)
- [ ] Monitoreo y logs funcionando
- [ ] Backup automático configurado
- [ ] Documentación del equipo actualizada

---

## 🎯 Beneficios Obtenidos

✅ **Despliegue en 1 comando:** `./deploy.sh`  
✅ **Servicios automáticos:** Se inician solos al reiniciar VPS  
✅ **Rollback rápido:** En caso de problemas  
✅ **Logs centralizados:** Fácil debugging  
✅ **SSL automático:** Certificados renovados automáticamente  
✅ **CI/CD completo:** Push → Test → Deploy automático  
✅ **Monitoreo:** Estado de servicios en tiempo real  
✅ **Seguridad:** Configuración hardened de Nginx y systemd  

---

## 📞 Soporte

Para problemas o dudas:

1. **Revisar logs:** `./deploy.sh logs`
2. **Consultar documentación:** `guia-configuracion-vps.md`
3. **Verificar servicios:** `./deploy.sh status`
4. **Rollback si es necesario:** `./deploy.sh rollback`

---

**🎉 ¡Tu sistema de despliegue automático está listo!**

Ahora puedes enfocarte en desarrollar funcionalidades mientras el despliegue se maneja automáticamente. 🚀