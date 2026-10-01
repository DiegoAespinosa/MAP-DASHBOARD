# MAP-DASHBOARD

Página interna que muestra los indicadores de INAPA en SISMAP, con un botón para actualizar los datos desde la plataforma y otro para exportarlos a Excel.

Stack previsto: Next.js + TypeScript + Tailwind, Prisma + PostgreSQL, Playwright, Docker Compose + Caddy en una VPS Ubuntu.

## Estado por fases

| Fase | Estado | Documento |
|---|---|---|
| 0 - Auditoría del repositorio | Completada | [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md) |
| 1 - Reconocimiento de URLs del MAP | Completada: 4 URL de SISMAP, sin JSON/API, exportación tabular + DOM | [docs/MAP_RECONNAISSANCE.md](docs/MAP_RECONNAISSANCE.md) |
| 2 - Diseño mínimo (una página, actualizar, exportar) | Aprobado | [docs/PLAN.md](docs/PLAN.md) |
| 3 - Implementación | Completada: página, actualización real contra SISMAP, exportación Excel, notas, Docker | [docs/DEPLOY.md](docs/DEPLOY.md) |

## Desarrollo local

```bash
cp .env.example .env        # MAP_URL_n, MAP_USERNAME/MAP_PASSWORD, DATABASE_URL
npm install
npx prisma migrate deploy   # crea las tablas
npm run db:seed             # carga las 4 fuentes desde MAP_URL_n
npm run dev                 # http://localhost:3000
npm test                    # parsers contra HTML real de SISMAP
npm run refresh -- --dry-run  # actualización de prueba sin guardar
```

Despliegue en la VPS: [docs/DEPLOY.md](docs/DEPLOY.md).

## Ejecutar el reconocimiento (Fase 1)

```bash
cp .env.example .env        # completar MAP_URL_n y la cuenta autorizada
cd tools/recon
npm install
npm run recon:login         # login manual autorizado (navegador visible)
npm run recon               # genera docs/recon/AUTO_REPORT.md y docs/recon/<fuente>/
```

Detalles en [tools/recon/README.md](tools/recon/README.md).

## Reglas del proyecto

- Alcance mínimo: una página, un backend que descarga los datos de SISMAP, botón "Actualizar datos" y botón "Exportar".
- Las URL de SISMAP viven en configuración o base de datos, nunca en código.
- Una actualización fallida nunca borra los datos anteriores.
- Credenciales solo en variables de entorno del servidor; nunca en Git.
- No se evaden MFA, CAPTCHA ni controles anti-automatización.
