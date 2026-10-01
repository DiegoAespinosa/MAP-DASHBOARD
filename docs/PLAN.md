# Diseño mínimo

Fecha: 2026-09-30 · Alcance acordado: **una página, un backend que busca la información en SISMAP, un botón "Actualizar datos" y un botón "Exportar".**

Decisiones confirmadas por el propietario: sin pantalla de acceso, PostgreSQL, exportación a Excel, columnas internas editables (responsable y contacto) por indicador.

Base técnica: [MAP_RECONNAISSANCE.md](MAP_RECONNAISSANCE.md). SISMAP no tiene API; cada página tiene una exportación tabular (`Descargar Datos`) con `CODIGO, INDICADOR, VALOR_ACTUAL, PESO, CALCULO`, y las fechas de vencimiento y estados de las evidencias están en el HTML.

## 1. Qué hace

1. El usuario abre la página y ve la tabla de indicadores de INAPA con la fecha de la última actualización.
2. Pulsa **Actualizar datos**: el backend inicia sesión en SISMAP (si hace falta), descarga las 4 fuentes, guarda el resultado y la página se refresca. Si SISMAP falla, se muestra el error y se conservan los datos anteriores.
3. Pulsa **Exportar**: descarga la tabla completa en Excel.
4. Puede escribir, en la misma tabla, el **responsable** y las **contacto** internos de cada indicador. Se guardan al salir de la celda y nunca se pierden al actualizar desde SISMAP.

## 2. Pantalla única

Cabecera: título, "Última actualización: 30/09/2026 14:02", botón **Actualizar datos** (muestra progreso y se desactiva mientras corre), botón **Exportar**.

Resumen: promedio general por fuente (SISMAP GP 83.7 %, EDI 100 %, Políticas Transversales 81.84 %, índices del ranking) y contadores: vencidas, próximas a vencer, al día.

Tabla (filtrable por fuente y por semáforo, ordenable):

| Fuente | Código | Indicador | Puntuación | Peso | Resultado | Color SISMAP | Próximo vencimiento | Días restantes | Semáforo | Evidencias (vencidas / total) | Responsable (editable) | Contacto (editable) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Al pulsar una fila se despliegan sus evidencias: código, nombre, vencimiento, verificado por, valor, estado.

Semáforo por días restantes: vencido · crítico 0-3 · atención 4-7 · próximo 8-15 · normal > 15 (valores en un archivo de configuración).

## 3. Tecnología

- **Next.js** (TypeScript, Tailwind): la página y tres endpoints (`POST /api/refresh`, `GET /api/export`, `PATCH /api/indicators/[id]/internal`). Un solo proceso, un solo contenedor.
- **Playwright** dentro del mismo backend para iniciar sesión en SISMAP y leer las páginas (`headless`).
- **Base de datos: PostgreSQL con Prisma**, 4 tablas (ver §5). Guarda el último estado para que la página cargue al instante y siga funcionando si SISMAP está caído, y conserva un histórico simple de cada actualización.
- **Excel** con `exceljs` para la exportación.
- Despliegue: `docker-compose` con `app`, `postgres` y `caddy` (HTTPS). Backup diario con `pg_dump` en un cron del servidor.

## 4. Backend de actualización (`POST /api/refresh`)

```
para cada fuente (4 URL de SISMAP, en un archivo de configuración sources.json o en la tabla Source):
  1. asegurar sesión (storageState guardado; si SISMAP redirige a Login, volver a autenticar con MAP_USERNAME/MAP_PASSWORD)
  2. descargar la exportación "Descargar Datos" → código, nombre, puntuación, peso, cálculo
  3. abrir la página → promedio general, sección, color, "Inactivo Temporal", evidencias (vencimiento, verificado por, valor, estado)
  4. unir por código, validar (fechas dd/mm/aaaa, números 0-100)
  5. si una fuente devuelve 0 indicadores cuando antes tenía, no se reemplaza nada y se avisa
  6. guardar en una transacción: upsert de indicadores y evidencias, fila en Refresh con el resultado
```

Solo una actualización a la vez (candado en la tabla `Refresh`). Progreso visible en la página (fuente actual y etapa). Las credenciales de SISMAP solo viven en variables de entorno del servidor.

## 5. Datos

- **Source**: `id, name, url, exportUrl, kind (CARGA_EVIDENCIA | RANKING), enabled` (4 filas semilla; editables si se quiere cambiar una URL sin tocar código).
- **Indicator**: `id, sourceId, code, name, section, score, weight, weightedResult, color, status, overallScoreOfSource, deadline (derivado), updatedAt, missingSince`. Único `(sourceId, code)`.
- **Evidence**: `id, indicatorId, code, name, dueDate, verifiedBy, value, status, updatedAt`. Único `(indicatorId, code)`.
- **InternalNote**: `indicatorId (único), responsible, contact, updatedAt`. Tabla aparte para que la actualización desde SISMAP no pueda tocarla.
- **Refresh**: `id, startedAt, finishedAt, status (RUNNING|OK|PARTIAL|FAILED), summary (json: por fuente, registros, error), snapshot (json: copia completa de los indicadores de ese momento)`. Es el histórico: permite ver cómo estaba cada indicador en cualquier actualización pasada sin tablas adicionales.

## 6. Exportar (`GET /api/export`)

Un archivo `.xlsx` con dos hojas: **Indicadores** (las columnas de la tabla, incluidos responsable y contacto) y **Evidencias** (indicador, código, nombre, vencimiento, verificado por, valor, estado). Nombre `indicadores-sismap-AAAA-MM-DD.xlsx`.

## 7. Acceso

Sin pantalla de acceso, por decisión del propietario. Advertencia: cualquiera que alcance la URL podrá ver los datos, lanzar actualizaciones y editar responsables y contactos. Si la página se publica en Internet, se recomienda al menos restringir por IP institucional o un usuario único en Caddy; ambas opciones se activan en el `Caddyfile` sin cambios en la aplicación. Las credenciales de SISMAP nunca se exponen en la página.

## 8. Fuera de alcance (salvo que se pida)

Usuarios y roles, panel de administración, seguimiento interno más allá de responsable y contacto, discovery de nuevas URL, alertas, modos de extracción configurables. El código de reconocimiento de `tools/recon` se conserva como herramienta aparte.

## 9. Estado de implementación (2026-09-30)

Implementado y verificado contra SISMAP real: las 4 fuentes se actualizan (58 indicadores, 160+ evidencias), la exportación Excel genera dos hojas, responsable y contacto persisten entre actualizaciones. 30 pruebas automatizadas (parsers con HTML real, motor de actualización contra PostgreSQL, casos de fallo y anomalía). Despliegue documentado en [DEPLOY.md](DEPLOY.md).

## 10. Pasos seguidos

1. Proyecto Next.js + Prisma + esquema de 4 tablas + semilla con las 4 fuentes.
2. Módulo de extracción SISMAP (exportación + página) con pruebas sobre el HTML real guardado en `docs/recon/*/samples`.
3. Endpoint de actualización con progreso y candado.
4. Página con tabla, resumen, semáforo, botones y celdas editables de responsable y contacto.
5. Exportación a Excel.
6. Docker Compose, Caddy, backup, documentación de despliegue.
