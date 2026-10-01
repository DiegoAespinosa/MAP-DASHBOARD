# FASE 1 - Reconocimiento técnico de las URL del MAP (SISMAP)

Fecha: 2026-09-30
Estado: **COMPLETADA** (4 de 4 URL analizadas con sesión autorizada)
Informe automático detallado: [docs/recon/AUTO_REPORT.md](recon/AUTO_REPORT.md) · Artefactos por fuente en `docs/recon/<nn-fuente>/` (summary.json, requests.json, samples/, screenshot.png)

Todos los valores sensibles están redactados. Ningún ejemplo contiene credenciales, cookies ni tokens.

## 1. Resumen ejecutivo

| Fuente | URL | JSON | API | GraphQL | DOM | Exportación tabular | Método recomendado |
|---|---|---|---|---|---|---|---|
| 1. SISMAP GP (Carga de Evidencia) | `/GestionPublica/CargaEvidencia/Index/177` | NO | NO | NO | SÍ | SÍ (`ExportarDatos/177`, 6 col., 23 filas) | **CUSTOM** = exportación + DOM |
| 2. Vista anual EDI (Ranking) | `/GestionPublica/Ranking/InformeAnualEdiView` | NO | NO | NO | SÍ | SÍ (`ExportarEdi`, 13 col., 1 fila) | **CUSTOM** = exportación (DOM fallback) |
| 3. Implementación EDI | `/GestionPublica/CargaEvidenciaEdi/Index/177` | NO | NO | NO | SÍ | SÍ (`ExportarDatos/177`, 6 col., 14 filas) | **CUSTOM** = exportación + DOM |
| 4. Políticas Transversales | `/GestionPublica/CargaEvidencia/PoliticasTransversales/177` | NO | NO | NO | SÍ | SÍ (`ExportarDatosTransversales/177`, 6 col., 8 filas) | **CUSTOM** = exportación + DOM |

Dominio: `https://www.sismap.gob.do`. Organismo: Instituto Nacional de Aguas Potables y Alcantarillados (INAPA), id `177` en la ruta.

**Conclusión:** SISMAP no expone JSON, API REST ni GraphQL. Es una aplicación **ASP.NET MVC renderizada en servidor**: la página llega completa en el HTML inicial, sin XHR ni fetch. Sin embargo, cada pantalla tiene un botón **"Descargar Datos"** que devuelve una **tabla con columnas semánticas** (`CODIGO`, `INDICADOR`, `VALOR_ACTUAL`, `PESO`, `CALCULO`). Esa exportación es la fuente más estable para puntuaciones. Las **fechas de vencimiento, estados y evidencias** solo existen en el DOM, por lo que el método definitivo es híbrido: **exportación como fuente principal de puntuaciones + DOM para evidencias, vencimientos y estados**.

## 2. Cómo se realizó la verificación

1. Playwright (Chromium headless) abrió cada URL con `page.on("response")` activo y clasificó las 40-99 respuestas por URL: content-type, cuerpo parseable como JSON, palabras clave en la ruta.
2. Se verificó el HTML inicial frente al DOM final para determinar el tipo de renderizado.
3. Se detectó la pantalla de login, se ejecutó login automático con la cuenta autorizada (sin CAPTCHA ni MFA) y se guardó el `storageState` fuera del repositorio.
4. Se sondearon los enlaces "Descargar/Exportar" con la sesión del contexto y se clasificó su contenido real por bytes iniciales (no por content-type declarado).
5. Se inspeccionaron manualmente los parciales que cargan los modales ("Tabla de Valoración", detalle de evidencia) y la estructura HTML de una tarjeta de indicador.
6. Se comprobó si las exportaciones responden sin sesión.

Resultado de red en las 4 URL: **0 JSON, 0 GraphQL, 0 XHR/fetch, 0 WebSockets**. Todo el tráfico es documento HTML + estáticos (CSS, JS, fuentes).

## 3. Plataforma y autenticación

