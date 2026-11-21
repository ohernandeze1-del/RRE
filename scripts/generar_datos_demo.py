"""Genera los Excel y CSV crudos del demo y portales/datos.js."""

from __future__ import annotations

import csv
import json
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "datos-demo"
JS = ROOT / "portales" / "datos.js"

MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
WEIGHTS = [7, 7, 8, 8, 8, 8, 8, 9, 9, 9, 9, 10]

COMPANIES = [
    {"id": "EMP01", "name": "Aceros del Sur", "country": "Guatemala", "currency": "GTQ", "role": "Acero y reciclaje", "budget": 120_000_000, "prior": 100_000_000},
    {"id": "EMP02", "name": "Distribuidora Metro", "country": "Guatemala", "currency": "GTQ", "role": "Distribución", "budget": 48_000_000, "prior": 40_000_000},
    {"id": "EMP03", "name": "Logística CA", "country": "El Salvador", "currency": "USD", "role": "Logística", "budget": 6_000_000, "prior": 5_000_000},
    {"id": "EMP04", "name": "Aceros Honduras", "country": "Honduras", "currency": "HNL", "role": "Acero", "budget": 250_000_000, "prior": 200_000_000},
    {"id": "EMP05", "name": "Ferretería Norte", "country": "Honduras", "currency": "HNL", "role": "Retail", "budget": 75_000_000, "prior": 80_000_000},
    {"id": "EMP06", "name": "Holding Servicios", "country": "Panamá", "currency": "USD", "role": "Holding", "budget": 2_400_000, "prior": 2_000_000},
]

FX = {"USD": 1, "GTQ": 7.75, "HNL": 25}

INITIATIVES = [
    {
        "id": "INI01",
        "company": "EMP01",
        "name": "Horno de reciclaje",
        "ppt": "EMP01_horno_reciclaje.pptx",
        "currency": "USD",
        "ingreso": [0, 0, 0, 0, 40_000, 60_000, 80_000, 100_000, 120_000, 140_000, 160_000, 180_000],
        "inversion": [300_000, 300_000, 200_000, 200_000, 100_000, 100_000, 50_000, 50_000, 50_000, 50_000, 50_000, 50_000],
    },
    {
        "id": "INI02",
        "company": "EMP02",
        "name": "Red de distribuidores",
        "ppt": "EMP02_red_distribuidores.pptx",
        "currency": "USD",
        "ingreso": [20_000, 20_000, 25_000, 25_000, 30_000, 30_000, 35_000, 35_000, 40_000, 40_000, 45_000, 45_000],
        "inversion": [80_000, 40_000, 20_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000],
    },
    {
        "id": "INI03",
        "company": "EMP04",
        "name": "Línea de laminación",
        "ppt": "EMP04_laminacion.pptx",
        "currency": "USD",
        "ingreso": [0, 0, 0, 30_000, 50_000, 70_000, 90_000, 110_000, 130_000, 150_000, 170_000, 190_000],
        "inversion": [400_000, 250_000, 150_000, 100_000, 50_000, 50_000, 25_000, 25_000, 25_000, 25_000, 25_000, 25_000],
    },
    {
        "id": "INI04",
        "company": "EMP03",
        "name": "Flota propia",
        "ppt": "EMP03_flota.pptx",
        "currency": "USD",
        "ingreso": [15_000, 15_000, 15_000, 20_000, 20_000, 20_000, 25_000, 25_000, 25_000, 30_000, 30_000, 30_000],
        "inversion": [120_000, 60_000, 20_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000],
    },
]


