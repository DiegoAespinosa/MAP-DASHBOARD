# Reconocimiento tecnico de las URL del MAP (Fase 1)

Generado automaticamente por `tools/recon` el 2026-09-30T23:56:40.660Z.

Todos los valores sensibles (passwords, tokens, cookies, Authorization) aparecen redactados.
Los ejemplos en `samples/` estan sanitizados y truncados. Este informe describe lo observado; no asume endpoints.

## Resumen

| Fuente | URL | JSON | API | GraphQL | DOM | Metodo recomendado |
|---|---|---|---|---|---|---|
| SISMAP | https://www.sismap.gob.do/GestionPublica/CargaEvidencia/Index/177?catchall=Instituto-Nacional-de-Aguas-Potables-y-Alcantarillados | NO | NO | NO | SI | CUSTOM (exportacion tabular) |
| Vista anual EDI | https://www.sismap.gob.do/GestionPublica/Ranking/InformeAnualEdiView | NO | NO | NO | SI | CUSTOM (exportacion tabular) |
| Implementacion EDI | https://www.sismap.gob.do/GestionPublica/CargaEvidenciaEdi/Index/177?catchall=Instituto-Nacional-de-Aguas-Potables-y-Alcantarillados | NO | NO | NO | SI | CUSTOM (exportacion tabular) |
| Politicas Transversales | https://www.sismap.gob.do/GestionPublica/CargaEvidencia/PoliticasTransversales/177?catchall=Instituto-Nacional-de-Aguas-Potables-y-Alcantarillados | NO | NO | NO | SI | CUSTOM (exportacion tabular) |

Sesion de Playwright: headless · Fase manual: desactivada.

## 1. SISMAP