| Aspecto | Observación |
|---|---|
| Tecnología | ASP.NET MVC (rutas `/GestionPublica/{Controlador}/{Acción}/{id}`, página 404 de ASP.NET, cookies `ASP.NET_SessionId`, `.ASPXAUTH`, `__RequestVerificationToken_*`), jQuery + Bootstrap (modales cargados por `href` parcial). El indicio "WordPress" del informe automático proviene de rutas de assets y no se confirmó. |
| Renderizado | ESTÁTICO (server-side). El HTML inicial ya contiene todos los datos (243 KB en la fuente 1). |
| Login | Formulario en `/GestionPublica/Login?ReturnUrl=...` con campos usuario y contraseña; `POST /GestionPublica/Login` responde 302 y emite `.ASPXAUTH` (Forms Authentication) más token anti-CSRF. Sin CAPTCHA, sin MFA. Login automático con `getByLabel`/`getByRole` funcionó. |
| Sesión reutilizable | Sí: `storageState` de Playwright reutilizado en las fuentes 3 y 4 sin volver a autenticar. Expiración: pendiente de medir (Forms Auth suele ser deslizante; detectar por redirección 302 a `/GestionPublica/Login`). |
| Acceso público | Fuentes 1, 3 y 4 responden HTTP 200 **sin sesión**. La fuente 2 exige login (302 a Login). Las 4 exportaciones respondieron 200 sin sesión en la prueba, incluida `ExportarEdi`. El worker usará siempre sesión autorizada; la accesibilidad pública es solo una ventaja de resiliencia. |
| Controles anti-automatización | No observados. Se respetará una frecuencia baja (diaria o cada pocas horas). |

## 4. Análisis por fuente

### 4.1 SISMAP GP - Carga de Evidencia (`CargaEvidencia/Index/177`)

- **Estado:** ACCESIBLE (HTTP 200) · **Autenticación:** no requerida para lectura; se usará sesión igualmente.
- **Contenido:** cabecera del organismo (nombre, correo, teléfono, dirección, web), **Promedio General 83.7 %** con imagen de color, 9 secciones (`01.GESTIÓN DE LA CALIDAD Y SERVICIOS` ... `09.GESTIÓN DE LAS RELACIONES LABORALES Y SOCIALES`) y **24 sub-indicadores** en tarjetas.
- **Por sub-indicador (DOM):** código y nombre (`01.1 Autoevaluación CAF`), `PUNTOS` (0-100), color (`img[alt]` = `VERDE_OSCURO`, `AMARILLO`, `ROJO`...), `PESO`, `RESULTADO`, enlace "Tabla de Valoración" a `GetSubIndicadorColor/{subIndicadorId}`. Algunos muestran `Inactivo Temporal` en lugar de puntos (01.4, 01.8).
- **Por evidencia (DOM, filas bajo cada sub-indicador):** código y nombre (`01.1.1 Comité Institucional de la Calidad`) enlazado a `VerListado?cargaEvidenciaID={id}&logueado=Si&departamentoID=0&politicas=False`, **FECHA VENCIMIENTO** (`dd/mm/aaaa`), **VERIFICADO POR** (analista MAP), **VALOR**, **ESTADO** (`Vencido` o vacío).
- **Exportación** `GET /GestionPublica/CargaEvidencia/ExportarDatos/177`: content-type declarado `application/vnd.ms-excel`, `Content-Disposition: attachment; filename=DatosOrganismo.xls`, pero el cuerpo real es texto: una línea `Fecha y Hora de Descarga:...` seguida de una tabla HTML con columnas `OrganismoID, CODIGO, INDICADOR, VALOR_ACTUAL, PESO, CALCULO` y 23 filas (los sub-indicadores inactivos no aparecen). Ejemplo: `docs/recon/01-sismap/samples/export-01-descargar-datos.html`.
- **Parciales:** `GetSubIndicadorColor/{id}` devuelve HTML con la tabla de valoración (Descripción, Color, Valor: `0 - 59`, `60 - 79`, `80 - 100`); `VerListado?cargaEvidenciaID={id}` devuelve el histórico de cargas de una evidencia (Descripción = archivo, Fecha, Fecha Vencimiento, Nombre Usuario, valor, Estado). Ejemplos en `docs/recon/01-sismap/samples/partial-*.html`.
- **Método:** CUSTOM híbrido. Exportación para código, nombre, puntuación, peso y cálculo; DOM para sección, color, estado `Inactivo Temporal`, promedio general, evidencias con vencimiento, verificador y estado. **Fallback:** DOM completo. **Estabilidad:** ALTA para la exportación, MEDIA para el DOM.

### 4.2 Vista anual EDI - Ranking (`Ranking/InformeAnualEdiView`)

