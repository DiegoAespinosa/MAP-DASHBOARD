# Design

Sistema visual de la página de seguimiento SISMAP · INAPA. Los valores viven como tokens en `src/app/globals.css`.

## Visual Theme

Herramienta institucional, tema claro. Estrategia de color **restringida**: neutros fríos ligeramente teñidos hacia el azul del logo, un único acento (azul marino INAPA) para la acción primaria, la selección y los enlaces, y una paleta semántica para el semáforo expresada siempre con texto.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--brand` | `#002870` ≈ oklch(0.31 0.12 265) | botón primario, foco, enlaces, logo |
| `--brand-strong` | oklch(0.25 0.11 265) | hover del primario |
| `--brand-tint` | oklch(0.95 0.02 265) | fondo de selección y de fila activa |
| `--bg` | oklch(0.975 0.004 265) | fondo de página |
| `--surface` | `#ffffff` | tabla, paneles, cabecera |
| `--surface-2` | oklch(0.965 0.005 265) | encabezados de tabla, filas de grupo |
| `--ink` | oklch(0.22 0.02 265) | texto principal |
| `--ink-2` | oklch(0.42 0.02 265) | texto secundario (≥ 4.5:1 sobre blanco) |
| `--line` | oklch(0.90 0.006 265) | bordes |
| `--line-strong` | oklch(0.82 0.01 265) | bordes de controles |
| Semáforo | vencido rojo, crítico naranja, atención ámbar, próximo amarillo, normal verde, sin fecha gris | fondo tenue + texto oscuro del mismo matiz |
| Bandas de puntuación (cuadros de resumen) | rojo < 60, amarillo 60-75, verde > 75 (`SCORE_BANDS` en `src/config.ts`) | color del número y de la barra; misma paleta que el semáforo |

## Typography

Una sola familia: **Inter Variable** (empaquetada con `@fontsource-variable/inter`, sin dependencia de red), fallback `"Segoe UI", system-ui, sans-serif`. Escala fija en rem, ratio 1.2: 12 / 13 / 14 (base de tabla) / 16 / 20 / 24. Números tabulares (`font-variant-numeric: tabular-nums`) en toda cifra. Encabezados `text-wrap: balance`.

## Spacing & Layout

Escala de 4 px (Tailwind). Contenedor máximo 1600 px con margen lateral 24 px. Cabecera blanca con logo y acciones; debajo, un panel de resumen por fuente dividido por reglas verticales (no tarjetas sueltas); luego filtros y la tabla densa con encabezado fijo y filas agrupadas por sección.

## Components

- **Botón primario**: fondo `--brand`, texto blanco, radio 6 px, altura 36 px, icono + etiqueta. Estados: hover `--brand-strong`, foco anillo 2 px `--brand` con offset, deshabilitado opacidad 0.55 y cursor no permitido, cargando con spinner y texto "Actualizando…".
- **Botón secundario**: superficie blanca, borde `--line-strong`, mismo tamaño.
- **Chips de semáforo**: píldora con fondo semántico tenue y texto oscuro; seleccionada con anillo `--brand`.
- **Tabla**: encabezado `--surface-2` fijo, filas 44 px mínimo, hover `--brand-tint` al 50 %, filas de grupo con el nombre de la sección, filas desplegables para evidencias.
- **Celda editable**: texto normal con borde invisible; al pasar el cursor muestra borde `--line-strong` y un icono de lápiz; al enfocar, borde `--brand`; al guardar, marca de verificación 1.5 s; en error, borde rojo y mensaje. La columna Contacto añade un botón de copiar al portapapeles (marca de verificación 1.5 s).
- **Avisos**: banda con borde completo 1 px y fondo tenue (nunca franja lateral).

## Motion

150–200 ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint). Solo para estados: hover, foco, aparición de avisos, barra de progreso de la actualización. Sin animaciones de carga de página. `prefers-reduced-motion`: transiciones a 0 ms.
