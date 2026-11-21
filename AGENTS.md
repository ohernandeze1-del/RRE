# Contexto compartido — consolidación del grupo

Este archivo es la memoria del equipo. Cualquier chat nuevo (Cursor o Grok) tiene que leerlo antes de tocar código o números. Los chats no se comparten solos: si una decisión cambia, se escribe acá.

Grupo ficticio. Ningún dato de Grupo AG. Moneda del grupo: USD. Período: 2026.

## Qué hay que entregar

Un comando que lea `data/` y deje un número de grupo en USD. Cada importe de la salida cita archivo y número de fila. El demo en vivo tiene que poder abrir cualquier cifra hasta esa fila.

El motor no lee `data/clave_equipo.csv`. Esa clave es para que el equipo sepa si el resultado está bien. Las reglas detectan los errores; no se buscan por número de fila hardcodeado.

## Archivos

- `data/companies.csv` — seis empresas y su moneda.
- `data/fx_rates.csv` — tasa oficial. `amount_usd = amount * usd_per_unit`. USD 1, ARS 0.001, EUR 2.
- `data/assumptions.csv` — impuesto 0.30, WACC 0.10.
- `data/budget_lines.csv` — presupuesto. La fila 1 es el encabezado. El número de fila del archivo es el origen.
- `data/pasted_indicators.csv` — ROIC, ROCE y EVA copiados a mano, mal.
- `data/clave_equipo.csv` — respuesta para el equipo.

## Reglas

1. La moneda de la fila tiene que ser la moneda de la empresa. Si no, la fila no entra.
2. Dos filas iguales en empresa, cuenta, moneda, importe, contraparte, período y detalle: entra una, se frena la copia. Dos ventas del mismo importe con distinto detalle son dos ventas.
3. Una fila `TOTAL_*` no se suma. Se compara contra el detalle. Si no cuadra, se reporta y no entra.
4. Venta entre empresas: `REV_IC` de A hacia B se elimina junto con `COGS_IC` de B hacia A cuando los USD coinciden. Si falta un lado, el importe no entra al número limpio y queda como descalce, con su fila.

## Número limpio esperado

EBIT del grupo: **8.950 USD**.

Ese EBIT ya está en USD, sin la fila mala de Costa, sin la copia de Pampa, sin el total de Sierra, sin las ventas internas que tienen espejo, y sin los 500 USD que Norte le vendió a Sur.

NOPAT = 8.950 × (1 − 0.30) = **6.265 USD**.

Balance del grupo en USD: activo 49.000, pasivo corriente 9.700, patrimonio 29.600, deuda financiera 9.700. Cada empresa balancea (activo = patrimonio + deuda + pasivo corriente). En este dummy el balance no tiene cuentas entre empresas.

Capital empleado = activo − pasivo corriente = **39.300**.
Capital invertido = patrimonio + deuda financiera = **39.300**.

ROCE = 8.950 / 39.300 = **22.77%**.
ROIC = 6.265 / 39.300 = **15.94%**.
EVA = 6.265 − (39.300 × 0.10) = **2.335 USD**.

Los valores pegados (22%, 18%, 5.000) tienen que verse al lado del cálculo, no reemplazarlo.

## Roles

- Quien programa: el comando y la tabla de origen.
- Otra persona: chequea 8.950 a mano y explica eliminación, tasa y fórmulas.
- Quien presenta: señala un número y llega a la fila.

## Mensaje para un chat nuevo

Leé AGENTS.md y los CSV de data/. El número limpio del grupo es 8.950 USD de EBIT. No uses clave_equipo.csv dentro del cálculo. Seguí desde el rol que te diga la persona.