- **Estado:** ACCESIBLE tras login (HTTP 302 a Login sin sesión) · **Autenticación:** cookie `.ASPXAUTH`.
- **Contenido:** "Informe anual indicadores de procesos y resultados": una tabla con 1 fila para INAPA y columnas `Posición, Nombre Organismo, IDI, SISMAP GP, IGP, SISCOMPRAS, ITICGE, NOBACI, SAIP, Políticas Transversales, Índice de Cumplimiento, Índice de Progreso`; los valores se muestran como medidores circulares (IGP aparece como `NaN`). Botones: Descargar Datos, Fuente de Datos (modal), Retornar, Descargar Metas Mepyd (archivo `.xlsx` real en `/uploads/evidencias/`).
- **Exportación** `GET /GestionPublica/Ranking/ExportarEdi`: tabla HTML con 13 columnas `ID, nombreOrganismo, EDI, IGP, SISCOMPRAS, SismapGp, ITICGE, NOBACI, PoliticasTransversales, IndicedeCumplimiento, IndicedeProgreso, SatisfaccionCiudadana, SAIP` y 1 fila. Contiene más campos que la pantalla (`SatisfaccionCiudadana`) y usa `-1.000000` donde la UI muestra `NaN`. Ojo: el `ID` aquí es `14`, distinto del `177` de las otras rutas.
- **Método:** CUSTOM = exportación como fuente única de los índices globales. **Fallback:** DOM de la tabla (encabezados semánticos, 1 fila). **Estabilidad:** ALTA.

### 4.3 Implementación EDI (`CargaEvidenciaEdi/Index/177`)

- Misma estructura que 4.1, con 5 secciones y **14 sub-indicadores**, promedio general 100 %. Evidencias con vencimientos entre 2027 y 2030 (la 04.1.1 vence 10/10/2026 y la 05.1.1 el 10/12/2026).
- **Exportación** `GET /GestionPublica/CargaEvidenciaEdi/ExportarDatos/177`: mismas 6 columnas, 14 filas. Parcial de valoración: `CargaEvidenciaEdi/GetSubIndicadorColor/{id}`.
- **Método:** CUSTOM híbrido (idéntico a 4.1). **Estabilidad:** ALTA / MEDIA.

### 4.4 Políticas Transversales (`CargaEvidencia/PoliticasTransversales/177`)

- Misma estructura que 4.1, con 6 políticas y **8 sub-indicadores** cuyo código lleva prefijo `Pt` (`Pt 01.1`), promedio general 81.84 %. Un sub-indicador en rojo (`Pt 01.2`, 0 puntos).
- **Exportación** `GET /GestionPublica/CargaEvidencia/ExportarDatosTransversales/177`: mismas 6 columnas, 8 filas.
- **Método:** CUSTOM híbrido. **Estabilidad:** ALTA / MEDIA.

## 5. Catálogo de endpoints descubiertos

| # | Método y ruta | Auth | Tipo real | Campos / uso | Paginación |
|---|---|---|---|---|---|
| E1 | `GET /GestionPublica/CargaEvidencia/ExportarDatos/{organismoId}` | ninguna observada (usar sesión) | Tabla HTML servida como `.xls` | `OrganismoID, CODIGO, INDICADOR, VALOR_ACTUAL, PESO, CALCULO` | no |
| E2 | `GET /GestionPublica/CargaEvidenciaEdi/ExportarDatos/{organismoId}` | ídem | ídem | ídem (indicadores EDI) | no |
| E3 | `GET /GestionPublica/CargaEvidencia/ExportarDatosTransversales/{organismoId}` | ídem | ídem | ídem (políticas transversales, códigos `Pt`) | no |
| E4 | `GET /GestionPublica/Ranking/ExportarEdi` | ídem (la página sí exige login) | Tabla HTML servida como `.xls` | 13 índices globales del organismo | no |
| P1 | `GET /GestionPublica/CargaEvidencia/GetSubIndicadorColor/{subIndicadorId}` (y variante `CargaEvidenciaEdi`) | ninguna observada | HTML parcial (modal) | rangos de valoración (Descripción, Color, Valor) | no |
| P2 | `GET /GestionPublica/CargaEvidencia/VerListado?cargaEvidenciaID={id}&logueado=Si&departamentoID=0&politicas=False` | ninguna observada | HTML parcial (modal) | histórico de cargas: archivo, fecha, vencimiento, usuario, valor, estado | no |
| L1 | `GET /GestionPublica/Login?ReturnUrl=...` · `POST /GestionPublica/Login` | usuario/contraseña + token anti-CSRF | HTML / 302 | inicio de sesión (cookie `.ASPXAUTH`) | – |

Todas las rutas se parametrizan por organismo (`177`) y se guardarán en `MapSource.url` / `MapSource.config`, nunca en código.

## 6. Mapeo preliminar a las entidades del sistema

