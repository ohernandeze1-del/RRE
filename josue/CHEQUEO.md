# Chequeo de Josué

Instrucción para el agente: la persona es Josué. Completá este archivo con él, en castellano. Citá archivo y número de fila. Editá solo este archivo. No escribas código y no modifiques `data/`.

El número al que hay que llegar es 8.950 USD de EBIT. Mostrá el camino. No alcanza con escribir el resultado.

Regla de conversión: `amount_usd = amount * usd_per_unit`. Tasas en `data/fx_rates.csv`: USD = 1 (fila 2), ARS = 0,001 (fila 3), EUR = 2 (fila 4). Impuesto 0,30 y WACC 0,10 en `data/assumptions.csv` filas 3 y 4.

## 1. Cómo se convierte una fila

Ejemplo con una fila real de Costa (moneda ARS):

- Empresa: Costa SRL (`costa`)
- Archivo y fila: `data/budget_lines.csv` fila 25
- Importe en moneda local: 2.000.000 ARS (Ventas a terceros, Venta local)
- Tasa (`usd_per_unit`): 0,001 (`data/fx_rates.csv` fila 3)
- USD: 2.000.000 × 0,001 = **2.000 USD**

Otro ejemplo en euros, Sur GmbH: `data/budget_lines.csv` fila 18, 1.000 EUR × 2 = 2.000 USD.

## 2. Camino hasta 8.950 USD

EBIT = ventas a terceros − costos a terceros − gastos operativos. Solo filas de P&L. No entran ASSET, LIAB_CURRENT, EQUITY ni DEBT.

### Filas que entran (forman el 8.950)

| Empresa | Archivo y fila | Cuenta | Cálculo USD | Signo EBIT |
|---|---|---|---|---|
| Holding Sol | `budget_lines.csv` 2 | REV_EXT | 5.000 × 1 = 5.000 | + |
| Holding Sol | `budget_lines.csv` 4 | OPEX | 1.200 × 1 = 1.200 | − |
| Norte SA | `budget_lines.csv` 9 | REV_EXT | 3.000 × 1 = 3.000 | + |
| Norte SA | `budget_lines.csv` 11 | COGS_EXT | 1.000 × 1 = 1.000 | − |
| Norte SA | `budget_lines.csv` 13 | OPEX | 400 × 1 = 400 | − |
| Sur GmbH | `budget_lines.csv` 18 | REV_EXT | 1.000 × 2 = 2.000 | + |
| Sur GmbH | `budget_lines.csv` 19 | COGS_EXT | 350 × 2 = 700 | − |
| Sur GmbH | `budget_lines.csv` 20 | OPEX | 100 × 2 = 200 | − |
| Costa SRL | `budget_lines.csv` 25 | REV_EXT | 2.000.000 × 0,001 = 2.000 | + |
| Costa SRL | `budget_lines.csv` 27 | OPEX | 500.000 × 0,001 = 500 | − |
| Pampa SA | `budget_lines.csv` 33 | REV_EXT | 800.000 × 0,001 = 800 | + |
| Pampa SA | `budget_lines.csv` 35 | COGS_EXT | 300.000 × 0,001 = 300 | − |
| Pampa SA | `budget_lines.csv` 36 | OPEX | 100.000 × 0,001 = 100 | − |
| Sierra SL | `budget_lines.csv` 41 | REV_EXT | 250 × 2 = 500 | + |
| Sierra SL | `budget_lines.csv` 42 | REV_EXT | 250 × 2 = 500 | + |
| Sierra SL | `budget_lines.csv` 44 | COGS_EXT | 150 × 2 = 300 | − |
| Sierra SL | `budget_lines.csv` 45 | OPEX | 75 × 2 = 150 | − |

Las filas 41 y 42 de Sierra son dos ventas distintas: mismo importe, distinto detalle (`Contratos norte` y `Contratos sur`). Entran las dos.

