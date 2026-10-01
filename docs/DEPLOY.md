# Despliegue en la VPS (Ubuntu + Docker)

## 1. Requisitos
- Ubuntu 22.04/24.04 con Docker y el plugin Compose (`docker compose version`).
- Un dominio apuntando a la VPS (recomendado) o la IP pública.
- Puertos 80 y 443 abiertos; 22 restringido a la IP de administración.

## 2. Instalación
```bash
git clone <repositorio> /opt/map-dashboard
cd /opt/map-dashboard
cp .env.example .env
nano .env        # ver variables abajo
chmod 600 .env
docker compose up -d --build
docker compose logs -f app   # debe mostrar "iniciando la aplicación"
```
La primera vez tarda unos minutos (construye la imagen). Al arrancar, la app aplica las migraciones y siembra las 4 fuentes desde `MAP_URL_n`.

Variables obligatorias en `.env`:

| Variable | Descripción |
|---|---|
| `DOMAIN` | dominio (p. ej. `sismap.inapa.gob.do`) o IP pública |
| `POSTGRES_PASSWORD` | contraseña de la base de datos (solo interna) |
| `MAP_USERNAME`, `MAP_PASSWORD` | cuenta autorizada de SISMAP |
| `MAP_URL_1..4`, `MAP_URL_n_NAME` | las páginas de SISMAP a seguir |

Opcionales: `ADMIN_ALLOWED_CIDRS` (restringir por IP, separadas por espacio), `BACKUP_RETENTION_DAYS` (30), `MAP_LOGIN_URL`.

## 3. Uso
- Abrir `https://DOMAIN`. Pulsar **Actualizar datos**; la primera carga tarda 1-2 minutos (inicio de sesión en SISMAP + 4 fuentes).
- **Exportar a Excel** descarga indicadores y evidencias.
- Responsable y notas se editan en la tabla y se conservan en cada actualización.

## 4. Actualización automática (opcional)
La aplicación no actualiza sola. Para hacerlo dos veces al día, en el servidor:
```bash
crontab -e
0 6,14 * * * cd /opt/map-dashboard && docker compose exec -T app npm run refresh >> /var/log/map-refresh.log 2>&1
```

## 5. Cambiar una URL de SISMAP
Editar `MAP_URL_n` en `.env` y reiniciar (`docker compose up -d`): la semilla actualiza la tabla `Source` sin tocar indicadores ni notas. También puede editarse directamente la fila en la tabla `Source` (`url` y `exportUrl`).

## 6. Copias de seguridad
El servicio `backups` genera `pg_dump` diario en el volumen `backups` con rotación. Copiar fuera del servidor:
```bash
docker compose cp backups:/backups ./backups-copia
```
Restaurar:
```bash
docker compose stop app
docker compose exec -T postgres pg_restore --clean --if-exists -U map -d map_dashboard < backups-copia/map_dashboard-AAAAMMDD-HHMMSS.dump
docker compose start app
```

## 7. Actualizar la aplicación
```bash
cd /opt/map-dashboard && git pull && docker compose up -d --build
```

## 8. Problemas frecuentes
- **"SISMAP rechazó las credenciales"**: revisar `MAP_USERNAME`/`MAP_PASSWORD`; si SISMAP añadió CAPTCHA o segundo factor, la aplicación lo informa y no lo evade.
- **Una fuente en FAILED/ANOMALY**: el resto se actualiza igual y los datos anteriores de esa fuente se conservan; el mensaje aparece en la tarjeta de la fuente.
- **Actualización "en curso" bloqueada**: tras 20 minutos sin actividad se marca como fallida automáticamente.
- Logs: `docker compose logs -f app`.
