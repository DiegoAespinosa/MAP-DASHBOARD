#!/bin/sh
# Copia diaria de PostgreSQL con rotación. Corre dentro del servicio "backups".
set -e
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
mkdir -p /backups
while true; do
  STAMP=$(date +%Y%m%d-%H%M%S)
  FILE="/backups/map_dashboard-$STAMP.dump"
  if pg_dump -Fc -f "$FILE"; then
    echo "[backup] $FILE"
  else
    echo "[backup] ERROR al generar $FILE"
  fi
  find /backups -name 'map_dashboard-*.dump' -mtime +"$RETENTION" -delete
  # Espera hasta las 02:00 del día siguiente (hora del contenedor, UTC).
  NOW=$(date +%s)
  NEXT=$(date -d "tomorrow 02:00" +%s 2>/dev/null || echo $((NOW + 86400)))
  sleep $((NEXT - NOW))
done