| Entidad / campo | Origen | Notas |
|---|---|---|
| `Indicator.code` | Exportación `CODIGO` (y DOM) | Único por fuente: `01.1`, `Pt 01.1`. `externalId` = `{fuente}:{CODIGO}`. |
| `Indicator.name` | Exportación `INDICADOR` | |
| `Indicator.currentScore` | Exportación `VALOR_ACTUAL` (0-100) | En DOM = `PUNTOS`. |
| `Indicator.metadata.weight` / `.weightedResult` | Exportación `PESO`, `CALCULO` | |
| `Indicator.externalStatus` | DOM: color (`img[alt]`) o `Inactivo Temporal` | Los rangos de color pueden leerse de P1. |
| `Indicator.metadata.section` | DOM: cabecera de sección (`01.GESTIÓN DE LA CALIDAD...`) | |
| `Indicator.deadline` | DOM: **mínima `FECHA VENCIMIENTO` futura de sus evidencias** | Decisión de diseño para la Fase 2: el vencimiento existe por evidencia, no por indicador. |
| Evidencias (nueva entidad `IndicatorEvidence` o `metadata.evidences`) | DOM: código, nombre, vencimiento, verificado por, valor, estado; P2 para histórico | Hallazgo arquitectónico: el modelo mínimo de la especificación no tiene evidencias; se propone agregarlas. |
| `MapAnalyst` (sugerencia) | DOM: `VERIFICADO POR` | Nombre del verificador MAP por evidencia; puede precargar la tabla de analistas. |
| Promedio general de la fuente | DOM: `Promedio General NN %` | Guardar como snapshot de fuente. |
| Índices globales (fuente 2) | Exportación E4 | Tratar cada columna como un indicador (`EDI`, `SISCOMPRAS`, ...). |

## 7. Recomendación definitiva por URL

| Fuente | `extractionMode` | Estrategia | Fallback | Estabilidad |
|---|---|---|---|---|
| 1. SISMAP GP | **CUSTOM** (exportación + DOM) | E1 para puntuaciones; DOM para evidencias, vencimientos, estado, color y promedio | DOM completo | ALTA (E1) / MEDIA (DOM) |
| 2. Vista anual EDI | **CUSTOM** (exportación) | E4 como única fuente | DOM (tabla con encabezados) | ALTA |
| 3. Implementación EDI | **CUSTOM** (exportación + DOM) | E2 + DOM | DOM completo | ALTA / MEDIA |
| 4. Políticas Transversales | **CUSTOM** (exportación + DOM) | E3 + DOM | DOM completo | ALTA / MEDIA |

**Hallazgo arquitectónico (para decidir en la Fase 2):** las 4 fuentes comparten el mismo patrón "exportación tabular por HTTP + página server-rendered". Se propone añadir al enum `extractionMode` un valor **`EXPORT`** (descarga tabular: tabla HTML, CSV o Excel) con su propio extractor, dejando `CUSTOM` para casos realmente especiales. Si se prefiere no ampliar el enum, se implementará como `CUSTOM` con `config.strategy = "export+dom"`. En ambos casos el modo `AUTO` probará en orden: API conocida → JSON descubierto → GraphQL → exportación → DOM.

## 8. Riesgos y mitigaciones detectados

| Riesgo | Mitigación prevista |
|---|---|
| La exportación cambia a Excel binario real (`504b0304` / `d0cf11e0`) | El sondeo ya clasifica por bytes iniciales; el extractor validará el tipo real y marcará `EXTRACTION_ANOMALY` si cambia. |
| Cambios en el DOM (tarjetas anidadas sin ids ni clases por campo; las filas de evidencia dependen de la posición de celdas) | Anclar por etiquetas semánticas (`PUNTOS`, `PESO`, `RESULTADO`, fila de encabezado `EVIDENCIA / FECHA VENCIMIENTO / ...`), validar formato de fecha y numérico, comparar conteos con la sincronización previa. |
| Expiración de `.ASPXAUTH` | Detectar 302 hacia `/GestionPublica/Login` y renovar sesión con `MapAuthService`. |
| Sub-indicadores `Inactivo Temporal` ausentes en la exportación | Unir exportación y DOM por `CODIGO`; no marcar como eliminados los que solo falten en la exportación. |
| Identificadores distintos (`177` en carga de evidencia, `14` en ranking) | Guardar ambos en `MapSource.config`; nunca asumir uno global. |
| Codificación (`&#243;`, `&oacute;`) en la exportación | Decodificar entidades HTML en el normalizador (ya cubierto en el sondeo). |
| Screenshots con datos institucionales | Se conservan solo en `docs/recon/` local; no contienen secretos de sesión. |

## 9. Reproducir el reconocimiento

```bash
cd tools/recon
npm install
npm run recon          # usa .env (MAP_URL_1..4) y la sesión guardada en .secrets/
npm test               # pruebas contra un servidor simulado
```

Salida: `docs/recon/AUTO_REPORT.md` (regenerado en cada ejecución; este documento no se sobrescribe) y `docs/recon/<nn-fuente>/`.
