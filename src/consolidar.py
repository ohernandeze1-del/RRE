"""Consolida el presupuesto del grupo.

Lee data/ y escribe salida/informe.html y salida/lineas.csv.
No abre data/clave_equipo.csv.
"""

from __future__ import annotations

import csv
import html
import sys
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "salida"
BUDGET_FILE = "budget_lines.csv"

PL_SIGN = {
    "REV_EXT": Decimal(1),
    "REV_IC": Decimal(1),
    "COGS_EXT": Decimal(-1),
    "COGS_IC": Decimal(-1),
    "OPEX": Decimal(-1),
}
BS_ACCOUNTS = ("ASSET", "LIAB_CURRENT", "EQUITY", "DEBT")
BS_LABEL = {
    "ASSET": "Activo",
    "LIAB_CURRENT": "Pasivo corriente",
    "EQUITY": "Patrimonio",
    "DEBT": "Deuda financiera",
}


@dataclass
class Line:
    row: int
    company_id: str
    account_code: str
    account_name: str
    currency: str
    amount: Decimal
    counterparty_id: str
    period: str
    detalle: str
    usd: Decimal | None = None
    status: str = ""
    reason: str = ""

    @property
    def file(self) -> str:
        return BUDGET_FILE

    def contribution(self) -> Decimal:
        if self.usd is None or self.account_code not in PL_SIGN:
            return Decimal(0)
        return self.usd * PL_SIGN[self.account_code]


