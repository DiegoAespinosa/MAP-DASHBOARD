#!/bin/sh
set -e
cd /app
echo "[entrypoint] aplicando migraciones"
npx prisma migrate deploy
echo "[entrypoint] sembrando fuentes desde variables MAP_URL_n"
npx tsx prisma/seed.ts
echo "[entrypoint] iniciando la aplicación"
exec npm run start
