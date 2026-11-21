# Nota para los agentes del equipo

Leé este archivo entero antes de editar nada. El equipo son tres personas. Cada chat es de una sola persona. Hacé solo el trabajo de quien te está hablando.

Grupo ficticio de seis empresas. Ningún dato de Grupo AG. Moneda del grupo: USD. Período: 2026. El EBIT limpio del grupo es **8.950 USD**. Cada cifra del demo tiene que poder abrirse hasta un archivo y una fila.

| Persona | Hace | Archivo que le pertenece |
|---|---|---|
| Brian | El código | `src/` y el comando para correrlo |
| Josué | El chequeo a mano del número | `josue/CHEQUEO.md` |
| Oscar | El demo que entiende un director | `oscar/DEMO.md` |

Josué y Oscar están aprendiendo a usar Cursor. Su agente les explica en castellano, con frases cortas, y escribe solo el archivo de esa persona. Brian es el único que programa el motor.

## Brian

Brian construye un comando de Python que lee `data/` y escribe el número del grupo. Cada importe de la salida cita el archivo y el número de fila. El comando también lista las filas que no entraron y por qué regla.

Brian no rellena `josue/CHEQUEO.md` ni `oscar/DEMO.md`. El código no abre `data/clave_equipo.csv`. Las reglas descubren los errores. Un número de fila escrito fijo en el código no sirve.

Cuando el comando corra, Brian le pasa a Josué la salida para que la compare con 8.950.

## Josué

Josué comprueba el número a mano y deja la explicación en `josue/CHEQUEO.md`. Ese archivo tiene que mostrar, con filas reales de `data/budget_lines.csv`:

1. Un ejemplo de la tasa. `amount_usd = amount * usd_per_unit`. USD vale 1, ARS vale 0.001, EUR vale 2.
2. El camino hasta 8.950 USD: qué filas se suman, cuáles se eliminan porque una empresa le vendió a otra, y cuáles se frenan.
3. Las fórmulas con los números ya puestos. NOPAT = 8.950 × (1 − 0.30) = 6.265. ROCE = 8.950 / 39.300 = 22.77%. ROIC = 6.265 / 39.300 = 15.94%. EVA = 6.265 − (39.300 × 0.10) = 2.335 USD.
4. Los cinco errores, uno por uno, en una oración: qué pasó, en qué empresa, archivo y fila.

Josué edita solo `josue/CHEQUEO.md`. En el demo responde si preguntan por una fórmula, una tasa o una venta entre empresas.

Primer mensaje de Josué:

> Soy Josué. Leé AGENTS.md. Completá josue/CHEQUEO.md conmigo, en castellano, citando filas de data/budget_lines.csv. No escribas código y no modifiques data/.

## Oscar

Oscar prepara lo que se dice delante del jurado y lo deja en `oscar/DEMO.md`. Un director tiene que entenderlo sin ayuda. El archivo tiene:

1. Seis frases para decir en voz alta. La primera es el número: el EBIT del grupo es 8.950 USD.
2. Un recorrido de tres clics: se señala una cifra, se dice en qué empresa está, se abre la fila que la originó.
3. Quién habla. Oscar presenta. Brian maneja la máquina. Josué habla solo si la pregunta es de fórmula o de tasa.
4. Una frase por cada error encontrado, sin palabras de código.

Oscar edita solo `oscar/DEMO.md`. Cuando exista la salida de Brian, el recorrido usa esa salida, no una pantalla imaginaria.

Primer mensaje de Oscar:

> Soy Oscar. Leé AGENTS.md. Completá oscar/DEMO.md conmigo, en castellano, para que un director entienda el número sin ayuda. No escribas código y no modifiques data/.

## Archivos de datos

- `data/companies.csv` — seis empresas y su moneda.
- `data/fx_rates.csv` — tasa oficial.
- `data/assumptions.csv` — impuesto 0.30 y WACC 0.10.
- `data/budget_lines.csv` — presupuesto. La fila 1 es el encabezado. El número de fila del archivo es el origen.
- `data/pasted_indicators.csv` — ROIC, ROCE y EVA copiados a mano, con valores que no coinciden.
- `data/clave_equipo.csv` — respuesta para las personas. El código no la lee.
- `data/ventas_historicas.csv` — ventas reales a terceros, 2021 a 2025, en la moneda de cada empresa. No es el presupuesto. No trae errores sembrados. El presupuesto de 2026 sigue en `budget_lines.csv`.

## Portal que vamos a mostrar

Entran dos personas, con usuario y clave falsos escritos en la pantalla: Norte y un director del grupo. Norte sube un archivo o tipea sus números. Ve solo lo suyo, en su moneda y en USD, y las filas frenadas. No ve a las otras empresas. El director ve primero el número del grupo en USD y, al tocarlo, la fila original.

El histórico ya está. El forecast —proyectar 2026 desde esos cinco años y compararlo con el presupuesto— todavía no es una pantalla. No lo inventen en el código hasta que Brian lo pida.

## Reglas del número

1. La moneda de la fila tiene que ser la moneda de la empresa. Si no, la fila no entra.
2. Dos filas iguales en empresa, cuenta, moneda, importe, contraparte, período y detalle: entra una y se frena la copia. Dos ventas del mismo importe con distinto detalle son dos ventas.
3. Una fila `TOTAL_*` no se suma. Se compara contra el detalle. Si no cuadra, se reporta y no entra.
4. `REV_IC` de A hacia B se elimina junto con `COGS_IC` de B hacia A cuando los USD coinciden. Si falta un lado, ese importe queda como descalce, con su fila, fuera del número limpio.

Balance del grupo en USD: activo 49.000, pasivo corriente 9.700, patrimonio 29.600, deuda financiera 9.700. Capital empleado y capital invertido, en este dummy, son 39.300. Los valores pegados a mano (22%, 18% y 5.000) se muestran al lado del cálculo.

## Si una decisión cambia

Se anota en este archivo y se sube al repo. Un chat viejo no se entera solo. La persona abre un chat nuevo.
