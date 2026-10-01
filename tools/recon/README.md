# tools/recon - Reconocimiento técnico de URLs del MAP (Fase 1)

Instrumento de Playwright que inspecciona cada `MAP_URL_n`, escucha el tráfico de red y determina de dónde obtiene los datos cada página (API REST / JSON, GraphQL, JSON embebido, tablas HTML, renderizado dinámico). Genera `docs/recon/AUTO_REPORT.md` y artefactos sanitizados en `docs/recon/<fuente>/`. El análisis manual vive en `docs/MAP_RECONNAISSANCE.md` y no se sobrescribe.

**No es el scraper definitivo.** No asume endpoints ni selectores. En la Fase 7 su lógica de descubrimiento se trasladará a `apps/map-worker/discovery/`.

## Uso

```bash
cd tools/recon
npm install                 # Playwright fijado a 1.62.0 (navegador Chromium build 1234 ya en caché)
npm run recon:login         # 1) navegador visible, login manual autorizado -> guarda storageState
npm run recon               # 2) analiza todas las MAP_URL_n definidas en ../../.env
npm test                    # pruebas end-to-end contra un servidor simulado
```

Variables (en `.env` de la raíz; ver `.env.example`):

| Variable | Por defecto | Efecto |
|---|---|---|
| `MAP_URL_n`, `MAP_URL_n_NAME` | – | Fuentes a analizar (n = 1..50) |
| `MAP_USERNAME`, `MAP_PASSWORD` | – | Solo se usan si `MAP_RECON_AUTO_LOGIN=true` |
| `MAP_LOGIN_URL` | `MAP_URL_1` | Página donde iniciar sesión en `recon:login` |
| `MAP_RECON_AUTO_LOGIN` | `false` | Login automático con `getByLabel`/`getByRole`. Se detiene ante CAPTCHA/MFA |
| `MAP_RECON_HEADLESS` | `true` | `false` para ver el navegador |
| `MAP_RECON_INTERACTIVE_SECONDS` | `0` | Segundos de fase manual para navegar y correlacionar acciones con peticiones |
| `MAP_STORAGE_STATE` | `./.secrets/map.storage-state.json` | Sesión de Playwright (ignorada por Git) |
| `MAP_RECON_BROWSER_CHANNEL` | vacío | `chrome` o `msedge` para usar el navegador del sistema |
| `MAP_RECON_NAV_TIMEOUT_MS` | `45000` | Timeout de navegación |
| `MAP_RECON_OUT_DIR` / `MAP_RECON_REPORT` | `docs/recon` / `docs/recon/AUTO_REPORT.md` | Rutas de salida |

## Qué hace por cada URL

1. Preflight HTTP sin seguir redirecciones (estado, `Location`, content-type).
2. Navegación con Chromium; captura de todas las respuestas (`page.on("response")`) y WebSockets.
3. Detección de login (campo password, URL, texto), CAPTCHA (reCAPTCHA, hCaptcha, Turnstile) y MFA (códigos de un solo uso). Nunca intenta evadirlos.
4. Login automático opcional, o reutilización del `storageState` guardado.
5. Scroll para disparar cargas diferidas; fase manual opcional.
6. Sondeo de enlaces "Descargar/Exportar": se descargan con la sesión y se clasifican por bytes reales (tabla HTML, CSV, JSON, XLSX, XLS binario, PDF), con columnas y filas.
7. Hechos del DOM: título, renderizado (estático / dinámico / mixto), frameworks detectados, tablas y encabezados, JSON embebido, formularios, indicios de paginación, iframes (visores BI).
8. Clasificación de cada respuesta (JSON / GraphQL / HTML...), inferencia de campos y tipos, claves de paginación, puntuación de utilidad (ALTA / MEDIA / BAJA), deduplicación de endpoints.
9. Recomendación: API, JSON, GRAPHQL, DOM o CUSTOM (exportación tabular + DOM), con fallback, estabilidad estimada y caso de extracción (A-D).

## Garantías de seguridad

- Redacción antes de escribir a disco o consola: valores literales de usuario/password, `Authorization` (`Bearer eyJhbG...REDACTED`), cookies (solo nombres), `Set-Cookie`, tokens JWT, parámetros de query y claves JSON con nombres sensibles (`token`, `password`, `session`, `clave`, ...).
- Cuerpos JSON truncados: 3 elementos por array, 300 caracteres por string, profundidad 8.
- Los archivos de sesión y `.env` están fuera de Git.

## Estructura

```
tools/recon/
|-- src/
|   |-- config.ts       carga de .env y validación de fuentes
|   |-- redact.ts       redacción de secretos
|   |-- classify.ts     clasificación, inferencia de campos, utilidad, deduplicación
|   |-- login.ts        detección de login/CAPTCHA/MFA, login automático, storageState
|   |-- recon.ts        orquestación por URL, artefactos y recomendación
|   |-- report.ts       generación del Markdown
|   |-- login-cli.ts    login manual autorizado (navegador visible)
|   `-- types.ts
|-- fixtures/server.mjs plataforma simulada para pruebas
`-- test/recon.test.mjs pruebas end-to-end (node --test)
```

Regla de código heredada de las pruebas: no declarar funciones auxiliares con nombre dentro de `page.evaluate()` (el transpilador inyecta helpers que no existen en el navegador).
