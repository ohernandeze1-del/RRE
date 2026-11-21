# RRE

Presupuesto de un grupo de seis empresas, en una sola moneda. Cada cifra se abre hasta la fila que la originó.

Abrí esta carpeta en Cursor. El agente lee `AGENTS.md` solo. Ahí está el trabajo de cada uno.

| Persona | Trabajo | Dónde escribe |
|---|---|---|
| Brian | El código | `src/` |
| Josué | El chequeo del número a mano | `josue/CHEQUEO.md` |
| Oscar | El demo para un director | `oscar/DEMO.md` |

Los datos están en `data/`. El EBIT limpio del grupo es 8.950 USD. `data/clave_equipo.csv` es la respuesta del equipo. El cálculo no la usa.

Para sacar el número:

```
python src/consolidar.py
```

Eso escribe `salida/informe.html` y `salida/lineas.csv`. El informe es la hoja que se abre en el demo.

La landing está en `index.html`. Abrila en el navegador.
