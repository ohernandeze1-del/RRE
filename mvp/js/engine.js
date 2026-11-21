/* Motores: consolidar, validar, explicar, valorar, decidir. */
(function () {
  const R = () => window.RRE;

  function company(id) {
    return R().COMPANIES.find((c) => c.id === id);
  }

  function rateFor(currency, when, scenario) {
    if (scenario === "filial" && currency === "HNL") return R().PARAMS.filialHnl;
    const fx = R().FX[currency];
    if (!fx) return null;
    return fx[when];
  }

  function toUsd(amount, currency, when, scenario) {
    const rate = rateFor(currency, when, scenario);
    if (rate == null || rate === 0) return null;
    return Math.round(amount / rate);
  }

  function trace(row) {
    const c = company(row.company);
    return {
      companyId: row.company,
      company: c.name,
      file: row.file,
      line: row.line,
      account: row.account,
      name: row.name,
      currency: row.currency,
      budget: row.budget,
      actual: row.actual,
      prior: row.prior,
      note: row.note,
      raw: row.raw,
      counterparty: row.counterparty
    };
  }

  function duplicateKey(row) {
    return [row.company, row.account, row.currency, row.budget, row.counterparty || "", row.name].join("|");
  }

  function consolidate(scenario) {
    const mode = scenario || "oficial";
    const catalog = R().CATALOG;
    const blocks = [];
    const accepted = [];
    const warnings = [];
    const queue = [];

    if (R().ROWS.some((r) => r.fxMemo)) {
      warnings.push({
        kind: "tasa",
        sentence: "Aceros Honduras escribe una tasa interna de 24,5. El cierre oficial usa 25 lempiras por dólar. La columna local no entra al número."
      });
    }

    R().ROWS.forEach((original) => {
      const c = company(original.company);
      if (String(original.account).startsWith("TOTAL")) {
        const detail = R().ROWS.filter((r) => r.company === original.company && (r.account === "4100" || r.account === "4200"));
        const detailLocal = detail.reduce((s, r) => s + r.budget, 0);
        const gap = original.budget - detailLocal;
        blocks.push({
          kind: "total",
          sentence: c.name + " trae un total de ventas de " + fmtLocal(original.budget, original.currency) + ". El detalle suma " + fmtLocal(detailLocal, original.currency) + ". El total no entra.",
          impactUsd: toUsd(original.budget, original.currency, "budget", mode),
          impactLabel: "ventas de más si alguien suma el total y el detalle",
          trace: trace(original)
        });
        return;
      }
      if (!catalog[original.account]) {
        const usd = toUsd(original.budget, original.currency, "budget", mode);
        blocks.push({
          kind: "catalogo",
          sentence: c.name + " carga la cuenta " + original.account + " (" + original.name + "), que no está en el catálogo. No entra.",
          impactUsd: usd == null ? 0 : Math.abs(usd),
          impactLabel: "gasto que no entra al EBIT",
          trace: trace(original)
        });
        return;
      }
      if (original.currency !== c.currency) {
        blocks.push({
          kind: "moneda",
          sentence: c.name + " carga " + original.name + " en " + original.currency + ". Su moneda es " + c.currency + ". La fila no entra.",
          impactUsd: 0,
          impactLabel: "fila sin conversión",
          trace: trace(original)
        });
        return;
      }
      const sign = catalog[original.account].sign;
      if (sign < 0 && original.budget < 0) {
        const usd = Math.abs(toUsd(original.budget, original.currency, "budget", mode));
        blocks.push({
          kind: "signo",
          sentence: c.name + " trae " + original.name + " con signo negativo (" + fmtLocal(original.budget, original.currency) + "). No entra hasta corregir el signo.",
          impactUsd: usd,
          impactLabel: "giro del EBIT si se acepta el signo invertido",
          trace: trace(original)
        });
        return;
      }
      let row = original;
      if (original.budget < original.prior - 0.5 && !String(original.justification || "").trim()) {
        const proposed = toUsd(original.budget, original.currency, "budget", mode);
        const kept = toUsd(original.prior, original.currency, "budget", mode);
        blocks.push({
          kind: "recorte",
          sentence: c.name + " baja " + original.name + " de " + fmtLocal(original.prior, original.currency) + " a " + fmtLocal(original.budget, original.currency) + " sin decir por qué. El recorte no entra. El número usa el año anterior.",
          impactUsd: Math.abs(kept - proposed),
          impactLabel: "EBIT de más si se acepta el recorte sin razón",
          trace: trace(original)
        });
        row = Object.assign({}, original, {
          budget: original.prior,
          actual: original.prior,
          proposedBudget: original.budget,
          substituted: true
        });
      } else if (original.budget < original.prior - 0.5 && String(original.justification || "").trim()) {
        accepted.push({
          sentence: c.name + " baja " + original.name + " y sí deja la razón: " + original.justification,
          trace: trace(original)
        });
      }
      queue.push(row);
    });

    const seen = new Map();
    const kept = [];
    queue.forEach((row) => {
      const key = duplicateKey(row);
      if (seen.has(key)) {
        const usd = Math.abs(toUsd(row.budget, row.currency, "budget", mode) || 0);
        blocks.push({
          kind: "duplicado",
          sentence: company(row.company).name + " repite " + row.name + " en la fila " + row.line + ". Entra la fila " + seen.get(key) + ". La copia se frena.",
          impactUsd: usd,
          impactLabel: "doble conteo si la copia se suma",
          trace: trace(row)
        });
        return;
      }
      seen.set(key, row.line);
      kept.push(row);
    });

    const enriched = kept.map((row) => {
      const budgetUsd = toUsd(row.budget, row.currency, "budget", mode);
      const actualUsd = toUsd(row.actual, row.currency, "actual", mode);
      const actualAtBudgetFx = toUsd(row.actual, row.currency, "budget", mode);
      return Object.assign({}, row, {
        budgetUsd,
        actualUsd,
        volumeUsd: actualAtBudgetFx - budgetUsd,
        fxUsd: actualUsd - actualAtBudgetFx
      });
    });

    const pnl = enriched.filter((r) => R().CATALOG[r.account].statement === "P&L");
    const bs = enriched.filter((r) => R().CATALOG[r.account].statement === "BS");
    const revs = pnl.filter((r) => r.account === "4200");
    const costs = pnl.filter((r) => r.account === "5200" || r.account === "6200");
    const usedCost = new Set();
    const pairs = [];

    revs.forEach((rev) => {
      const match = costs.find((cost) => {
        if (usedCost.has(cost)) return false;
        if (cost.company !== rev.counterparty) return false;
        if (rev.company !== cost.counterparty) return false;
        return Math.abs(cost.budgetUsd - rev.budgetUsd) < 1;
      });
      if (!match) return;
      usedCost.add(match);
      pairs.push({ rev, cost: match });
      if (rev.ic === false || match.ic === false) {
        warnings.push({
          kind: "marca",
          sentence: company(rev.company).name + " marca " + rev.name + " como si no fuera venta entre empresas. El monto sí calza con " + company(match.company).name + " (" + usd(rev.budgetUsd) + "). Se elimina y queda el aviso.",
          trace: trace(rev)
        });
      }
    });

    const matched = new Set();
    pairs.forEach((p) => {
      matched.add(p.rev);
      matched.add(p.cost);
    });

    const descalces = pnl.filter((r) => (r.account === "4200" || r.account === "5200" || r.account === "6200") && !matched.has(r));
    const descalceSet = new Set(descalces);
    const clean = pnl.filter((r) => !matched.has(r) && !descalceSet.has(r));

    let ebit = 0;
    let revenue = 0;
    let cogs = 0;
    let opex = 0;
    let da = 0;
    clean.forEach((r) => {
      const signed = R().CATALOG[r.account].sign * r.budgetUsd;
      ebit += signed;
      if (r.account === "4100") revenue += r.budgetUsd;
      if (r.account === "5100") cogs += r.budgetUsd;
      if (r.account === "6100") opex += r.budgetUsd;
      if (r.account === "6300") da += r.budgetUsd;
    });

    const sumBs = (code) => bs.filter((r) => r.account === code).reduce((s, r) => s + r.budgetUsd, 0);
    const assets = sumBs("1100");
    const currentLiab = sumBs("2100");
    const debt = sumBs("2200");
    const equity = sumBs("3100");
    const cash = sumBs("1050");
    const capital = equity + debt;
    const capitalAlt = assets - currentLiab;
    const tax = R().PARAMS.tax;
    const wacc = R().PARAMS.wacc;
    const nopat = Math.round(ebit * (1 - tax));
    const eva = Math.round(nopat - capital * wacc);
    const roce = capital ? ebit / capital : 0;
    const roic = capital ? nopat / capital : 0;

    const byCompany = R().COMPANIES.map((c) => {
      const lines = clean.filter((r) => r.company === c.id);
      const ebitC = lines.reduce((s, r) => s + R().CATALOG[r.account].sign * r.budgetUsd, 0);
      const salesC = lines.filter((r) => r.account === "4100").reduce((s, r) => s + r.budgetUsd, 0);
      const equityC = bs.filter((r) => r.company === c.id && r.account === "3100").reduce((s, r) => s + r.budgetUsd, 0);
      const debtC = bs.filter((r) => r.company === c.id && r.account === "2200").reduce((s, r) => s + r.budgetUsd, 0);
      const capitalC = equityC + debtC;
      const nopatC = Math.round(ebitC * (1 - tax));
      return {
        id: c.id,
        name: c.name,
        country: c.country,
        currency: c.currency,
        role: c.role,
        sales: salesC,
        ebit: ebitC,
        capital: capitalC,
        eva: Math.round(nopatC - capitalC * wacc)
      };
    });

    const deviations = clean
      .map((r) => {
        const sign = R().CATALOG[r.account].sign;
        return {
          sentence: r.note || r.name,
          effect: sign * (r.actualUsd - r.budgetUsd),
          volume: sign * r.volumeUsd,
          fx: sign * r.fxUsd,
          trace: trace(r),
          name: r.name,
          company: company(r.company).name
        };
      })
      .filter((d) => Math.abs(d.effect) >= 1000)
      .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));

    const loadedSales = pnl.filter((r) => r.account === "4100" || r.account === "4200").reduce((s, r) => s + r.budgetUsd, 0);
    const icSales = pairs.reduce((s, p) => s + p.rev.budgetUsd, 0);
    const gapSales = descalces.filter((r) => r.account === "4200").reduce((s, r) => s + r.budgetUsd, 0);

    const trusted = clean.reduce((s, r) => s + Math.abs(r.budgetUsd), 0) + pairs.reduce((s, p) => s + Math.abs(p.rev.budgetUsd) + Math.abs(p.cost.budgetUsd), 0);
    const risky = blocks.reduce((s, b) => s + Math.abs(b.impactUsd || 0), 0) + descalces.reduce((s, r) => s + Math.abs(r.budgetUsd), 0);
    const confidence = trusted + risky ? trusted / (trusted + risky) : 1;

    const kpis = [
      { indicator: "ROCE", calculated: roce, formula: "EBIT / capital empleado" },
      { indicator: "ROIC", calculated: roic, formula: "NOPAT / capital invertido" },
      { indicator: "EVA", calculated: eva, formula: "NOPAT − capital × WACC" }
    ].map((item) => {
      const pasted = R().PASTED.find((p) => p.indicator === item.indicator);
      return Object.assign({}, item, { pasted: pasted.value, source: pasted.source, line: pasted.line, origin: pasted.origin });
    });

    return {
      scenario: mode,
      ebit,
      revenue,
      cogs,
      opex,
      da,
      nopat,
      roce,
      roic,
      eva,
      tax,
      wacc,
      assets,
      currentLiab,
      debt,
      equity,
      cash,
      capital,
      capitalAlt,
      confidence,
      loadedSales,
      icSales,
      gapSales,
      cleanSales: revenue,
      pairs,
      descalces,
      blocks,
      warnings,
      accepted,
      deviations,
      byCompany,
      clean,
      kpis,
      rowsRead: R().ROWS.length
    };
  }

  function analyzeInitiative(item, snapshot) {
    const tax = snapshot.tax;
    const wacc = snapshot.wacc;
    const nopat = Math.round(item.annualEbit * (1 - tax));
    const charge = Math.round(item.capex * wacc);
    const eva = nopat - charge;
    const tags = item.tags || [];
    let score = 0;
    if (eva > 0) score += 40;
    else if (item.annualEbit > 0) score += 12;
    if (item.capex <= snapshot.cash * 0.8) score += 20;
    else if (item.capex <= snapshot.cash * 1.5) score += 8;
    if (tags.includes("reciclaje") || tags.includes("sostenibilidad")) score += 15;
    if (tags.includes("gobernanza") || tags.includes("etica")) score += 10;
    if (tags.includes("importacion") || tags.includes("largos")) score += 10;
    let decision = "Detener";
    if (score >= 70 && eva > 0) decision = "Aprobar";
    else if (score >= 45) decision = "Condicionar";
    if (decision === "Aprobar" && item.capex > snapshot.cash) decision = "Condicionar";
    const reasons = [];
    reasons.push(eva > 0 ? "Crea valor: el beneficio después de impuesto cubre el costo del capital." : "No cubre el costo del capital.");
    reasons.push(item.capex <= snapshot.cash ? "La caja del grupo alcanza." : "La caja de hoy no alcanza. Hace falta financiamiento.");
    if (tags.includes("reciclaje") || tags.includes("sostenibilidad")) reasons.push("Alinea con reciclaje y sostenibilidad.");
    if (tags.includes("gobernanza") || tags.includes("etica")) reasons.push("Alinea con gobernanza y ética.");
    if (tags.includes("importacion") || tags.includes("largos")) reasons.push("Ataca producto largo, donde hoy hay importación.");
    if (!item.annualEbit) reasons.push("El archivo no trae un beneficio. Sin beneficio no hay decisión.");
    return { title: item.title, capex: item.capex, annualEbit: item.annualEbit, eva, score, decision, reasons, file: item.file || "Carga de la sala", tags };
  }

  function parseLooseNumber(chunk) {
    if (!chunk) return null;
    const millones = /millon/i.test(chunk);
    let s = chunk.replace(/usd/ig, "").trim();
    s = s.replace(/[^\d.,]/g, "");
    if (!s) return null;
    if (s.includes(".") && s.includes(",")) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if ((s.match(/\./g) || []).length >= 1) {
      const parts = s.split(".");
      if (parts.length > 2 || (parts[1] && parts[1].length === 3)) s = s.replace(/\./g, "");
    } else if (s.includes(",")) {
      const parts = s.split(",");
      if (parts.length > 2 || (parts[1] && parts[1].length === 3)) s = s.replace(/,/g, "");
      else s = s.replace(",", ".");
    }
    let n = Number(s);
    if (!isFinite(n)) return null;
    if (millones && n < 100000) n *= 1000000;
    return Math.round(n);
  }

  function initiativeFromText(text, filename) {
    const capexMatch = text.match(/(?:capex|inversi[oó]n|inversion)\s*[:\-]?\s*([^\n]{0,40})/i);
    const benefitMatch = text.match(/(?:beneficio|ahorro|ebit)\s*[:\-]?\s*([^\n]{0,40})/i);
    const capex = parseLooseNumber(capexMatch ? capexMatch[1] : "");
    const annualEbit = parseLooseNumber(benefitMatch ? benefitMatch[1] : "");
    const tags = [];
    if (/recicl|chatarra|sostenib/i.test(text)) tags.push("reciclaje", "sostenibilidad");
    if (/gobern|étic|etic|cumplim|trazab/i.test(text)) tags.push("gobernanza", "etica");
    if (/import|largo|lamin/i.test(text)) tags.push("importacion", "largos");
    const titleLine = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 8) || filename || "Iniciativa cargada";
    return {
      title: titleLine.replace(/^#+\s*/, "").slice(0, 90),
      capex: capex || 0,
      annualEbit: annualEbit || 0,
      tags: Array.from(new Set(tags)),
      file: filename || "Archivo cargado"
    };
  }

  function selfCheck() {
    const r = consolidate("oficial");
    const errors = [];
    if (r.ebit !== 8950000) errors.push("EBIT " + r.ebit);
    if (r.nopat !== 6712500) errors.push("NOPAT " + r.nopat);
    if (r.capital !== 46620000) errors.push("Capital " + r.capital);
    if (r.capitalAlt !== 46620000) errors.push("Capital activo-pasivo " + r.capitalAlt);
    if (r.eva !== 1817400) errors.push("EVA " + r.eva);
    if (r.pairs.length !== 5) errors.push("Pares " + r.pairs.length);
    if (r.descalces.length !== 1) errors.push("Descalces " + r.descalces.length);
    if (!r.blocks.some((b) => b.kind === "duplicado")) errors.push("Falta duplicado");
    if (!r.blocks.some((b) => b.kind === "recorte")) errors.push("Falta recorte");
    if (!r.blocks.some((b) => b.kind === "total")) errors.push("Falta total");
    if (!r.blocks.some((b) => b.kind === "moneda")) errors.push("Falta moneda");
    if (!r.blocks.some((b) => b.kind === "catalogo")) errors.push("Falta catálogo");
    return { ok: errors.length === 0, errors, result: r };
  }

  function fmtLocal(n, currency) {
    return local(n) + " " + currency;
  }

  function local(n) {
    return Math.round(n).toLocaleString("es-ES");
  }