def read_csv(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def money(value: Decimal) -> str:
    rounded = value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    number = int(rounded)
    sign = "-" if number < 0 else ""
    body = f"{abs(number):,}".replace(",", ".")
    return f"{sign}{body}"


def pct(value: Decimal) -> str:
    points = (value * Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if points == points.to_integral():
        return f"{int(points)}%"
    return f"{points}%"


def load_lines() -> list[Line]:
    lines: list[Line] = []
    for index, raw in enumerate(read_csv(BUDGET_FILE), start=2):
        amount_text = (raw.get("amount") or "").strip()
        try:
            amount = Decimal(amount_text)
        except Exception:
            amount = Decimal(0)
            raw["_bad_amount"] = amount_text
        line = Line(
            row=index,
            company_id=(raw.get("company_id") or "").strip(),
            account_code=(raw.get("account_code") or "").strip(),
            account_name=(raw.get("account_name") or "").strip(),
            currency=(raw.get("currency") or "").strip(),
            amount=amount,
            counterparty_id=(raw.get("counterparty_id") or "").strip(),
            period=(raw.get("period") or "").strip(),
            detalle=(raw.get("detalle") or "").strip(),
        )
        if "_bad_amount" in raw:
            line.status = "frenada"
            line.reason = f"El importe no es un número ({raw['_bad_amount']})"
        lines.append(line)
    return lines


def detail_code(total_code: str) -> str:
    if total_code == "TOTAL_REV":
        return "REV_EXT"
    return total_code.removeprefix("TOTAL_")


def classify(lines: list[Line]) -> dict:
    companies = {row["company_id"]: row for row in read_csv("companies.csv")}
    rates = {
        row["currency"]: Decimal(row["usd_per_unit"]) for row in read_csv("fx_rates.csv")
    }
    assumptions = {row["key"]: row["value"] for row in read_csv("assumptions.csv")}
    names = {
        key: row["company_name"] for key, row in companies.items()
    }

    entered: list[Line] = []
    stopped: list[Line] = []
    controls: list[Line] = []
    totals: list[Line] = []
    seen: dict[tuple, int] = {}

    for line in lines:
        if line.status == "frenada":
            stopped.append(line)
            continue
        company = companies.get(line.company_id)
        if company is None:
            line.status = "frenada"
            line.reason = "La empresa no está en el padrón del grupo"
            stopped.append(line)
            continue
        home = company["functional_currency"]
        if line.currency != home:
            line.status = "frenada"
            line.reason = (
                f"La fila está en {line.currency} y {names[line.company_id]} "
                f"presupuesta en {home}"
            )
            stopped.append(line)
            continue
        rate = rates.get(line.currency)
        if rate is None:
            line.status = "frenada"
            line.reason = f"No hay tasa oficial para {line.currency}"
            stopped.append(line)
            continue
        line.usd = line.amount * rate
        key = (
            line.company_id,
            line.account_code,
            line.currency,
            line.amount,
            line.counterparty_id,
            line.period,
            line.detalle,
        )
        if key in seen:
            line.status = "frenada"
            line.reason = f"Repite la fila {seen[key]}"
            stopped.append(line)
            continue
        seen[key] = line.row
        if line.account_code.startswith("TOTAL_"):
            totals.append(line)
            continue
        entered.append(line)

    for total in totals:
        code = detail_code(total.account_code)
        detail = [
            line
            for line in entered
            if line.company_id == total.company_id
            and line.account_code == code
            and line.currency == total.currency
        ]
        detail_sum = sum((line.amount for line in detail), Decimal(0))
        rows = ", ".join(str(line.row) for line in detail) or "ninguna"
        detail_name = detail[0].account_name.lower() if detail else code
        if detail_sum != total.amount:
            total.status = "frenada"
            total.reason = (
                f"El total dice {money(total.amount)} {total.currency} "
                f"y las {detail_name} (filas {rows}) suman {money(detail_sum)} {total.currency}"
            )
            stopped.append(total)
        else:
            total.status = "control"
            total.reason = (
                f"Cuadra con las {detail_name} (filas {rows}) y no se suma otra vez"
            )
            controls.append(total)

    revenues = [line for line in entered if line.account_code == "REV_IC"]
    costs = [line for line in entered if line.account_code == "COGS_IC"]
    used: set[int] = set()
    pairs: list[tuple[Line, Line]] = []
    gaps: list[Line] = []

    for revenue in revenues:
        match = next(
            (
                cost
                for cost in costs
                if id(cost) not in used
                and cost.company_id == revenue.counterparty_id
                and cost.counterparty_id == revenue.company_id
                and cost.usd == revenue.usd
            ),
            None,
        )
        if match is None:
            revenue.status = "descalce"
            other = names.get(revenue.counterparty_id, revenue.counterparty_id or "nadie")
            revenue.reason = (
                f"{names[revenue.company_id]} le vende {money(revenue.usd)} USD a {other} "
                f"y no aparece la compra del otro lado"
            )
            gaps.append(revenue)
            continue
        used.add(id(revenue))
        used.add(id(match))
        revenue.status = "eliminada"
        match.status = "eliminada"
        revenue.reason = f"Se anula con la compra de la fila {match.row}"
        match.reason = f"Se anula con la venta de la fila {revenue.row}"
        pairs.append((revenue, match))

    for cost in costs:
        if id(cost) in used:
            continue
        cost.status = "descalce"
        other = names.get(cost.counterparty_id, cost.counterparty_id or "nadie")
        cost.reason = (
            f"{names[cost.company_id]} registra una compra a {other} "
            f"por {money(cost.usd)} USD y no aparece la venta del otro lado"
        )
        gaps.append(cost)

    clean: list[Line] = []
    for line in entered:
        if line.account_code in BS_ACCOUNTS:
            line.status = "balance"
            line.reason = "Entra al balance del grupo"
            continue
        if line.account_code not in PL_SIGN or line.status in {"eliminada", "descalce"}:
            continue
        line.status = "entra"
        line.reason = "Entra al EBIT del grupo"
        clean.append(line)

    ebit = sum((line.contribution() for line in clean), Decimal(0))
    before = ebit + sum((line.contribution() for line in gaps), Decimal(0))
    before += sum(
        (left.contribution() + right.contribution() for left, right in pairs),
        Decimal(0),
    )

    balance = {
        account: sum(
            (line.usd or Decimal(0) for line in entered if line.account_code == account),
            Decimal(0),
        )
        for account in BS_ACCOUNTS
    }
    tax = Decimal(assumptions["tax_rate"])
    wacc = Decimal(assumptions["wacc"])
    nopat = ebit * (Decimal(1) - tax)
    capital_employed = balance["ASSET"] - balance["LIAB_CURRENT"]
    invested = balance["EQUITY"] + balance["DEBT"]
    roce = ebit / capital_employed
    roic = nopat / invested
    eva = nopat - invested * wacc

    pasted = {row["indicator"]: row for row in read_csv("pasted_indicators.csv")}
    calculated = {
        "ROIC": (roic, "ratio"),
        "ROCE": (roce, "ratio"),
        "EVA": (eva, "USD"),
    }

    return {
        "names": names,
        "assumptions": assumptions,
        "rates": rates,
        "clean": clean,
        "stopped": stopped,
        "controls": controls,
        "pairs": pairs,
        "gaps": gaps,
        "entered": entered,
        "ebit": ebit,
        "before": before,
        "balance": balance,
        "tax": tax,
        "wacc": wacc,
        "nopat": nopat,
        "capital_employed": capital_employed,
        "invested": invested,
        "roce": roce,
        "roic": roic,
        "eva": eva,
        "pasted": pasted,
        "calculated": calculated,
    }


def write_trace(lines: list[Line], names: dict[str, str]) -> None:
    path = OUT / "lineas.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "archivo",
                "fila",
                "empresa",
                "cuenta",
                "detalle",
                "estado",
                "motivo",
                "moneda",
                "importe",
                "usd",
                "aporte_ebit_usd",
            ]
        )
        for line in lines:
            writer.writerow(
                [
                    line.file,
                    line.row,
                    names.get(line.company_id, line.company_id),
                    line.account_code,
                    line.detalle,
                    line.status,
                    line.reason,
                    line.currency,
                    line.amount,
                    "" if line.usd is None else line.usd,
                    line.contribution() if line.status == "entra" else "",
                ]
            )


