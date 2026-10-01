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

Opcionales: `ADMIN_ALLOWED_CIDRS` (restringir por IP, separadas por espacio), `BACKUP_RETENTION_DAYS` (30), `MAP_LOGIN_URL`, `MAP_ORGANISM_MATCH` (fila del organismo en las páginas de ranking; por defecto `INAPA|Aguas Potables`).

## 3. Uso
- Abrir `https://DOMAIN`. Pulsar **Actualizar datos**; la primera carga tarda 1-2 minutos (inicio de sesión en SISMAP + 4 fuentes).
- **Exportar a Excel** descarga indicadores y evidencias.
- Responsable y contacto se editan en la tabla y se conservan en cada actualización.

## 4. Actualización automática (opcional)
La aplicación no actualiza sola. Para hacerlo dos veces al día, en el servidor:
```bash
crontab -e
0 6,14 * * * cd /opt/map-dashboard && docker compose exec -T app npm run refresh >> /var/log/map-refresh.log 2>&1
```

## 5. Cambiar una URL de SISMAP
Editar `MAP_URL_n` en `.env` y reiniciar (`docker compose up -d`): la semilla actualiza la tabla `Source` sin tocar indicadores ni datos internos. En desarrollo local, tras cambiar `.env` ejecute `npm run db:seed`. Rutas reconocidas: `CargaEvidencia/Index/{id}`, `CargaEvidencia/PoliticasTransversales/{id}`, `CargaEvidenciaEdi/Index/{id}`, `Ranking/RankingEdiView`, `Ranking/InformeAnualEdiView`; para otra ruta, defina `MAP_URL_n_EXPORT` y `MAP_URL_n_KIND`. También puede editarse directamente la fila en la tabla `Source` (`url` y `exportUrl`).

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
- **"HTTP 500 al pedir ..."**: SISMAP falló momentáneamente. La aplicación reintenta 3 veces (2 s y 5 s de espera) y, si persiste, conserva los datos anteriores de esa fuente. Basta pulsar "Actualizar datos" más tarde.
- **Una fuente en FAILED/ANOMALY**: el resto se actualiza igual y los datos anteriores de esa fuente se conservan; el mensaje aparece en la tarjeta de la fuente.
- **Actualización "en curso" bloqueada**: tras 20 minutos sin actividad se marca como fallida automáticamente.
- Logs: `docker compose logs -f app`.

## 9. VPS que ya tiene nginx (sub-ruta, sin Caddy)
Si los puertos 80/443 ya los usa nginx con otro sitio, no se arranca Caddy: la app se publica solo en `127.0.0.1` y nginx la sirve bajo una sub-ruta (p. ej. `/map`).

En `.env`, además de las variables de la sección 2:
```bash
COMPOSE_FILE=docker-compose.yml:docker-compose.nginx.yml
BASE_PATH=/map
APP_PORT=3001
DOMAIN=ivd.inapa.gob.do   # no se usa sin Caddy, pero el compose base lo exige
```
`docker compose up -d --build` arranca `postgres`, `app` y `backups`. La sub-ruta se fija al compilar: cambiar `BASE_PATH` exige `--build`.

En el `server { }` del sitio existente de nginx:
```nginx
location ~ ^/map(/|$) {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # La app no tiene inicio de sesión: restringir aquí (auth_basic o allow/deny).
    # auth_basic "SISMAP INAPA";
    # auth_basic_user_file /etc/nginx/.htpasswd-map;
}
```
`ADMIN_ALLOWED_CIDRS` solo aplica con Caddy; en esta variante el control de acceso se hace en nginx.