def split(annual: int) -> list[int]:
    return [annual * weight // 100 for weight in WEIGHTS]


def portions(total: int, weights: list[int]) -> list[int]:
    values = [total * weight // 100 for weight in weights]
    values[-1] += total - sum(values)
    return values


# El presupuesto publicado de cada empresa queda en los clientes externos.
# El cliente interno es una venta entre empresas: va en el Excel y no entra al número.
BOOKS = {
    "EMP01": {
        "externos": [
            {"cliente": "Constructora Izabal", "budget": 50, "prior": 55, "motivo": "Sube el volumen de varilla."},
            {"cliente": "Cementos del Valle", "budget": 30, "prior": 30, "motivo": "El precio del contrato anual sube."},
            {"cliente": "Taller Océano", "budget": 20, "prior": 15, "motivo": "Compra más chatarra que el año pasado."},
        ],
        "interno": {"cliente": "Distribuidora Metro", "budget": 8_400_000, "prior": 6_200_000, "motivo": "Venta a otra empresa del grupo. Esta línea no entra."},
    },
    "EMP02": {
        "externos": [
            {"cliente": "Ferretería El Prado", "budget": 60, "prior": 50, "motivo": "Abre más puntos de venta."},
            {"cliente": "Depósito Central", "budget": 40, "prior": 50, "motivo": "Este depósito compra menos."},
        ],
        "interno": {"cliente": "Aceros del Sur", "budget": 3_600_000, "prior": 2_800_000, "motivo": "Venta a otra empresa del grupo. Esta línea no entra."},
    },
    "EMP03": {
        "externos": [
            {"cliente": "Puerto Acajutla", "budget": 70, "prior": 60, "motivo": "Más carga de importación."},
            {"cliente": "Almacén Pacífico", "budget": 30, "prior": 40, "motivo": "Baja el almacenaje de este cliente."},
        ],
        "interno": {"cliente": "Holding Servicios", "budget": 450_000, "prior": 380_000, "motivo": "Venta a otra empresa del grupo. Esta línea no entra."},
    },
    "EMP04": {
        "externos": [
            {"cliente": "Constructora Sula", "budget": 55, "prior": 50, "motivo": "Más obra privada en San Pedro Sula."},
            {"cliente": "Agroindustrias Lenca", "budget": 45, "prior": 50, "motivo": "El ingenio pide menos acero."},
        ],
        "interno": {"cliente": "Ferretería Norte", "budget": 15_000_000, "prior": 12_000_000, "motivo": "Venta a otra empresa del grupo. Esta línea no entra."},
    },
    "EMP05": {
        "externos": [
            {"cliente": "Obra San Pedro", "budget": 55, "prior": 40, "motivo": "Concentra más obra de este cliente."},
            {"cliente": "Cadena del Lago", "budget": 25, "prior": 40, "motivo": "Perdió parte del contrato de la cadena."},
            {"cliente": "Depósito Choloma", "budget": 20, "prior": 20, "motivo": "Sigue el mismo peso que el año pasado."},
        ],
        "interno": {"cliente": "Aceros Honduras", "budget": 5_000_000, "prior": 6_400_000, "motivo": "Venta a otra empresa del grupo. Esta línea no entra."},
    },
    "EMP06": {
        "externos": [
            {"cliente": "Aseguradora Istmo", "budget": 50, "prior": 50, "motivo": "Renueva el contrato de servicios."},
            {"cliente": "Banco del Puerto", "budget": 50, "prior": 50, "motivo": "El fee mensual se mantiene."},
        ],
        "interno": {"cliente": "Logística CA", "budget": 180_000, "prior": 150_000, "motivo": "Venta a otra empresa del grupo. Esta línea no entra."},
    },
}

# Supuestos de prueba, no salen del Excel de ventas. Impuesto 30 % y WACC 10 % en todas.
# El capital está en la moneda de la empresa y es el mismo para empleado e invertido.
ASSUMPTIONS = {
    "EMP01": {"impuesto": 0.30, "wacc": 0.10, "capital_empleado": 150_000_000, "capital_invertido": 150_000_000},
    "EMP02": {"impuesto": 0.30, "wacc": 0.10, "capital_empleado": 80_000_000, "capital_invertido": 80_000_000},
    "EMP03": {"impuesto": 0.30, "wacc": 0.10, "capital_empleado": 10_000_000, "capital_invertido": 10_000_000},
    "EMP04": {"impuesto": 0.30, "wacc": 0.10, "capital_empleado": 250_000_000, "capital_invertido": 250_000_000},
    "EMP05": {"impuesto": 0.30, "wacc": 0.10, "capital_empleado": 125_000_000, "capital_invertido": 125_000_000},
    "EMP06": {"impuesto": 0.30, "wacc": 0.10, "capital_empleado": 4_000_000, "capital_invertido": 4_000_000},
}


def sheet_xml(headers: list[str], rows: list[list]) -> str:
    def cell(col: int, row_index: int, value) -> str:
        ref = f"{chr(64 + col)}{row_index}"
        if isinstance(value, str):
            return f'<c r="{ref}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'
        return f'<c r="{ref}"><v>{value}</v></c>'

    body = []
    all_rows = [headers, *rows]
    for r, row in enumerate(all_rows, start=1):
        cells = "".join(cell(c, r, value) for c, value in enumerate(row, start=1))
        body.append(f'<row r="{r}">{cells}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<sheetData>{''.join(body)}</sheetData></worksheet>"
    )


def write_xlsx(path: Path, headers: list[str], rows: list[list], extra_sheets: list[tuple[str, list[str], list]] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sheets = [("Datos", headers, rows), *(extra_sheets or [])]
    overrides = []
    sheet_tags = []
    rels_tags = []
    for index, (name, _headers, _rows) in enumerate(sheets, start=1):
        overrides.append(
            f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
        sheet_tags.append(f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>')
        rels_tags.append(
            f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
        )
    content_types = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
{''.join(overrides)}
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""
    workbook = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>{''.join(sheet_tags)}</sheets>
</workbook>"""
    workbook_rels = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
{''.join(rels_tags)}
</Relationships>"""
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as book:
        book.writestr("[Content_Types].xml", content_types)
        book.writestr("_rels/.rels", rels)
        book.writestr("xl/workbook.xml", workbook)
        book.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        for index, (_name, sheet_headers, sheet_rows) in enumerate(sheets, start=1):
            book.writestr(f"xl/worksheets/sheet{index}.xml", sheet_xml(sheet_headers, sheet_rows))


def write_csv(path: Path, headers: list[str], rows: list[list]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        writer.writerows(rows)


def write_pptx(path: Path, title: str, subtitle: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""
    presentation = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
<p:sldSz cx="9144000" cy="5143500"/>
</p:presentation>"""
    presentation_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>"""
    slide = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="457200" y="600000"/><a:ext cx="8229600" cy="1200000"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es-ES" sz="3200" b="1"/><a:t>{escape(title)}</a:t></a:r></a:p></p:txBody>
</p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="457200" y="2000000"/><a:ext cx="8229600" cy="1800000"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es-ES" sz="2000"/><a:t>{escape(subtitle)}</a:t></a:r></a:p></p:txBody>
</p:sp>
</p:spTree></p:cSld>
</p:sld>"""
    master = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:sldMaster>"""
    master_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>"""
    layout = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="title">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>"""
    layout_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>"""
    theme = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="RRE"><a:themeElements><a:clrScheme name="RRE"><a:dk1><a:srgbClr val="1C1915"/></a:dk1><a:lt1><a:srgbClr val="F7F4EE"/></a:lt1><a:dk2><a:srgbClr val="2A1C0C"/></a:dk2><a:lt2><a:srgbClr val="E7E1D6"/></a:lt2><a:accent1><a:srgbClr val="E2A15A"/></a:accent1><a:accent2><a:srgbClr val="8FD0A4"/></a:accent2><a:accent3><a:srgbClr val="9EC4D6"/></a:accent3><a:accent4><a:srgbClr val="EF8B7A"/></a:accent4><a:accent5><a:srgbClr val="C9B59A"/></a:accent5><a:accent6><a:srgbClr val="8AA399"/></a:accent6><a:hlink><a:srgbClr val="E2A15A"/></a:hlink><a:folHlink><a:srgbClr val="A8B7AE"/></a:folHlink></a:clrScheme><a:fontScheme name="RRE"><a:majorFont><a:latin typeface="Georgia"/></a:majorFont><a:minorFont><a:latin typeface="Georgia"/></a:minorFont></a:fontScheme><a:fmtScheme name="RRE"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>"""
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as deck:
        deck.writestr("[Content_Types].xml", content_types)
        deck.writestr("_rels/.rels", rels)
        deck.writestr("ppt/presentation.xml", presentation)
        deck.writestr("ppt/_rels/presentation.xml.rels", presentation_rels)
        deck.writestr("ppt/slides/slide1.xml", slide)
        deck.writestr("ppt/slideMasters/slideMaster1.xml", master)
        deck.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", master_rels)
        deck.writestr("ppt/slideLayouts/slideLayout1.xml", layout)
        deck.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", layout_rels)
        deck.writestr("ppt/theme/theme1.xml", theme)


def main() -> None:
    sales = {}
    for company in COMPANIES:
        slug = {
            "EMP01": "EMP01_Aceros_del_Sur",
            "EMP02": "EMP02_Distribuidora_Metro",
            "EMP03": "EMP03_Logistica_CA",
            "EMP04": "EMP04_Aceros_Honduras",
            "EMP05": "EMP05_Ferreteria_Norte",
            "EMP06": "EMP06_Holding_Servicios",
        }[company["id"]]
        folder = OUT / slug
        book = BOOKS[company["id"]]
        budget_months = split(company["budget"])
        prior_months = split(company["prior"])
        internal_budget = split(book["interno"]["budget"])
        internal_prior = split(book["interno"]["prior"])
        budget_weights = [item["budget"] for item in book["externos"]]
        prior_weights = [item["prior"] for item in book["externos"]]
        client_budget = {item["cliente"]: [0] * 12 for item in book["externos"]}
        client_prior = {item["cliente"]: [0] * 12 for item in book["externos"]}
        cost_months = [0] * 12
        expense_months = [0] * 12
        budget_rows = []
        prior_rows = []
        trace = []

        def push(values: list) -> None:
            budget_rows.append(values)
            if values[3] != "Ventas a terceros":
                return
            trace.append({
                "file": f"datos-demo/{slug}/presupuesto_2026.xlsx",
                "row": len(budget_rows) + 1,
                "mes": values[0],
                "cliente": values[2],
                "cuenta": values[3],
                "moneda": values[4],
                "importe": values[5],
                "dentro": values[6] == "SI",
                "motivo": values[7],
            })

        for index, month_name in enumerate(MONTHS):
            month = index + 1
            for item, amount in zip(book["externos"], portions(budget_months[index], budget_weights)):
                client_budget[item["cliente"]][index] = amount
                cost = amount * 60 // 100
                expense = amount * 15 // 100
                cost_months[index] += cost
                expense_months[index] += expense
                push([month, month_name, item["cliente"], "Ventas a terceros", company["currency"], amount, "NO", item["motivo"]])
                push([month, month_name, item["cliente"], "Costo de ventas", company["currency"], cost, "NO", item["motivo"]])
                push([month, month_name, item["cliente"], "Gastos", company["currency"], expense, "NO", item["motivo"]])
            for item, amount in zip(book["externos"], portions(prior_months[index], prior_weights)):
                client_prior[item["cliente"]][index] = amount
                prior_rows.append([month, month_name, item["cliente"], company["currency"], amount, "NO"])
            internal_sale = internal_budget[index]
            push([month, month_name, book["interno"]["cliente"], "Ventas a terceros", company["currency"], internal_sale, "SI", book["interno"]["motivo"]])
            push([month, month_name, book["interno"]["cliente"], "Costo de ventas", company["currency"], internal_sale * 60 // 100, "SI", book["interno"]["motivo"]])
            push([month, month_name, book["interno"]["cliente"], "Gastos", company["currency"], internal_sale * 15 // 100, "SI", book["interno"]["motivo"]])
            prior_rows.append([month, month_name, book["interno"]["cliente"], company["currency"], internal_prior[index], "SI"])
        clients = []
        for item in book["externos"]:
            clients.append({
                "cliente": item["cliente"],
                "dentro": False,
                "motivo": item["motivo"],
                "budget": sum(client_budget[item["cliente"]]),
                "prior": sum(client_prior[item["cliente"]]),
            })
        clients.append({
            "cliente": book["interno"]["cliente"],
            "dentro": True,
            "motivo": book["interno"]["motivo"],
            "budget": sum(internal_budget),
            "prior": sum(internal_prior),
        })
        sales[company["id"]] = {
            "currency": company["currency"],
            "budget": budget_months,
            "prior": prior_months,
            "cost": cost_months,
            "expense": expense_months,
            "removedCount": 12,
            "removedAmount": sum(internal_budget),
            "clients": clients,
            "lines": trace,
            "assumptions": ASSUMPTIONS[company["id"]],
        }
        headers_b = ["mes", "nombre_mes", "cliente", "cuenta", "moneda", "importe", "dentro_del_grupo", "motivo"]
        headers_p = ["mes", "nombre_mes", "cliente", "moneda", "importe", "dentro_del_grupo"]
        rates = ASSUMPTIONS[company["id"]]
        supuestos = (
            ["impuesto", "wacc", "capital_empleado", "capital_invertido"],
            [[rates["impuesto"], rates["wacc"], rates["capital_empleado"], rates["capital_invertido"]]],
        )
        write_csv(folder / "presupuesto_2026.csv", headers_b, budget_rows)
        write_xlsx(folder / "presupuesto_2026.xlsx", headers_b, budget_rows, [("Supuestos", *supuestos)])
        write_csv(folder / "ventas_2025.csv", headers_p, prior_rows)
        write_xlsx(folder / "ventas_2025.xlsx", headers_p, prior_rows)

    initiative_rows_js = []
    for item in INITIATIVES:
        rows = [
            [month, MONTHS[month - 1], item["currency"], item["ingreso"][month - 1], item["inversion"][month - 1]]
            for month in range(1, 13)
        ]
        headers = ["mes", "nombre_mes", "moneda", "ingreso_incremental", "inversion"]
        stem = OUT / "iniciativas" / item["ppt"].replace(".pptx", "")
        write_csv(stem.with_suffix(".csv"), headers, rows)
        write_xlsx(stem.with_suffix(".xlsx"), headers, rows)
        company = next(c for c in COMPANIES if c["id"] == item["company"])
        write_pptx(
            stem.with_suffix(".pptx"),
            item["name"],
            f"{company['name']}. El detalle mensual está en el Excel del mismo nombre.",
        )
        initiative_rows_js.append(item)

    payload = {
        "companies": [{k: c[k] for k in ("id", "name", "country", "currency", "role")} for c in COMPANIES],
        "fx": FX,
        "months": MONTHS,
        "sales": sales,
        "initiatives": initiative_rows_js,
        "note": "Cifras ficticias del Grupo Istmo. No son datos de Grupo AG. La venta a una empresa del grupo no entra al número.",
    }
    plantilla = OUT / "plantillas"
    meses = list(enumerate(MONTHS, start=1))
    presupuesto_vacio = []
    for month, name in meses:
        presupuesto_vacio.append([month, name, "Cliente externo", "Ventas a terceros", "GTQ", 0, "NO", ""])
        presupuesto_vacio.append([month, name, "Cliente externo", "Costo de ventas", "GTQ", 0, "NO", ""])
        presupuesto_vacio.append([month, name, "Cliente externo", "Gastos", "GTQ", 0, "NO", ""])
        presupuesto_vacio.append([month, name, "Distribuidora Metro", "Ventas a terceros", "GTQ", 0, "SI", "Venta a otra empresa del grupo. Esta línea no entra."])
    write_xlsx(
        plantilla / "plantilla_presupuesto.xlsx",
        headers_b,
        presupuesto_vacio,
        [("Supuestos", ["impuesto", "wacc", "capital_empleado", "capital_invertido"], [[0.30, 0.10, 1_000_000, 1_000_000]])],
    )
    write_xlsx(
        plantilla / "plantilla_iniciativa.xlsx",
        ["mes", "nombre_mes", "moneda", "ingreso_incremental", "inversion"],
        [[month, name, "USD", 0, 0] for month, name in meses],
    )
    JS.parent.mkdir(parents=True, exist_ok=True)
    JS.write_text("window.RRE_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    (OUT / "LEEME.txt").write_text(
        "\n".join(
            [
                "Datos crudos para la demostración. Cifras ficticias del Grupo Istmo. No son de Grupo AG.",
                "",
                "Cada carpeta EMP0x trae el detalle por cliente y mes:",
                "- presupuesto_2026.xlsx: cliente, cuenta, importe y si el cliente está dentro del grupo.",
                "- ventas_2025.xlsx: a qué cliente se le vendió el año pasado, por mes.",
                "Si dentro_del_grupo dice SI, el cliente es de otra empresa del grupo y esa línea no entra.",
                "La hoja Supuestos trae, de prueba, impuesto 0,30, WACC 0,10 y el capital de cada empresa.",
                "Con eso el portal calcula ROIC, ROCE y EVA. No son cifras reales.",
                "",
                "plantillas/plantilla_presupuesto.xlsx es el archivo vacío para cargar un presupuesto nuevo.",
                "plantillas/plantilla_iniciativa.xlsx es el archivo vacío de una iniciativa.",
                "",
                "La carpeta iniciativas trae, por iniciativa:",
                "- un Excel con ingreso incremental e inversión de cada mes.",
                "- un PowerPoint de una lámina para subir en el portal.",
                "",
                "Tasa oficial a dólares: quetzal 7,75, lempira 25, dólar 1. USD = importe local / tasa.",
                "En el portal, elegí la empresa y subí el Excel de presupuesto o el de la iniciativa.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(f"Listo: {OUT}")


if __name__ == "__main__":
    main()
