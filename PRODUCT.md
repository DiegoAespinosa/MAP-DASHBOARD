# Product

## Register

product

## Users

Dos perfiles dentro del Instituto Nacional de Aguas Potables y Alcantarillados (INAPA), República Dominicana:

- **Equipo de planificación y calidad** (uso diario): pocas personas, en oficina, en monitor de escritorio. Revisan qué evidencias de SISMAP vencen pronto, quién las verifica en el MAP, y anotan responsable interno y notas de seguimiento. Su tarea principal en pantalla: encontrar rápido lo vencido o próximo a vencer y dejar constancia de quién lo atiende.
- **Dirección y gerencia** (consulta ocasional): entran para ver el cumplimiento general por fuente (SISMAP GP, EDI, Políticas Transversales, ranking) y los totales del semáforo. Necesitan el resumen en los primeros segundos, sin bajar a la tabla.

## Product Purpose

Una sola página interna que muestra el último estado de los indicadores de INAPA en SISMAP (plataforma del Ministerio de Administración Pública), permite actualizarlos bajo demanda desde la fuente, exportarlos a Excel y registrar información interna (responsable, notas) que SISMAP no tiene. Sustituye la revisión manual de cuatro páginas de SISMAP y una hoja de cálculo compartida. Éxito: ningún vencimiento sorprende al equipo, y la dirección obtiene el cumplimiento sin pedir un informe.

## Brand Personality

Institucional, sobrio, fiable. Es una herramienta de gobierno: la identidad la lleva el logo de INAPA y su azul marino; todo lo demás es neutro y legible. Tono de la interfaz: directo y en español formal pero sin burocracia ("Actualizar datos", "Última actualización correcta"). Nada de marketing, nada de adornos.

## Anti-references

- Dashboards SaaS con tarjetas idénticas, grandes cifras con degradados y gráficos decorativos que no ayudan a decidir.
- Paneles "oscuros tipo terminal" o estética tecnológica: no es el contexto ni el público.
- La propia SISMAP (tablas anidadas, encabezados en mayúsculas de 12 px, medidores circulares sin texto): se toma la información, no el estilo.
- Formularios y modales para editar una nota: la edición es en línea, al salir del campo.

## Design Principles

1. **Lo vencido primero.** La jerarquía visual sirve a una pregunta: ¿qué vence y de quién depende? Todo lo demás se subordina.
2. **Un vistazo para dirección, una tabla para el equipo.** El resumen por fuente y el semáforo viven arriba y se entienden sin leer la tabla; la tabla es densa y completa.
3. **Fuente de verdad visible.** Siempre se muestra cuándo se actualizó por última vez con éxito, cuándo fue el último intento y qué fuente falló. Datos viejos se marcan, nunca se ocultan.
4. **Lo interno se distingue de lo de SISMAP.** Las columnas editables se ven editables; las de SISMAP no.
5. **Familiaridad antes que sorpresa.** Controles estándar, estados completos (hover, foco, deshabilitado, guardando, error), sin invenciones.

## Accessibility & Inclusion

WCAG 2.1 AA: contraste mínimo 4.5:1 en texto, foco visible con teclado en todos los controles, tabla con encabezados semánticos y botones con nombre accesible. Semáforo expresado con texto además de color. Optimizado para escritorio (≥ 1280 px); usable en tablet con desplazamiento horizontal de la tabla. Respeta `prefers-reduced-motion`.
