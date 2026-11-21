import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = {
    "EMP01": {
        "revenue": (72_000_000, 12_903_226, 15_483_871, "Cumplir el presupuesto de 2026 con los clientes de siempre, sin meter la venta a otra empresa del grupo."),
        "etica": (None, 62, 80, "Publicar el código de planta y abrir una línea de denuncia antes del cierre."),
        "sostenibilidad": (None, 48, 72, "Arrancar el horno de chatarra y medir cada mes cuánto retorna a la planta."),
        "participacion": (72_000_000, 18, 22, "Subir la participación en el mercado del escenario sin comprar volumen interno."),
        "nuevos": (4_000_000, 0, 0, "Este presupuesto no abre un país nuevo. El potencial queda en un corredor que hoy no se atiende."),
    },
    "EMP02": {
        "revenue": (48_000_000, 5_161_290, 6_193_548, "Cumplir el presupuesto con la red de distribuidores, sin abrir una sucursal por plaza."),
        "etica": (None, 70, 85, "Revisar a cada distribuidor nuevo antes de entregarle producto."),
        "sostenibilidad": (None, 55, 70, "Entregar por la red para no multiplicar depósitos propios."),
        "participacion": (48_000_000, 11, 14, "Ganar puntos de participación con socios regionales, no con tienda propia."),
        "nuevos": (3_500_000, 0, 600_000, "Preparar dos plazas donde Metro no tiene sucursal y que el presupuesto ya puede nombrar."),
    },
    "EMP03": {
        "revenue": (24_000_000, 5_000_000, 6_000_000, "Cumplir el presupuesto cubriendo con flota propia el tramo que más se usa."),
        "etica": (None, 74, 88, "Poner horas de manejo y descanso en el contrato de la flota."),
        "sostenibilidad": (None, 52, 75, "Sustituir el flete externo del tramo principal y seguir el consumo con telemetría."),
        "participacion": (24_000_000, 21, 26, "Tomar el tramo de planta a puerto que hoy hace un tercero."),
        "nuevos": (2_000_000, 0, 300_000, "Cotizar un corredor de puerto extra. Solo una parte entra al presupuesto de este año."),
    },
    "EMP04": {
        "revenue": (56_000_000, 8_000_000, 10_000_000, "Cumplir el presupuesto laminando en planta el perfil que hoy se manda afuera."),
        "etica": (None, 58, 78, "Registrar las quejas de planta y hacer una auditoría en el año."),
        "sostenibilidad": (None, 44, 68, "Laminar en Honduras el perfil que hoy viaja a un tercero."),
        "participacion": (56_000_000, 14, 18, "Quedarse con el perfil que el mercado local hoy importa."),
        "nuevos": (5_000_000, 0, 1_000_000, "Tratar el perfil importado como mercado nuevo y meter al presupuesto solo lo que la línea puede hacer."),
    },
    "EMP05": {
        "revenue": (36_000_000, 3_200_000, 3_000_000, "El presupuesto cae. Primero frenar la pérdida de ferreterías, antes de hablar de crecer."),
        "etica": (None, 66, 82, "Exigir ficha de origen al acero que se revende."),
        "sostenibilidad": (None, 50, 65, "Concentrar la compra en proveedores que ya tienen ficha ambiental."),
        "participacion": (36_000_000, 9, 9, "Sostener la participación. El presupuesto de este año no la recupera."),
        "nuevos": (1_200_000, 0, 0, "No abrir plaza nueva mientras la red actual se cae."),
    },
    "EMP06": {
        "revenue": (6_000_000, 2_000_000, 2_400_000, "Cumplir el presupuesto de servicios al grupo, medido en dólares."),
        "etica": (None, 80, 90, "Dejar una sola política de ética y aplicarla a las seis empresas."),
        "sostenibilidad": (None, 60, 78, "Juntar el reporte de las seis empresas en una sola hoja del grupo."),
        "participacion": (6_000_000, 33, 40, "Vender más servicios a las empresas del grupo que hoy los contratan afuera."),
        "nuevos": (800_000, 0, 200_000, "Ofrecer el servicio del holding a una empresa más, solo por el monto que ya está en el presupuesto."),
    },
}
GRUPO = {
    "revenue": "El paso de este año es el presupuesto. El potencial es el mercado del escenario que todavía no compra al grupo.",
    "etica": "Medir a las seis con el mismo índice y empujar primero a las que están por debajo de 65.",
    "sostenibilidad": "La meta del grupo es el promedio ponderado por las ventas, no el promedio simple de las plantas.",
    "participacion": "La participación del grupo es la suma de ventas sobre la suma de esos mercados.",
    "nuevos": "Los mercados nuevos de este año son solo los que el presupuesto ya nombra. El resto queda como potencial.",
}
ORDER = ["EMP01", "EMP02", "EMP03", "EMP04", "EMP05", "EMP06"]
TOPICS = ["revenue", "etica", "sostenibilidad", "participacion", "nuevos"]


def cell(value):
    return "" if value is None else str(value)


def quote(text):
    return '"' + text.replace('"', '""') + '"'


def main():
    lines = ["empresa,topico,mercado_usd,actual,deseado,actividad"]
    js_rows = []

    def add(empresa, topico, mercado, actual, deseado, actividad):
        fila = len(lines) + 1
        lines.append(",".join([empresa, topico, cell(mercado), cell(actual), cell(deseado), quote(actividad)]))
        js_rows.append({
            "empresa": empresa,
            "topico": topico,
            "mercado": mercado,
            "actual": actual,
            "deseado": deseado,
            "actividad": actividad,
            "fila": fila,
        })

    for empresa in ORDER:
        for topico in TOPICS:
            mercado, actual, deseado, actividad = DATA[empresa][topico]
            add(empresa, topico, mercado, actual, deseado, actividad)
    for topico in TOPICS:
        add("GRUPO", topico, None, None, None, GRUPO[topico])

    (ROOT / "datos-demo" / "skala.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")
    payload = {"file": "datos-demo/skala.csv", "rows": js_rows}
    (ROOT / "portales" / "skala.js").write_text(
        "window.RRE_SKALA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"filas {len(js_rows)}")


if __name__ == "__main__":
    main()