def esc(value: object) -> str:
    return html.escape(str(value))


def row_cells(line: Line, names: dict[str, str], show_contribution: bool) -> str:
    contribution = ""
    if show_contribution:
        contribution = f"<td>{esc(money(line.contribution()))}</td>"
    usd = "" if line.usd is None else money(line.usd)
    return (
        "<tr>"
        f"<td>{esc(names.get(line.company_id, line.company_id))}</td>"
        f"<td>{esc(line.account_name)}</td>"
        f"<td>{esc(line.detalle)}</td>"
        f"<td>{esc(money(line.amount))} {esc(line.currency)}</td>"
        f"<td>{esc(usd)}</td>"
        f"{contribution}"
        f"<td>{esc(line.file)} fila {line.row}</td>"
        f"<td>{esc(line.reason)}</td>"
        "</tr>"
    )


def table(headers: list[str], body: str) -> str:
    head = "".join(f"<th>{esc(header)}</th>" for header in headers)
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def write_html(result: dict) -> None:
    names = result["names"]
    headers = ["Empresa", "Cuenta", "Detalle", "Importe", "USD", "Aporte al EBIT", "Origen", "Por qué"]
    clean_body = "".join(
        row_cells(line, names, True) for line in result["clean"]
    )
    stopped_body = "".join(
        row_cells(line, names, False) for line in result["stopped"]
    )
    gap_body = "".join(row_cells(line, names, True) for line in result["gaps"])
    pair_rows = []
    for left, right in result["pairs"]:
        pair_rows.append(row_cells(left, names, True))
        pair_rows.append(row_cells(right, names, True))
    pair_body = "".join(pair_rows)

    balance_blocks = []
    for account in BS_ACCOUNTS:
        lines = [line for line in result["entered"] if line.account_code == account]
        body = "".join(row_cells(line, names, False) for line in lines)
        balance_blocks.append(
            f"<h3>{esc(BS_LABEL[account])}: {esc(money(result['balance'][account]))} USD</h3>"
            + table(
                ["Empresa", "Cuenta", "Detalle", "Importe", "USD", "Origen", "Por qué"],
                body,
            )
        )

    indicator_rows = []
    for key in ("ROCE", "ROIC", "EVA"):
        value, unit = result["calculated"][key]
        shown = pct(value) if unit == "ratio" else f"{money(value)} USD"
        pasted_row = result["pasted"][key]
        pasted_value = Decimal(pasted_row["pasted_value"])
        pasted_shown = (
            pct(pasted_value) if pasted_row["unit"] == "ratio" else f"{money(pasted_value)} USD"
        )
        indicator_rows.append(
            "<tr>"
            f"<td>{esc(key)}</td>"
            f"<td>{esc(shown)}</td>"
            f"<td>{esc(pasted_shown)}</td>"
            f"<td>data/pasted_indicators.csv</td>"
            "</tr>"
        )

    rates = result["rates"]
    rate_text = ", ".join(
        f"1 {currency} = {rate} USD" for currency, rate in rates.items()
    )
    mirror_usd = sum((left.usd or Decimal(0) for left, _right in result["pairs"]), Decimal(0))
    gap_usd = sum((line.contribution() for line in result["gaps"]), Decimal(0))

    document = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Grupo — {esc(money(result["ebit"]))} USD</title>
