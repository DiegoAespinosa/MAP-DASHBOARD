# FASE 0 - Auditoría del proyecto

Fecha: 2026-09-30
Repositorio: `C:\dev\MAP-DASHBOARD`
Alcance: inspección completa del repositorio y del entorno de desarrollo antes de escribir código de producto.

## 1. Resultado principal

**El repositorio estaba completamente vacío.** No existía código, dependencias, configuración, Docker, variables de entorno, base de datos, ni historial de Git.

| Aspecto auditado | Hallazgo |
|---|---|
| Archivos en el repositorio | 0 |
| Control de versiones | No inicializado (se ejecutó `git init`; sin commits) |
| Tecnologías existentes | Ninguna |
| Estructura | Ninguna |
| Dependencias | Ninguna |
| Docker / Compose | No existe |
| Variables de entorno | No existen |
| Base de datos / migraciones | No existen |
| Seguridad (secretos, .gitignore) | No existía; se creó `.gitignore` con exclusión de `.env`, `.secrets/` y `*.storage-state.json` |
| Arquitectura | No existe; se diseñará en la Fase 2 |

Conclusión: **el proyecto se inicia desde cero.** No hubo nada que preservar ni riesgo de cambios destructivos.

## 2. Entorno de desarrollo verificado

| Herramienta | Versión detectada | Comentario |
|---|---|---|
| Sistema operativo | Windows 11 Home 10.0.26300 | Desarrollo local; producción será Ubuntu VPS |
| Node.js | v24.11.0 | Soporta `process.loadEnvFile` (sin dependencia dotenv) y type stripping |
| npm | 11.12.0 | |
| pnpm | 12.4.2 | Candidato para el monorepo (Fase 3) |
| Git | 2.51.2 | |
| Docker | 29.5.2 | |
| Docker Compose | v5.1.3 | |
| PostgreSQL (cliente psql) | 17.4 | Útil para pruebas locales y restauraciones |
| Playwright (navegadores en caché) | Chromium build 1234 (= Playwright 1.62.0) | Ver hallazgo 3.1 |
| Google Chrome / Microsoft Edge | Instalados | Utilizables como canal alternativo (`MAP_RECON_BROWSER_CHANNEL`) |

## 3. Hallazgos relevantes para las siguientes fases

### 3.1 Descarga de navegadores de Playwright bloqueada en esta máquina

`npx playwright install chromium` para Playwright 1.63 falló dos veces por timeout de red hacia el CDN de Google (Chrome for Testing). La caché local ya contenía el build 1234, que corresponde a Playwright **1.62.0**, por lo que la herramienta de reconocimiento queda fijada a esa versión exacta.

Implicaciones:

- En Docker (Fase 3) el worker usará la imagen oficial `mcr.microsoft.com/playwright:v1.62.0-noble` (o la versión que se fije en `package.json`), que ya incluye los navegadores y evita descargas en la VPS.
- Si se actualiza Playwright, debe actualizarse la imagen base a la misma versión.

### 3.2 Compatibilidad `tsx` + `page.evaluate`

Las funciones auxiliares con nombre declaradas dentro de `page.evaluate()` fallan al ejecutarse con `tsx` porque el transpilador inyecta helpers (`__name`) que no existen en el navegador. Se documenta como regla de código para el worker: **no declarar funciones con nombre dentro de callbacks de `evaluate`**; el error se registra ahora en el informe en vez de ocultarse.

### 3.3 Desarrollo en Windows, despliegue en Ubuntu

- Rutas: usar siempre `path.join`/`path.resolve`; nunca separadores literales.
- Finales de línea: se recomienda `.gitattributes` con `* text=auto eol=lf` en la Fase 3.
- Scripts de shell para backups/restauración se escribirán para bash (VPS), no para PowerShell.

### 3.4 Sin conectores externos configurados

No hay MCP/servicios externos (GitHub, Supabase, etc.) autenticados en esta sesión. No afecta a las fases 0-2.

## 4. Cambios realizados en esta fase (no destructivos)

| Ruta | Propósito |
|---|---|
| `.gitignore` | Excluye `node_modules`, `.env`, `.secrets/`, estados de sesión de Playwright y salidas crudas |
| `.env.example` | Plantilla de variables: `MAP_URL_n`, `MAP_URL_n_NAME`, credenciales MAP, opciones del reconocimiento |
| `docs/PROJECT_AUDIT.md` | Este documento |
| `docs/MAP_RECONNAISSANCE.md` | Informe de Fase 1 con análisis manual y recomendación por URL |
| `docs/recon/` | Informe automático y artefactos sanitizados por fuente |
| `tools/recon/` | Instrumento de reconocimiento con Playwright (Fase 1). No es el scraper definitivo |
| `README.md` | Guía de arranque del repositorio |

No se creó todavía el monorepo de aplicaciones (`apps/`), Docker, Prisma, NestJS ni Next.js: corresponden a la Fase 3 y dependen de las decisiones de la Fase 2.

## 5. Estado de las fases

| Fase | Estado | Entregable |
|---|---|---|
| 0 - Auditoría | **Completada** | `docs/PROJECT_AUDIT.md` |
| 1 - Reconocimiento | **Completada** (4 URL de SISMAP analizadas con sesión autorizada; sin JSON/API; exportación tabular + DOM) | `docs/MAP_RECONNAISSANCE.md`, `docs/recon/AUTO_REPORT.md`, `tools/recon/` |
| 2 - Diseño mínimo | **Completada** (alcance reducido a una página + actualizar + exportar, por decisión del propietario) | `docs/PLAN.md` |
| 3 - Implementación | **Completada** | código en `src/`, `prisma/`, `docker-compose.yml`, `docs/DEPLOY.md` |

## 6. Próximos pasos

1. Desplegar en la VPS siguiendo `docs/DEPLOY.md`.
2. Decidir si se restringe el acceso por IP en Caddy (`ADMIN_ALLOWED_CIDRS`).