- **URL:** https://www.sismap.gob.do/GestionPublica/CargaEvidencia/Index/177?catchall=Instituto-Nacional-de-Aguas-Potables-y-Alcantarillados
- **Estado:** ACCESIBLE (HTTP 200)
- **Autenticacion:** SESSION COOKIE (storageState reutilizado)
- **Cookies de sesion (solo nombres):** ASP.NET_SessionId, __RequestVerificationToken_L0dlc3Rpb25QdWJsaWNh0, .ASPXAUTH
- **Renderizado:** ESTATICO (WordPress, jQuery)
- **Titulo:** Carga de Evidencia
- **Requests analizadas:** 40 (ruido descartado: 4)
- **JSON detectados:** 0 · **GraphQL:** 0 · **XHR/fetch:** 0 · **WebSockets:** 0
- **Tablas HTML:** 150 (filas: 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
- **Encabezados de tabla:** info@inapa.gob.do | 8095671241 | Calle Guarocuya, Edificio INAPA, Centro Comercial El Millon, Santo Domingo | http://www.inapa.gob.do/ // Promedio General
83.7 % | Descargar Datos // 01.GESTIÓN DE LA CALIDAD Y SERVICIOS // 01.1 Autoevaluación CAF | PUNTOS
100 | PESO
4.57 | RESULTADO
4.57 | Tabla de Valoración // 01.2 Plan de Mejora Modelo CAF | PUNTOS
100 | PESO
7.57 | RESULTADO
7.57 | Tabla de Valoración // 01.3 Estandarización de Procesos | PUNTOS
50 | PESO
4.57 | RESULTADO
2.28 | Tabla de Valoración // 01.4 Carta Compromiso | Inactivo Temporal | Tabla de Valoración // 01.5 Transparencia en las Informaciones de Servicios y Funcionarios | PUNTOS
100 | PESO
3.57 | RESULTADO
3.57 | Tabla de Valoración // 01.6 Monitoreo de la Calidad de los Servicios | PUNTOS
100 | PESO
3.57 | RESULTADO
3.57 | Tabla de Valoración // 01.7 Índice de Satisfacción Ciudadana | PUNTOS
93 | PESO
3.57 | RESULTADO
3.32 | Tabla de Valoración // 01.8 Inventario de Trámites y Servicios | Inactivo Temporal | Tabla de Valoración // 02.ORGANIZACIÓN DE LA FUNCIÓN DE RECURSOS HUMANOS // 02.1 Nivel de Administración del Sistema de Carrera Administrativa | PUNTOS
100 | PESO
3.57 | RESULTADO
3.57 | Tabla de Valoración // 03. PLANIFICACIÓN DE RECURSOS HUMANOS // 03.1 Plan de Recursos Humanos | PUNTOS
80 | PESO
3.57 | RESULTADO
2.85 | Tabla de Valoración // 04.ORGANIZACIÓN DEL TRABAJO // 04.1 Estructura Organizativa | PUNTOS
70 | PESO
3.57 | RESULTADO
2.5 | Tabla de Valoración // 04.2 Manual de Organización y Funciones | PUNTOS
100 | PESO
3.57 | RESULTADO
3.57 | Tabla de Valoración // 04.3 Manual de Cargos Implementado | PUNTOS
0 | PESO
4.57 | RESULTADO
0 | Tabla de Valoración // 05.GESTIÓN DEL EMPLEO // 05.1 Concursos Públicos | PUNTOS
100 | PESO
4.57 | RESULTADO
4.57 | Tabla de Valoración // 05.2 Implementación del Sistema Transversal de Gestión Humana y Nómina | PUNTOS
0 | PESO
3.57 | RESULTADO | Tabla de Valoración // 06.GESTIÓN DE LAS COMPENSACIONES Y BENEFICIOS // 06.1 Escala Salarial | PUNTOS
90 | PESO
7.57 | RESULTADO
6.81 | Tabla de Valoración // 07. GESTIÓN DEL RENDIMIENTO // 07.1 Gestión de Acuerdos de Desempeño | PUNTOS
96 | PESO
4.57 | RESULTADO
4.38 | Tabla de Valoración // 07.2 Evaluación del Desempeño por Resultados y Competencias | PUNTOS
94 | PESO
4.57 | RESULTADO
4.29 | Tabla de Valoración // 08.GESTIÓN DEL DESARROLLO // 08.1 Plan de Capacitación | PUNTOS
82 | PESO
3.57 | RESULTADO
2.92 | Tabla de Valoración // 09.GESTIÓN DE LAS RELACIONES LABORALES Y SOCIALES // 09.1 Asociación de Servidores Públicos | PUNTOS
80 | PESO
3.57 | RESULTADO
2.85 | Tabla de Valoración // 09.2 Fortalecimiento de las Relaciones Laborales | PUNTOS
79 | PESO
3.57 | RESULTADO
2.82 | Tabla de Valoración // 09.3 Institucionalización del Régimen Ético y Disciplinario de los Servidores Públicos en el 100% del personal | PUNTOS
100 | PESO
3.57 | RESULTADO
3.57 | Tabla de Valoración // 09.4 Implementación del Sistema de Seguridad y Salud en el Trabajo en la Administración Pública | PUNTOS
85 | PESO
3.57 | RESULTADO
3.03 | Tabla de Valoración // 09.5 Encuesta de Clima Laboral | PUNTOS
100 | PESO
4.57 | RESULTADO
4.57 | Tabla de Valoración // 09.6 Implementación de Acciones de Inclusión y Accesibilidad en la Administración Pública | PUNTOS
100 | PESO
6.57 | RESULTADO
6.57 | Tabla de Valoración
- **JSON embebido en HTML:** no detectado
- **Formularios:** 0
- **Paginacion en UI:** no detectada
- **API encontrada:** NO

### Endpoints potencialmente utiles

_No se detectaron respuestas JSON/GraphQL reutilizables durante la navegacion._

### Exportaciones detectadas (enlaces "Descargar/Exportar")

1. `GET /GestionPublica/CargaEvidencia/ExportarDatos/177` ("Descargar Datos")
   - Estado: 200 · Content-Type: application/vnd.ms-excel · Tamano: 3.8 KB · attachment; filename=DatosOrganismo.xls
   - Contenido real: **HTML_TABLE** · 23 filas · Columnas: `OrganismoID`, `CODIGO`, `INDICADOR`, `VALOR_ACTUAL`, `PESO`, `CALCULO`
   - Ejemplo sanitizado: `docs/recon/01-sismap/samples/export-01-descargar-datos.html`

### Recomendacion

- **Metodo recomendado:** CUSTOM
- **Fallback:** DOM (tablas HTML presentes)
- **Estabilidad estimada:** MEDIA
- **Caso de extraccion:** D (exportacion tabular + DOM complementario)
- Exportacion tabular estable: "Descargar Datos" -> /GestionPublica/CargaEvidencia/ExportarDatos/177 (HTML_TABLE, 6 columnas: OrganismoID, CODIGO, INDICADOR, VALOR_ACTUAL, PESO, CALCULO; 23 filas).
- Sin JSON/API, pero la exportacion ofrece columnas semanticas; usarla como fuente principal y el DOM para los datos que no incluya.

_Artefactos: `docs/recon/01-sismap` (summary.json, requests.json, samples/, screenshot.png)_

## 2. Vista anual EDI

- **URL:** https://www.sismap.gob.do/GestionPublica/Ranking/InformeAnualEdiView
- **Estado:** ACCESIBLE (HTTP 200)
- **Autenticacion:** SESSION COOKIE (storageState reutilizado)
- **Cookies de sesion (solo nombres):** ASP.NET_SessionId, __RequestVerificationToken_L0dlc3Rpb25QdWJsaWNh0, .ASPXAUTH
- **Renderizado:** ESTATICO (WordPress, jQuery)
- **Titulo:** Sismap Funcion Publica - Ranking Edi
- **Requests analizadas:** 37 (ruido descartado: 3)
- **JSON detectados:** 0 · **GraphQL:** 0 · **XHR/fetch:** 0 · **WebSockets:** 0
- **Tablas HTML:** 1 (filas: 3)
- **Encabezados de tabla:** Posición | Nombre Organismo | IDI | SISMAP GP | IGP | SISCOMPRAS | ITICGE | NOBACI | SAIP | Políticas Transversales | Índice de Cumplimiento | Índice de Progreso
- **JSON embebido en HTML:** no detectado
- **Formularios:** 1 (GET)
- **Paginacion en UI:** no detectada
- **API encontrada:** NO

### Endpoints potencialmente utiles

_No se detectaron respuestas JSON/GraphQL reutilizables durante la navegacion._

### Exportaciones detectadas (enlaces "Descargar/Exportar")

1. `GET /GestionPublica/Ranking/ExportarEdi` ("Descargar Datos")
   - Estado: 200 · Content-Type: application/vnd.ms-excel · Tamano: 828 B · attachment; filename=DatosTemporalesSismapEdi.xls
   - Contenido real: **HTML_TABLE** · 1 filas · Columnas: `ID`, `nombreOrganismo`, `EDI`, `IGP`, `SISCOMPRAS`, `SismapGp`, `ITICGE`, `NOBACI`, `PoliticasTransversales`, `IndicedeCumplimiento`, `IndicedeProgreso`, `SatisfaccionCiudadana`, `SAIP`
   - Ejemplo sanitizado: `docs/recon/02-vista-anual-edi/samples/export-01-descargar-datos.html`

### Recomendacion

- **Metodo recomendado:** CUSTOM
- **Fallback:** DOM (tablas HTML presentes)
- **Estabilidad estimada:** MEDIA
- **Caso de extraccion:** D (exportacion tabular + DOM complementario)
- Exportacion tabular estable: "Descargar Datos" -> /GestionPublica/Ranking/ExportarEdi (HTML_TABLE, 13 columnas: ID, nombreOrganismo, EDI, IGP, SISCOMPRAS, SismapGp, ITICGE, NOBACI; 1 filas).
- Sin JSON/API, pero la exportacion ofrece columnas semanticas; usarla como fuente principal y el DOM para los datos que no incluya.

_Artefactos: `docs/recon/02-vista-anual-edi` (summary.json, requests.json, samples/, screenshot.png)_

## 3. Implementacion EDI

- **URL:** https://www.sismap.gob.do/GestionPublica/CargaEvidenciaEdi/Index/177?catchall=Instituto-Nacional-de-Aguas-Potables-y-Alcantarillados
- **Estado:** ACCESIBLE (HTTP 200)
- **Autenticacion:** SESSION COOKIE (storageState reutilizado)
- **Cookies de sesion (solo nombres):** ASP.NET_SessionId, __RequestVerificationToken_L0dlc3Rpb25QdWJsaWNh0, .ASPXAUTH
- **Renderizado:** ESTATICO (WordPress, jQuery)
- **Titulo:** Carga de Evidencia
- **Requests analizadas:** 36 (ruido descartado: 4)
- **JSON detectados:** 0 · **GraphQL:** 0 · **XHR/fetch:** 0 · **WebSockets:** 0
- **Tablas HTML:** 49 (filas: 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
- **Encabezados de tabla:** info@inapa.gob.do | 8095671241 | Calle Guarocuya, Edificio INAPA, Centro Comercial El Millon, Santo Domingo | http://www.inapa.gob.do/ // Promedio General
100 % | Descargar Datos // 01. Preparación y Generación de Condiciones Previas // 01.1 Conformación de Comité Técnico de Evaluación del Desempeño Institucional (EDI) | PUNTOS
100 | PESO
5 | RESULTADO
5 | Tabla de Valoración // 01.2 Acuerdo/Compromiso de Desempeño | PUNTOS
100 | PESO
5 | RESULTADO
5 | Tabla de Valoración // 01.3 Socialización Interna sobre la Evaluación del Desempeño Institucional (EDI) | PUNTOS
100 | PESO
5 | RESULTADO
5 | Tabla de Valoración // 01.4 Socialización Externa sobre la Evaluación de Desempeño Institucional (EDI) | PUNTOS
100 | PESO
5 | RESULTADO
5 | Tabla de Valoración // 01.5 Estrategía de Comunicación Metas Prioritarias de Gobierno | PUNTOS
100 | PESO
5 | RESULTADO
5 | Tabla de Valoración // 01.6 Capacitación por el Equipo del Comité EDI | PUNTOS
100 | PESO
5 | RESULTADO
5 | Tabla de Valoración // 01.7 Aplicación de la Encuesta de Clima Organizacional | PUNTOS
100 | PESO
5 | RESULTADO
5 | Tabla de Valoración // 02. Elaboración e Implementación del Plan de Mejora (Plan de Acción/Trabajo) // 02.1 Plan de Trabajo y Definición de Metas. | PUNTOS
100 | PESO
10 | RESULTADO
10 | Tabla de Valoración // 02.2 Conformación y Gestión de Reuniones a Nivel Inter e Intrasectorial para el Logro de los Indicadores de Resultados | PUNTOS
100 | PESO
10 | RESULTADO
10 | Tabla de Valoración // 02.3 Integración de las Metas Numérica del Desempeño Institucional en los Instrumentos de Planificación y Presupuestación Institucional | PUNTOS
100 | PESO
10 | RESULTADO
10 | Tabla de Valoración // 03. Autoevaluación // 03.1 Presentación de Resultados Logrados en el 2025 | PUNTOS
100 | PESO
5 | RESULTADO
5 | Tabla de Valoración // 03.2 Presentación de la Evaluación del Desempeño Institucional EDI 2025 | PUNTOS
100 | PESO
10 | RESULTADO
10 | Tabla de Valoración // 04. Seguimiento del Plan de Trabajo // 04.1 Informe Trimestral de Seguimiento y Avance del Plan de Trabajo | PUNTOS
100 | PESO
10 | RESULTADO
10 | Tabla de Valoración // 05. Verificación e Informe de Evaluación del Desempeño Institucional // 05.1 Informe de Resultados | PUNTOS
100 | PESO
10 | RESULTADO
10 | Tabla de Valoración
- **JSON embebido en HTML:** no detectado
- **Formularios:** 0
- **Paginacion en UI:** no detectada
- **API encontrada:** NO

### Endpoints potencialmente utiles

_No se detectaron respuestas JSON/GraphQL reutilizables durante la navegacion._

### Exportaciones detectadas (enlaces "Descargar/Exportar")

1. `GET /GestionPublica/CargaEvidenciaEdi/ExportarDatos/177` ("Descargar Datos")
   - Estado: 200 · Content-Type: application/vnd.ms-excel · Tamano: 2.8 KB · attachment; filename=DatosOrganismo.xls
   - Contenido real: **HTML_TABLE** · 14 filas · Columnas: `OrganismoID`, `CODIGO`, `INDICADOR`, `VALOR_ACTUAL`, `PESO`, `CALCULO`
   - Ejemplo sanitizado: `docs/recon/03-implementacion-edi/samples/export-01-descargar-datos.html`

### Recomendacion

- **Metodo recomendado:** CUSTOM
- **Fallback:** DOM (tablas HTML presentes)
- **Estabilidad estimada:** MEDIA
- **Caso de extraccion:** D (exportacion tabular + DOM complementario)
- Exportacion tabular estable: "Descargar Datos" -> /GestionPublica/CargaEvidenciaEdi/ExportarDatos/177 (HTML_TABLE, 6 columnas: OrganismoID, CODIGO, INDICADOR, VALOR_ACTUAL, PESO, CALCULO; 14 filas).
- Sin JSON/API, pero la exportacion ofrece columnas semanticas; usarla como fuente principal y el DOM para los datos que no incluya.

_Artefactos: `docs/recon/03-implementacion-edi` (summary.json, requests.json, samples/, screenshot.png)_

## 4. Politicas Transversales

- **URL:** https://www.sismap.gob.do/GestionPublica/CargaEvidencia/PoliticasTransversales/177?catchall=Instituto-Nacional-de-Aguas-Potables-y-Alcantarillados
- **Estado:** ACCESIBLE (HTTP 200)
- **Autenticacion:** SESSION COOKIE (storageState reutilizado)
- **Cookies de sesion (solo nombres):** ASP.NET_SessionId, __RequestVerificationToken_L0dlc3Rpb25QdWJsaWNh0, .ASPXAUTH
- **Renderizado:** ESTATICO (WordPress, jQuery)
- **Titulo:** Carga de Evidencia
- **Requests analizadas:** 39 (ruido descartado: 4)
- **JSON detectados:** 0 · **GraphQL:** 0 · **XHR/fetch:** 0 · **WebSockets:** 0
- **Tablas HTML:** 86 (filas: 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
- **Encabezados de tabla:** info@inapa.gob.do | 8095671241 | http://www.inapa.gob.do/ // Promedio General
81.84 % | Descargar Datos // 01.POLÍTICA TRANSVERSAL DE GÉNERO // Pt 01.1 Arquitectura Institucional para la Inclusión del Enfoque de Género | PUNTOS
70 | PESO
5.55 | RESULTADO
3.89 | Tabla de Valoración // Pt 01.2 Generación de Capacidades para la Inclusión del Enfoque de Género en las Políticas Públicas | PUNTOS
0 | PESO
5.55 | RESULTADO
0 | Tabla de Valoración // Pt 01.3 Inclusión del Enfoque de Género en las Políticas Públicas | PUNTOS
80 | PESO
5.56 | RESULTADO
4.45 | Tabla de Valoración // 02.POLÍTICA TRANSVERSAL DE COHESIÓN TERRITORIAL // Pt 02.1 Cohesión Territorial | PUNTOS
85 | PESO
16.67 | RESULTADO
14.17 | Tabla de Valoración // 03.POLÍTICA TRANSVERSAL DE SOSTENIBILIDAD AMBIENTAL // Pt 03.1 Sostenibilidad Ambiental | PUNTOS
79 | PESO
16.67 | RESULTADO
13.17 | Tabla de Valoración // 04.POLÍTICA TRANSVERSAL DE GESTIÓN INTEGRAL DE RIESGOS // Pt 04.1 Gestión Integral de Riesgos | PUNTOS
100 | PESO
16.67 | RESULTADO
16.67 | Tabla de Valoración // 05.POLÍTICA TRANSVERSAL DE DERECHOS HUMANOS // Pt 05.1 Derechos Humanos | PUNTOS
80 | PESO
16.66 | RESULTADO
13.33 | Tabla de Valoración // 06.POLÍTICA TRANSVERSAL DE PARTICIPACIÓN SOCIAL (Sectoriales) // Ptm 06.1 Participación Social (Sectoriales) | No Aplica | Tabla de Valoración // 06.POLÍTICA TRANSVERSAL DE PARTICIPACIÓN SOCIAL (No Sectoriales) // Pt 06.1 Participación Social (No Sectoriales) | PUNTOS
97 | PESO
16.66 | RESULTADO
16.16 | Tabla de Valoración
- **JSON embebido en HTML:** no detectado
- **Formularios:** 0
- **Paginacion en UI:** no detectada
- **API encontrada:** NO

### Endpoints potencialmente utiles

_No se detectaron respuestas JSON/GraphQL reutilizables durante la navegacion._

### Exportaciones detectadas (enlaces "Descargar/Exportar")

1. `GET /GestionPublica/CargaEvidencia/ExportarDatosTransversales/177` ("Descargar Datos")
   - Estado: 200 · Content-Type: application/vnd.ms-excel · Tamano: 1.5 KB · attachment; filename=DatosOrganismo.xls
   - Contenido real: **HTML_TABLE** · 8 filas · Columnas: `OrganismoID`, `CODIGO`, `INDICADOR`, `VALOR_ACTUAL`, `PESO`, `CALCULO`
   - Ejemplo sanitizado: `docs/recon/04-politicas-transversales/samples/export-01-descargar-datos.html`

### Recomendacion

- **Metodo recomendado:** CUSTOM
- **Fallback:** DOM (tablas HTML presentes)
- **Estabilidad estimada:** MEDIA
- **Caso de extraccion:** D (exportacion tabular + DOM complementario)
- Exportacion tabular estable: "Descargar Datos" -> /GestionPublica/CargaEvidencia/ExportarDatosTransversales/177 (HTML_TABLE, 6 columnas: OrganismoID, CODIGO, INDICADOR, VALOR_ACTUAL, PESO, CALCULO; 8 filas).
- Sin JSON/API, pero la exportacion ofrece columnas semanticas; usarla como fuente principal y el DOM para los datos que no incluya.

_Artefactos: `docs/recon/04-politicas-transversales` (summary.json, requests.json, samples/, screenshot.png)_