<style>
body {{ margin: 32px auto; max-width: 1100px; padding: 0 20px; color: #1c1915; background: #f7f4ee; font: 16px/1.45 Georgia, serif; }}
h1 {{ font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0; }}
.numero {{ font-size: 64px; line-height: 1; margin: 8px 0; }}
.unidad {{ font-size: 20px; }}
table {{ width: 100%; border-collapse: collapse; background: white; margin: 8px 0 28px; }}
th, td {{ border-bottom: 1px solid #ddd4c6; text-align: left; padding: 7px 8px; vertical-align: top; font-size: 14px; }}
th {{ font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }}
.paso {{ background: white; padding: 10px 14px; margin: 8px 0; }}
</style>
</head>
<body>
<h1>Presupuesto del grupo, {esc(result["assumptions"]["period"])}</h1>
<p class="numero">{esc(money(result["ebit"]))} <span class="unidad">USD de EBIT</span></p>
<p>Cada fila de abajo dice el archivo y el número de línea que la originó. Tasa oficial: {esc(rate_text)}. Impuesto {esc(pct(result["tax"]))}. WACC {esc(pct(result["wacc"]))}.</p>

<h2>Cómo se llega al número</h2>
<div class="paso">Filas válidas del resultado, todavía con las ventas entre empresas: <strong>{esc(money(result["before"]))} USD</strong>.</div>
<div class="paso">Ventas con espejo: se anulan {esc(money(mirror_usd))} USD de ingreso y el mismo costo. El EBIT no se mueve.</div>
<div class="paso">Sin espejo, fuera del número: <strong>{esc(money(gap_usd))} USD</strong>.</div>
<div class="paso">EBIT del grupo: <strong>{esc(money(result["ebit"]))} USD</strong>.</div>

<h2>Filas que arman el EBIT</h2>
{table(headers, clean_body)}

<h2>Ventas entre empresas que se anulan</h2>
{table(headers, pair_body)}

<h2>Venta sin espejo</h2>
{table(headers, gap_body)}

<h2>Filas que no entran</h2>
{table(["Empresa", "Cuenta", "Detalle", "Importe", "USD", "Origen", "Por qué"], stopped_body)}

<h2>Balance que alimenta ROCE, ROIC y EVA</h2>
{"".join(balance_blocks)}
<p>Capital empleado = activo − pasivo corriente = <strong>{esc(money(result["capital_employed"]))} USD</strong>.</p>
<p>Capital invertido = patrimonio + deuda financiera = <strong>{esc(money(result["invested"]))} USD</strong>.</p>
<p>NOPAT = EBIT × (1 − impuesto) = {esc(money(result["ebit"]))} × (1 − {esc(pct(result["tax"]))}) = <strong>{esc(money(result["nopat"]))} USD</strong>.</p>
<p>ROCE = EBIT / capital empleado = {esc(money(result["ebit"]))} / {esc(money(result["capital_employed"]))} = <strong>{esc(pct(result["roce"]))}</strong>.</p>
<p>ROIC = NOPAT / capital invertido = {esc(money(result["nopat"]))} / {esc(money(result["invested"]))} = <strong>{esc(pct(result["roic"]))}</strong>.</p>
<p>EVA = NOPAT − (capital invertido × WACC) = {esc(money(result["nopat"]))} − ({esc(money(result["invested"]))} × {esc(pct(result["wacc"]))}) = <strong>{esc(money(result["eva"]))} USD</strong>.</p>

<h2>Lo calculado al lado de lo pegado a mano</h2>
{table(["Indicador", "Calculado", "Pegado a mano", "Origen del pegado"], "".join(indicator_rows))}
</body>
</html>
"""
    (OUT / "informe.html").write_text(document, encoding="utf-8")


def print_summary(result: dict) -> None:
    print(f"EBIT del grupo: {money(result['ebit'])} USD")
    print(f"NOPAT: {money(result['nopat'])} USD")
    print(f"ROCE: {pct(result['roce'])}")
    print(f"ROIC: {pct(result['roic'])}")
    print(f"EVA: {money(result['eva'])} USD")
    print(f"Filas frenadas: {len(result['stopped'])}")
    for line in result["stopped"]:
        print(f"  fila {line.row}: {line.reason}")
    print(f"Descalces: {len(result['gaps'])}")
    for line in result["gaps"]:
        print(f"  fila {line.row}: {line.reason}")
    print(f"Informe: {OUT / 'informe.html'}")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    OUT.mkdir(exist_ok=True)
    lines = load_lines()
    result = classify(lines)
    write_trace(lines, result["names"])
    write_html(result)
    print_summary(result)


if __name__ == "__main__":
    main()
