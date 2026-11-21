# Demo para el director

Oscar lee en voz alta las seis frases, la suma y el recorrido. Brian abre el archivo. Si preguntan cómo se calcula, qué tasa se usó o cómo se cruzó una venta entre empresas, habla Josué.

No se dicen códigos de cuenta ni nombres de columnas. Los números sí.

## 1. Seis frases en voz alta

1. El EBIT del grupo es 8.950 dólares.
2. Es la ganancia de operar las seis empresas en 2026, antes de intereses y de impuestos, ya pasada a dólares.
3. Un euro vale dos dólares y mil pesos valen un dólar.
4. Las ventas entre empresas no están: el grupo no se factura a sí mismo.
5. Sobre un capital de 39.300 dólares, el retorno operativo, el ROCE, es 22,77%; el retorno después de impuestos, el ROIC, es 15,94%; y el valor creado, el EVA, es 2.335 dólares.
6. Lo copiado a mano, 22%, 18% y 5.000 dólares, no es este cálculo: cada cifra del 8.950 se abre hasta la empresa y la fila que la originó.

## 2. Recorrido de tres clics

Brian muestra el resultado en la máquina. Oscar señala la cifra, dice la empresa y Brian abre la fila. Si la máquina todavía no muestra el resultado, se abre el presupuesto en la fila 25.

Cuando el jurado señala un número:

1. La cifra es la venta de Costa que entra al 8.950: 2.000 dólares.
2. Está en Costa SRL. Costa lleva sus cuentas en pesos.
3. Se abre el presupuesto, `data/budget_lines.csv`, fila 25: venta local, 2.000.000 pesos. Mil pesos son un dólar. Esos 2.000 sí entran.

Si preguntan de dónde sale el 8.950, se lee esta suma. Ya está en dólares.

- Holding Sol aporta 3.800. Vendió 5.000 a terceros (fila 2) y gastó 1.200 de estructura (fila 4).
- Norte SA aporta 1.600. Vendió 3.000 (fila 9), con costo 1.000 (fila 11) y estructura 400 (fila 13).
- Sur GmbH aporta 1.100. Vendió 1.000 euros (fila 18), que son 2.000 dólares, menos 700 de costo (fila 19) y 200 de estructura (fila 20).
- Costa SRL aporta 1.500. Vendió 2.000.000 pesos (fila 25), que son 2.000 dólares, menos 500 de estructura (fila 27).
- Pampa SA aporta 400. Vendió 800.000 pesos una sola vez (fila 33), que son 800 dólares, menos 300 de costo (fila 35) y 100 de estructura (fila 36).
- Sierra SL aporta 550. Dos contratos distintos, 250 euros cada uno (filas 41 y 42), 500 dólares cada uno, menos 300 de costo (fila 44) y 150 de estructura (fila 45).

3.800 + 1.600 + 1.100 + 1.500 + 400 + 550 = 8.950.

Fuera de esa suma quedan tres ventas internas. Dos se anulan porque los dos lados coinciden: Holding le cobró 200 dólares a Costa (fila 3) y Costa anotó el mismo costo, 200.000 pesos (fila 26); Sierra le vendió a Norte el equivalente a 100 dólares (fila 46) y Norte anotó esa compra (fila 12). La tercera no tiene par: Norte le facturó 500 dólares a Sur (fila 10) y Sur no la registró. Esos 500 tampoco entran. Si piden el cruce, habla Josué.

## 3. Quién habla

- Oscar presenta las seis frases, lee la suma y hace el recorrido.
- Brian maneja la máquina y abre la fila.
- Josué responde solo si preguntan por una fórmula, una tasa o una venta entre empresas.

Si preguntan de qué capital se habla: el grupo tiene 49.000 dólares de activos y 9.700 de deudas que vencen pronto. El capital que trabaja es 39.300. La cuenta la da Josué.

Josué, si le pasan la palabra, dice esto:

- Un dólar vale un dólar, un peso vale 0,001 dólar y un euro vale 2 dólares. El importe en dólares es el importe local por esa tasa.
- La ganancia después de impuestos es 8.950 × (1 − 0,30) = 6.265 dólares.
- El ROCE es 8.950 / 39.300 = 22,77%.
- El ROIC es 6.265 / 39.300 = 15,94%.
- El EVA es 6.265 − (39.300 × 0,10) = 2.335 dólares.

## 4. Una frase por error, sin palabras de código

1. Norte le vendió 500 dólares a Sur y Sur no anotó la compra, así que esos 500 quedan fuera del 8.950, a la vista, en el presupuesto, fila 10.
2. Costa cargó un gasto de 25 millones en dólares aunque trabaja en pesos, así que ese gasto se frena y no entra al resultado, presupuesto, fila 28.
3. Pampa repitió la misma venta de granos de 800.000 pesos, así que entra la primera y la copia se frena, presupuesto, fila 34.
4. Sierra anotó un total de ventas de 800 euros que no coincide con las ventas a terceros, que suman 500 euros, así que ese total no se usa, presupuesto, fila 43.
5. La hoja copiada a mano pone el retorno después de impuestos en 22%, el retorno operativo en 18% y el valor creado en 5.000 dólares, y el cálculo da 15,94%, 22,77% y 2.335 dólares.
