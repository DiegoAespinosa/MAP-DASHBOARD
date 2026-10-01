# Imagen oficial de Playwright: trae Node y Chromium con sus dependencias (sin descargas en la VPS).
FROM mcr.microsoft.com/playwright:v1.62.0-noble

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_DATA_DIR=/app/data

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npx prisma generate && npm run build

RUN mkdir -p /app/data && chown -R pwuser:pwuser /app
USER pwuser

EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