function usd(n) {
  const sign = n < 0 ? "−" : "";
  return "USD " + sign + Math.abs(Math.round(n)).toLocaleString("es-ES");
}

  function pct(n) {
    return (n * 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  }

  function bitacora(snapshot) {
    const lines = [];
    lines.push("Bitácora de cierre " + R().PARAMS.period);
    lines.push("Escenario: " + (snapshot.scenario === "filial" ? "tasa interna Honduras 24,5" : "tasa oficial"));
    lines.push("EBIT limpio: " + usd(snapshot.ebit));
    lines.push("NOPAT: " + usd(snapshot.nopat));
    lines.push("ROCE: " + pct(snapshot.roce));
    lines.push("ROIC: " + pct(snapshot.roic));
    lines.push("EVA: " + usd(snapshot.eva));
    lines.push("Capital: " + usd(snapshot.capital));
    lines.push("");
    lines.push("Eliminaciones");
    snapshot.pairs.forEach((p) => {
      lines.push("- " + company(p.rev.company).name + " fila " + p.rev.line + " con " + company(p.cost.company).name + " fila " + p.cost.line + " por " + usd(p.rev.budgetUsd));
    });
    lines.push("");
    lines.push("Fuera del número");
    snapshot.blocks.forEach((b) => lines.push("- " + b.sentence + " (" + b.trace.file + " fila " + b.trace.line + ")"));
    snapshot.descalces.forEach((d) => lines.push("- Descalce: " + company(d.company).name + " fila " + d.line + " " + usd(d.budgetUsd)));
    return lines.join("\n");
  }

  window.RRE.consolidate = consolidate;
  window.RRE.analyzeInitiative = analyzeInitiative;
  window.RRE.initiativeFromText = initiativeFromText;
  window.RRE.selfCheck = selfCheck;
  window.RRE.usd = usd;
  window.RRE.pct = pct;
  window.RRE.local = local;
  window.RRE.bitacora = bitacora;
})();