Suma de ingresos a terceros: 5.000 + 3.000 + 2.000 + 2.000 + 800 + 500 + 500 = **13.800 USD**.

Suma de costos y gastos: 1.200 + 1.000 + 400 + 700 + 200 + 500 + 300 + 100 + 300 + 150 = **4.850 USD**.

EBIT limpio: 13.800 − 4.850 = **8.950 USD**.

### Ventas entre empresas que se eliminan (los USD coinciden)

1. Holding → Costa: `budget_lines.csv` fila 3, REV_IC 200 USD a Costa. Espejo en fila 26, COGS_IC 200.000 ARS × 0,001 = 200 USD. Neto del grupo = 0. No entra al EBIT.
2. Sierra → Norte: `budget_lines.csv` fila 46, REV_IC 50 EUR × 2 = 100 USD a Norte. Espejo en fila 12, COGS_IC 100 USD. Neto del grupo = 0. No entra al EBIT.

### Descalce (falta un lado; queda fuera del número limpio)

- Norte → Sur: `budget_lines.csv` fila 10, REV_IC 500 USD a Sur. Sur no tiene COGS_IC. Los 500 USD no entran al 8.950.

### Filas que se frenan

1. `budget_lines.csv` fila 28, Costa SRL: OPEX 25.000.000 en USD. La moneda de Costa es ARS (`data/companies.csv` fila 5). La fila no entra.
2. `budget_lines.csv` fila 34, Pampa SA: copia exacta de la fila 33 (misma empresa, cuenta, moneda, importe, período y detalle `Venta granos`). Entra la 33. Se frena la 34.
3. `budget_lines.csv` fila 43, Sierra SL: TOTAL_REV 800 EUR. El detalle REV_EXT de las filas 41 y 42 suma 250 + 250 = 500 EUR. El total no cuadra. La fila TOTAL no se suma.

## 3. Fórmulas con los números puestos

Capital empleado = capital invertido = 39.300 USD. Sale del balance del grupo: activo 49.000 − pasivo corriente 9.700 = 39.300. También: patrimonio 29.600 + deuda financiera 9.700 = 39.300.

- NOPAT = 8.950 × (1 − 0,30) = **6.265 USD**
- ROCE = 8.950 / 39.300 = **22,77%**
- ROIC = 6.265 / 39.300 = **15,94%**
- EVA = 6.265 − (39.300 × 0,10) = 6.265 − 3.930 = **2.335 USD**

Al lado, los valores pegados en `data/pasted_indicators.csv`:

| Indicador | Calculado | Pegado (archivo y fila) | Diferencia |
|---|---|---|---|
| ROIC | 15,94% | 22% (`pasted_indicators.csv` fila 2) | el pegado está 6,06 puntos por encima |
| ROCE | 22,77% | 18% (`pasted_indicators.csv` fila 3) | el pegado está 4,77 puntos por debajo |
| EVA | 2.335 USD | 5.000 USD (`pasted_indicators.csv` fila 4) | el pegado está 2.665 USD por encima |

Los KPIs pegados a mano no se usan para el número del grupo.

## 4. Los cinco errores, en una oración cada uno

1. Norte vende 500 USD a Sur en `budget_lines.csv` fila 10 y Sur no registra la compra: hay descalce y esa venta no entra al EBIT limpio.
2. Costa carga un OPEX de 25.000.000 en USD en `budget_lines.csv` fila 28, pero su moneda es ARS, así que la fila se frena.
3. Pampa repite en `budget_lines.csv` fila 34 la misma venta de granos de la fila 33 (800.000 ARS): entra una y se frena la copia.
4. Sierra trae un TOTAL_REV de 800 EUR en `budget_lines.csv` fila 43, el detalle de ventas a terceros suma 500 EUR, y el total se frena.
5. En `pasted_indicators.csv` filas 2 a 4 alguien pegó ROIC 22%, ROCE 18% y EVA 5.000 USD, y no coinciden con 15,94%, 22,77% y 2.335 USD calculados desde las cuentas.
