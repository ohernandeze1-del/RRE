(function () {
  const DATA = window.RRE_DATA;
  const STORE = "rre-portales-v2";
  const pptUrls = {};

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE)) || { budgets: {}, initiatives: [] };
    } catch (error) {
      return { budgets: {}, initiatives: [] };
    }
  }

  function saveStore(state) {
    localStorage.setItem(STORE, JSON.stringify(state));
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function money(value) {
    const rounded = Math.round(Number(value) || 0);
    const sign = rounded < 0 ? "-" : "";
    const body = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return sign + body;
  }

  function pct(value) {
    if (!isFinite(value)) return "—";
    const shown = (value * 100).toLocaleString("es-GT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return (value > 0 ? "+" : "") + shown + "%";
  }

  function company(id) {
    return DATA.companies.find((item) => item.id === id);
  }

  function budgetOf(id) {
    const custom = loadStore().budgets[id];
    if (custom && Array.isArray(custom.months) && custom.months.length === 12) return custom.months.map(Number);
    return DATA.sales[id].budget.slice();
  }

  function detailOf(id) {
    const custom = loadStore().budgets[id];
    const seeded = DATA.sales[id];
    if (custom && Array.isArray(custom.months)) {
      const rates = custom.assumptions;
      const usable = rates && rates.impuesto != null && rates.wacc != null && rates.capital_empleado > 0 && rates.capital_invertido > 0;
      return Object.assign({}, custom, { assumptions: usable ? rates : seeded.assumptions });
    }
    return {
      months: seeded.budget.slice(),
      cost: seeded.cost.slice(),
      expense: seeded.expense.slice(),
      clients: seeded.clients,
      removedCount: seeded.removedCount,
      removedAmount: seeded.removedAmount,
      lines: seeded.lines || [],
      assumptions: seeded.assumptions || null
    };
  }

  const COLORS = ["#f4e7c3", "#d4b06a", "#8ea4c8", "#a8843d", "#c47b4a", "#9bb0c9"];

  function colorOf(id) {
    const index = DATA.companies.findIndex((item) => item.id === id);
    return COLORS[index] || COLORS[0];
  }

  function isInternalClient(name, flag) {
    const mark = String(flag || "").trim().toLowerCase();
    if (["si", "sí", "yes", "1", "true"].includes(mark)) return true;
    const value = String(name || "").trim().toLowerCase();
    if (!value) return false;
    return DATA.companies.some((item) => item.id.toLowerCase() === value || item.name.toLowerCase() === value);
  }

  function amountOf(value) {
    const number = Number(String(value).replace(/,/g, ""));
    return isFinite(number) ? number : 0;
  }

  function accountKind(account) {
    const text = String(account || "");
    if (/costo/i.test(text)) return "costo";
    if (/gasto/i.test(text)) return "gasto";
    if (/venta/i.test(text)) return "venta";
    return "";
  }

  function parseBudget(rows, companyId, fileName, assumptions) {
    const companyCurrency = company(companyId).currency;
    const findings = [];
    const seen = new Set();
    const prepared = [];
    rows.forEach((raw) => {
      const row = normalizeRow(raw);
      const excelRow = Number(row.__row) || prepared.length + 2;
      const cliente = String(row.cliente || "").trim();
      const account = String(row.cuenta || "").trim();
      const kind = accountKind(account);
      const month = Number(row.mes);
      const rawAmount = row.importe;
      const amount = amountOf(rawAmount);
      const currency = String(row.moneda || "").trim().toUpperCase();
      const monthName = String(row.nombre_mes || "").trim();
      const flagged = ["si", "sí", "yes", "1", "true"].includes(String(row.dentro_del_grupo || "").trim().toLowerCase());
      const namedInternal = isInternalClient(cliente, "");
      const issues = [];
      if (!cliente) issues.push("no trae cliente");
      if (!month || month < 1 || month > 12) issues.push("el mes no está entre 1 y 12");
      if (String(rawAmount).trim() === "" || !isFinite(Number(String(rawAmount).replace(/,/g, "")))) issues.push("el importe no es un número");
      else if (amount < 0) issues.push("el importe es negativo");
      if (!currency || !DATA.fx[currency]) issues.push("la moneda no es GTQ, HNL ni USD");
      else if (currency !== companyCurrency) issues.push(`la moneda es ${currency} y la empresa trabaja en ${companyCurrency}`);
      if (!account) issues.push("no trae cuenta");
      else if (!kind) issues.push(`la cuenta "${account}" no es ventas, costo ni gastos`);
      if (issues.length) {
        findings.push({ level: "error", row: excelRow, text: `Fila ${excelRow}: ${issues.join("; ")}. Esa fila no entra.` });
        return;
      }
      const dentro = flagged || namedInternal;
      if (kind === "venta" && namedInternal) findings.push({ level: "aviso", row: excelRow, text: `Fila ${excelRow}: ${cliente} es una empresa del grupo. Esa venta no entra.` });
      else if (kind === "venta" && flagged) findings.push({ level: "aviso", row: excelRow, text: `Fila ${excelRow}: ${cliente} está marcado como intercompany. Esa venta no entra.` });
      if (monthName && monthName.toLowerCase() !== String(DATA.months[month - 1]).toLowerCase()) {
        findings.push({ level: "aviso", row: excelRow, text: `Fila ${excelRow}: el mes ${month} no coincide con "${monthName}".` });
      }
      const key = `${month}|${cliente.toLowerCase()}|${kind}|${amount}`;
      if (seen.has(key)) {
        findings.push({ level: "aviso", row: excelRow, text: `Fila ${excelRow}: está repetida. Entra la primera y esta se frena.` });
        return;
      }
      seen.add(key);
      prepared.push({
        month, amount, account, kind, cliente, dentro, currency,
        motivo: row.motivo ? String(row.motivo) : "",
        row: excelRow
      });
    });
    const salesClients = new Set(prepared.filter((line) => line.kind === "venta" && !line.dentro).map((line) => line.cliente.toLowerCase()));
    prepared.forEach((line) => {
      if (line.dentro || line.kind === "venta") return;
      if (!salesClients.has(line.cliente.toLowerCase())) {
        findings.push({ level: "aviso", row: line.row, text: `Fila ${line.row}: ${line.cliente} tiene ${line.kind} y no tiene ventas. No entra.` });
        line.skip = true;
      }
    });
    const clients = new Map();
    const months = Array(12).fill(0);
    const cost = Array(12).fill(0);
    const expense = Array(12).fill(0);
    const trace = [];
    let removedCount = 0;
    let removedAmount = 0;
    let used = 0;
    prepared.forEach((line) => {
      if (!clients.has(line.cliente.toLowerCase())) clients.set(line.cliente.toLowerCase(), { cliente: line.cliente, dentro: false, motivo: "", budget: 0 });
      const entry = clients.get(line.cliente.toLowerCase());
      entry.dentro = entry.dentro || line.dentro;
      if (line.motivo) entry.motivo = line.motivo;
      const entra = !line.dentro && !line.skip;
      if (line.kind === "venta") {
        used += 1;
        entry.budget += line.amount;
        trace.push({
          file: fileName,
          row: line.row,
          mes: line.month,
          cliente: line.cliente,
          cuenta: line.account,
          moneda: line.currency,
          importe: line.amount,
          dentro: line.dentro,
          motivo: line.motivo
        });
        if (line.dentro) {
          removedCount += 1;
          removedAmount += line.amount;
        } else months[line.month - 1] += line.amount;
      } else if (entra && line.kind === "costo") cost[line.month - 1] += line.amount;
      else if (entra && line.kind === "gasto") expense[line.month - 1] += line.amount;
    });
    if (!used) throw new Error("No encontré filas de ventas. La columna cuenta tiene que decir Ventas y tiene que venir el cliente.");
    const rates = assumptions || { impuesto: null, wacc: null, capital_empleado: null, capital_invertido: null };
    const missingRates = ["impuesto", "wacc", "capital_empleado", "capital_invertido"].filter((key) => rates[key] == null || rates[key] === "");
    if (missingRates.length) findings.push({ level: "aviso", row: "", text: `Faltan en la hoja Supuestos: ${missingRates.join(", ")}. Sin eso no hay ROIC, ROCE ni EVA.` });
    return {
      months, cost, expense,
      clients: Array.from(clients.values()),
      removedCount, removedAmount,
      lines: trace,
      assumptions: rates,
      findings
    };
  }

  function explainRows(id) {
    const seeded = DATA.sales[id].clients;
    const custom = loadStore().budgets[id];
    const priorBy = new Map(seeded.map((item) => [item.cliente.toLowerCase(), item]));
    if (!custom || !custom.clients) return seeded.map((item) => Object.assign({}, item));
    const seen = new Set();
    const rows = custom.clients.map((item) => {
      seen.add(item.cliente.toLowerCase());
      const old = priorBy.get(item.cliente.toLowerCase());
      return {
        cliente: item.cliente,
        dentro: item.dentro,
        motivo: item.motivo || (old ? old.motivo : ""),
        prior: old && !item.dentro ? old.prior : (old && item.dentro ? old.prior : 0),
        budget: item.budget
      };
    });
    seeded.forEach((item) => {
      if (item.dentro || seen.has(item.cliente.toLowerCase())) return;
      rows.push({ cliente: item.cliente, dentro: false, motivo: "", prior: item.prior, budget: 0, dropped: true });
    });
    return rows;
  }

  function whyText(row) {
    if (row.dentro) return row.motivo || "No entra. El cliente está dentro del grupo, así que esta venta no pasa.";
    if (row.dropped || (row.budget === 0 && row.prior > 0)) return "Ya no está en el presupuesto. El año pasado sí se le vendía.";
    if (row.prior === 0 && row.budget > 0) return row.motivo || "Cliente nuevo. No tenía ventas el año pasado.";
    if (row.budget > row.prior) return row.motivo || "El presupuesto de este cliente supera lo vendido el año pasado.";
    if (row.budget < row.prior) return row.motivo || "El presupuesto de este cliente queda por debajo del año pasado.";
    return row.motivo || "Queda igual que el año pasado.";
  }

  function explainTable(ids) {
    const body = ids.map((id) => {
      const item = company(id);
      return explainRows(id).map((row) => {
        const delta = row.dentro ? 0 : row.budget - row.prior;
        const change = row.dentro ? "No entra" : money(delta);
        return `<tr><td>${esc(item.name)}</td><td>${esc(row.cliente)}</td><td>${money(row.prior)}</td><td>${money(row.budget)}</td><td class="${row.dentro ? "" : delta < 0 ? "down" : "up"}">${change}</td><td>${esc(whyText(row))}</td></tr>`;
      }).join("");
    }).join("");
    return `<div class="sheet explain"><table><thead><tr><th>Empresa</th><th>Cliente</th><th>2025</th><th>2026</th><th>Cambio</th><th>Por qué</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function ebitOf(id) {
    const detail = detailOf(id);
    const sales = sum(detail.months);
    const cost = sum(detail.cost || []);
    const expense = sum(detail.expense || []);
    if (sales && !cost && !expense) return null;
    return sales - cost - expense;
  }

  function returnsOf(id) {
    const ebit = ebitOf(id);
    const rates = detailOf(id).assumptions;
    const ready = ebit != null && rates && rates.impuesto != null && rates.wacc != null && rates.capital_empleado > 0 && rates.capital_invertido > 0;
    if (!ready) return { ebit, ready: false };
    const nopat = ebit * (1 - rates.impuesto);
    return {
      ebit,
      ready: true,
      nopat,
      roce: ebit / rates.capital_empleado,
      roic: nopat / rates.capital_invertido,
      eva: nopat - rates.capital_invertido * rates.wacc
    };
  }

  function ratios(result, currency) {
    const figure = result.ebit == null ? "—" : `${money(result.ebit)} ${esc(currency)}`;
    const roce = result.ready ? pct(result.roce).replace("+", "") : "—";
    const roic = result.ready ? pct(result.roic).replace("+", "") : "—";
    const eva = result.ready ? `${money(result.eva)} ${esc(currency)}` : "—";
    const note = result.ready
      ? `NOPAT = EBIT × (1 − impuesto). ROCE = EBIT / capital empleado. ROIC = NOPAT / capital invertido. EVA = NOPAT − capital invertido × WACC.`
      : "El EBIT sale de las ventas que pasan, menos costo, menos gastos. ROIC, ROCE y EVA piden, en la hoja Supuestos, impuesto, wacc, capital_empleado y capital_invertido. Esos cuatro datos no están en las filas de venta.";
    return `<section><h2>Resultado y retornos</h2><dl class="ledger"><div><dt>EBIT estimado</dt><dd>${figure}</dd></div><div><dt>ROIC</dt><dd>${roic}</dd></div><div><dt>ROCE</dt><dd>${roce}</dd></div><div><dt>EVA</dt><dd>${eva}</dd></div></dl><p class="note">${note}</p></section>`;
  }

  function priorOf(id) {
    return DATA.sales[id].prior.slice();
  }

  function toUsd(amount, currency) {
    return amount / DATA.fx[currency];
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function initiativesOf(id) {
    const state = loadStore();
    const edits = state.edits || {};
    const base = DATA.initiatives.map((item) => Object.assign({}, item, edits[item.id] || {}));
    const extra = state.initiatives || [];
    return base.concat(extra).filter((item) => !id || item.company === id);
  }

  function saveInitiative(itemId, patch) {
    const state = loadStore();
    const extra = (state.initiatives || []).find((item) => item.id === itemId);
    if (extra) Object.assign(extra, patch);
    else {
      state.edits = state.edits || {};
      state.edits[itemId] = Object.assign({}, state.edits[itemId] || {}, patch);
    }
    saveStore(state);
  }

  function rememberPpt(itemId, file) {
    if (!file) return "";
    if (pptUrls[itemId]) URL.revokeObjectURL(pptUrls[itemId]);
    pptUrls[itemId] = URL.createObjectURL(file);
    return file.name;
  }

  function pptHref(item) {
    if (pptUrls[item.id]) return pptUrls[item.id];
    if (item.ppt && !item.uploaded) return `../datos-demo/iniciativas/${item.ppt}`;
    return "";
  }

  function seriesUsd(ids) {
    const budget = Array(12).fill(0);
    const prior = Array(12).fill(0);
    ids.forEach((id) => {
      const currency = DATA.sales[id].currency;
      budgetOf(id).forEach((value, index) => { budget[index] += toUsd(value, currency); });
      priorOf(id).forEach((value, index) => { prior[index] += toUsd(value, currency); });
    });
    return { budget, prior };
  }

  function incrementalUsd(list) {
    const values = Array(12).fill(0);
    list.forEach((item) => {
      item.ingreso.forEach((value, index) => {
        values[index] += toUsd(value, item.currency || "USD");
      });
    });
    return values;
  }

  function incrementalLocal(list, currency) {
    return incrementalUsd(list).map((value) => value * DATA.fx[currency]);
  }

  function readInitiativeRows(rows) {
    const ingreso = Array(12).fill(0);
    const inversion = Array(12).fill(0);
    let currency = "USD";
    let used = 0;
    rows.forEach((raw) => {
      const row = normalizeRow(raw);
      const month = Number(row.mes);
      if (month < 1 || month > 12) return;
      ingreso[month - 1] += Number(row.ingreso_incremental || 0);
      inversion[month - 1] += Number(row.inversion || 0);
      if (row.moneda) currency = String(row.moneda).toUpperCase();
      used += 1;
    });
    if (!used) throw new Error("El Excel no trae meses del 1 al 12.");
    return { ingreso, inversion, currency };
  }

  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => line.trim());
    const headers = lines[headerIndex].split(",").map((header) => header.trim().toLowerCase());
    return lines.slice(headerIndex + 1).map((line, index) => {
      if (!line.trim()) return null;
      const cells = line.split(",");
      const row = { __row: headerIndex + index + 2 };
      headers.forEach((header, cell) => { row[header] = (cells[cell] || "").trim(); });
      return row;
    }).filter(Boolean);
  }

  function assumptionsFrom(rows) {
    const source = (rows || []).map(normalizeRow).find((row) => Object.values(row).some((value) => String(value).trim() !== ""));
    const rate = (value) => {
      if (value == null || String(value).trim() === "") return null;
      const number = Number(String(value).replace("%", "").replace(",", "."));
      if (!isFinite(number)) return null;
      return Math.abs(number) > 1 ? number / 100 : number;
    };
    const figure = (value) => {
      if (value == null || String(value).trim() === "") return null;
      const number = Number(String(value).replace(/,/g, ""));
      return isFinite(number) ? number : null;
    };
    if (!source) return { impuesto: null, wacc: null, capital_empleado: null, capital_invertido: null };
    return {
      impuesto: rate(source.impuesto),
      wacc: rate(source.wacc),
      capital_empleado: figure(source.capital_empleado),
      capital_invertido: figure(source.capital_invertido)
    };
  }

  async function readRows(file) {
    const book = await readWorkbook(file);
    return book.rows;
  }

  async function readWorkbook(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) return { rows: parseCsv(await file.text()), assumptions: null, fileName: file.name };
    if (!window.XLSX) {
      throw new Error("Para leer Excel hace falta conexión la primera vez. También podés subir el CSV de la misma carpeta.");
    }
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = book.Sheets[book.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const headers = (matrix[0] || []).map((header) => String(header).trim().toLowerCase());
    const rows = [];
    matrix.slice(1).forEach((cells, index) => {
      if (!cells || !cells.some((cell) => String(cell).trim() !== "")) return;
      const row = { __row: index + 2 };
      headers.forEach((header, cell) => { if (header) row[header] = cells[cell]; });
      rows.push(row);
    });
    const supName = book.SheetNames.find((sheetName) => /supuesto/i.test(sheetName));
    const assumptions = supName ? assumptionsFrom(XLSX.utils.sheet_to_json(book.Sheets[supName], { defval: "" })) : null;
    return { rows, assumptions, fileName: file.name };
  }

  function normalizeRow(row) {
    const out = {};
    Object.keys(row).forEach((key) => { out[String(key).trim().toLowerCase()] = row[key]; });
    return out;
  }

  function monthTable(prior, budget, currency) {
    const rows = DATA.months.map((name, index) => {
      const change = prior[index] ? (budget[index] - prior[index]) / prior[index] : 0;
      const klass = change < 0 ? "down" : "up";
      return `<tr><td>${name}</td><td>${money(prior[index])}</td><td>${money(budget[index])}</td><td class="${klass}">${pct(change)}</td></tr>`;
    });
    return `<div class="sheet"><table><thead><tr><th>Mes</th><th>Ventas 2025</th><th>Presupuesto 2026</th><th>Variación</th></tr></thead><tbody>${rows.join("")}</tbody></table></div><p class="note">Importes en ${esc(currency)}.</p>`;
  }

  function chart(prior, parts, incremental, barHeight, currency) {
    const stacked = DATA.months.map((_, index) => parts.reduce((total, part) => total + (part.values[index] || 0), 0));
    const max = Math.max(...prior.map((value, index) => Math.max(value, stacked[index] + (incremental[index] || 0))), 1);
    const height = barHeight || 230;
    const unit = currency ? ` ${esc(currency)}` : "";
    const columns = DATA.months.map((name, index) => {
      const priorPx = Math.round(prior[index] / max * height);
      const pieces = parts.map((part) => {
        const px = Math.round((part.values[index] || 0) / max * height);
        return px ? `<div class="bar" style="height:${px}px;background:${part.color}"></div>` : "";
      });
      const incValue = incremental[index] || 0;
      const incPx = Math.round(incValue / max * height);
      const inc = incPx ? `<div class="bar inc" style="height:${incPx}px"></div>` : "";
      const now = stacked[index] + incValue;
      const delta = now - prior[index];
      const rate = prior[index] ? delta / prior[index] : 0;
      const klass = delta < 0 ? "down" : "up";
      const lift = (rate > 0 ? "+" : "") + Math.round(rate * 100) + "%";
      return `<div class="month" style="--i:${index}"><span class="lift ${klass}">${lift}</span><div class="pair"><div class="col"><div class="bar prior" style="height:${priorPx}px"></div></div><div class="col stack">${inc}${pieces.reverse().join("")}</div></div><span class="name">${name}</span><div class="tip"><strong>${name}</strong><span>Año pasado ${money(prior[index])}${unit}</span><span>Presupuesto ${money(stacked[index])}${unit}</span><span>Incremental ${money(incValue)}${unit}</span><span class="${klass}">Contra el año pasado ${money(delta)} (${pct(rate)})</span></div></div>`;
    }).join("");
    const legend = [`<span><i class="swatch prior"></i>Año pasado</span>`]
      .concat(parts.map((part) => `<span><i class="swatch" style="background:${part.color}"></i>${esc(part.name)}</span>`))
      .concat(`<span><i class="swatch inc"></i>Incremental, encima</span>`)
      .join("");
    return `<div class="legend">${legend}</div><div class="chart">${columns}</div>`;
  }

  function shareLabel(value) {
    return (value * 100).toLocaleString("es-GT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  }

  function pieSlice(start, end) {
    const r = 46;
    const cx = 50;
    const cy = 50;
    const sweep = end - start;
    if (sweep >= 359.99) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    const a1 = (start - 90) * Math.PI / 180;
    const a2 = (end - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const large = sweep > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  }

  function companyCard(id, total) {
    const item = company(id);
    const budget = sum(budgetOf(id).map((amount) => toUsd(amount, item.currency)));
    const prior = sum(priorOf(id).map((amount) => toUsd(amount, item.currency)));
    const change = prior ? (budget - prior) / prior : 0;
    const result = returnsOf(id);
    const ebit = result.ebit == null ? "—" : `${money(toUsd(result.ebit, item.currency))} USD`;
    const roic = result.ready ? pct(result.roic).replace("+", "") : "—";
    const roce = result.ready ? pct(result.roce).replace("+", "") : "—";
    return `<strong>${esc(item.name)}</strong><p>${esc(item.country)} · ${esc(item.currency)}</p><span>Presupuesto ${money(budget)} USD</span><span>Año pasado ${money(prior)} USD</span><span class="${change < 0 ? "down" : "up"}">Contra el año pasado ${pct(change)}</span><span>Parte del grupo ${shareLabel(budget / total)}</span><span>EBIT ${ebit}</span><span>ROIC ${roic} · ROCE ${roce}</span>`;
  }

  function pie() {
    const parts = DATA.companies.map((item) => ({
      id: item.id,
      name: item.name,
      value: sum(budgetOf(item.id).map((amount) => toUsd(amount, item.currency)))
    }));
    const total = sum(parts.map((part) => part.value)) || 1;
    let cursor = 0;
    const slices = parts.map((part) => {
      const start = cursor / total * 360;
      cursor += part.value;
      const end = cursor / total * 360;
      return `<path class="slice" data-company="${esc(part.id)}" d="${pieSlice(start, end)}" fill="${colorOf(part.id)}"></path>`;
    }).join("");
    const legend = parts.map((part) => `<li data-company="${esc(part.id)}"><span><i style="background:${colorOf(part.id)}"></i>${esc(part.name)}</span><span>${shareLabel(part.value / total)}</span></li>`).join("");
    return `<div class="pie-wrap" data-total="${total}"><svg class="pie" viewBox="0 0 100 100">${slices}</svg><div class="pie-card" id="pie-card" hidden></div><ul class="pie-legend">${legend}</ul></div>`;
  }

  function bindPie(root) {
    const wrap = root.querySelector(".pie-wrap");
    const card = root.querySelector("#pie-card");
    if (!wrap || !card) return;
    const total = Number(wrap.dataset.total) || 1;
    const mark = (id) => {
      wrap.querySelectorAll("[data-company]").forEach((node) => node.classList.toggle("on", node.dataset.company === id));
    };
    wrap.querySelectorAll(".slice, .pie-legend li").forEach((node) => {
      node.addEventListener("pointerenter", () => {
        const id = node.dataset.company;
        card.innerHTML = companyCard(id, total);
        card.hidden = false;
        mark(id);
      });
    });
    wrap.addEventListener("pointerleave", () => {
      card.hidden = true;
      mark("");
    });
  }

  function renderCompany() {
    const params = new URLSearchParams(location.search);
    const id = params.get("empresa");
    const item = company(id);
    const root = document.getElementById("app");
    if (!item) {
      root.innerHTML = `<p>Esa empresa no está. <a href="../index.html">Volver</a></p>`;
      return;
    }
    const budget = budgetOf(id);
    const prior = priorOf(id);
    const change = sum(prior) ? (sum(budget) - sum(prior)) / sum(prior) : 0;
    const own = initiativesOf(id);
    const added = incrementalLocal(own, item.currency);
    const custom = Boolean(loadStore().budgets[id]);
    root.innerHTML = `
      <header class="top">
        <div>
          <h1>${esc(item.name)}</h1>
          <p class="sub">${esc(item.country)}, ${esc(item.role)}. ${custom ? "Hay un presupuesto cargado en este navegador." : "Estás viendo el archivo de ejemplo."}</p>
        </div>
        <a class="back" href="../index.html">Elegir otro portal</a>
      </header>
      <dl class="ledger">
        <div><dt>Presupuesto 2026</dt><dd><span data-kind="money" data-value="${sum(budget)}">${money(sum(budget))}</span> <small>${esc(item.currency)}</small></dd></div>
        <div><dt>Ventas 2025</dt><dd><span data-kind="money" data-value="${sum(prior)}">${money(sum(prior))}</span> <small>${esc(item.currency)}</small></dd></div>
        <div><dt>Contra el año pasado</dt><dd class="${change < 0 ? "down" : "up"}"><span data-kind="pct" data-value="${change}">${pct(change)}</span></dd></div>
        <div><dt>Venta interna que no entra</dt><dd><span data-kind="money" data-value="${detailOf(id).removedAmount}">${money(detailOf(id).removedAmount)}</span> <small>${esc(item.currency)}</small></dd></div>
      </dl>
      ${ratios(returnsOf(id), item.currency)}
      <div class="split">
        <div>
          ${chart(prior, [{ name: item.name, color: colorOf(id), values: budget }], added, 230, item.currency)}
          ${monthTable(prior, budget, item.currency)}
        </div>
        <aside class="actions">
          <button class="solid" type="button" id="toggle-budget">Editar presupuesto</button>
          <button class="solid" type="button" id="toggle-init">Editar o subir iniciativas</button>
          <form id="budget-form" hidden>
            <p class="note">Excel por cliente y mes. El portal revisa intercompany, importes, moneda y la hoja Supuestos antes de cargar.</p>
            <input type="file" name="archivo" accept=".xlsx,.xls,.csv" required>
            <button class="solid" type="submit">Revisar presupuesto</button>
            <p class="note" id="budget-msg"></p>
            <div id="budget-preview"></div>
          </form>
          <div class="drawer" id="init-panel" hidden>
            <form id="init-form">
              <p class="note">Nueva iniciativa: nombre, PowerPoint y Excel con mes, ingreso_incremental e inversion.</p>
              <input type="text" name="titulo" placeholder="Nombre de la iniciativa" required>
              <label>PowerPoint<input type="file" name="ppt" accept=".pptx,.ppt"></label>
              <label>Excel<input type="file" name="excel" accept=".xlsx,.xls,.csv" required></label>
              <button class="solid" type="submit">Subir iniciativa</button>
              <p class="note" id="init-msg"></p>
            </form>
            ${own.map((entry) => `<div class="edit-item" data-id="${esc(entry.id)}"><strong>${esc(entry.name)}</strong><label>Reemplazar Excel<input type="file" data-kind="excel" accept=".xlsx,.xls,.csv"></label><label>Reemplazar PowerPoint<input type="file" data-kind="ppt" accept=".pptx,.ppt"></label><button class="solid" type="button" data-save>Guardar esta iniciativa</button><p class="note" data-msg></p></div>`).join("")}
          </div>
        </aside>
      </div>
      <h2>Qué cambió contra el año pasado</h2>
      ${explainTable([id])}
      <p><button class="ghost" type="button" id="reset">Volver a los datos de ejemplo</button></p>
    `;
    document.getElementById("toggle-budget").addEventListener("click", () => {
      document.getElementById("budget-form").hidden = !document.getElementById("budget-form").hidden;
    });
    document.getElementById("toggle-init").addEventListener("click", () => {
      document.getElementById("init-panel").hidden = !document.getElementById("init-panel").hidden;
    });
    document.querySelectorAll("[data-save]").forEach((button) => {
      button.addEventListener("click", () => saveExistingInitiative(button.closest(".edit-item")));
    });
    document.getElementById("budget-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const msg = document.getElementById("budget-msg");
      try {
        const loaded = await readWorkbook(event.target.archivo.files[0]);
        const parsed = parseBudget(loaded.rows, id, loaded.fileName, loaded.assumptions);
        const priorTotal = sum(priorOf(id));
        const fullYear = sum(parsed.months);
        const growth = priorTotal ? (fullYear - priorTotal) / priorTotal : 0;
        const errors = parsed.findings.filter((item) => item.level === "error");
        const notices = parsed.findings.filter((item) => item.level === "aviso");
        const list = (items) => items.slice(0, 8).map((item) => `<li class="finding ${item.level}">${esc(item.text)}</li>`).join("") + (items.length > 8 ? `<li class="finding">Y ${items.length - 8} más.</li>` : "");
        msg.textContent = "";
        const preview = document.getElementById("budget-preview");
        preview.innerHTML = `<div class="preview"><p class="note">Full year que entra: <strong>${money(fullYear)} ${esc(item.currency)}</strong>. Año pasado: ${money(priorTotal)}. Crecimiento presupuestado: <strong class="${growth < 0 ? "down" : "up"}">${pct(growth)}</strong>. Ventas que no entran: ${parsed.removedCount}, por ${money(parsed.removedAmount)} ${esc(item.currency)}.</p>${errors.length ? `<p>Hay que corregir</p><ul>${list(errors)}</ul>` : ""}${notices.length ? `<p>Revisado</p><ul>${list(notices)}</ul>` : "<p class='note'>Ningún cliente es intercompany y no vi importes rotos.</p>"}<div class="row-actions">${errors.length ? "" : `<button class="solid" type="button" id="confirm-budget">Confirmar y cargar</button>`}<button class="ghost" type="button" id="cancel-budget">Cancelar</button></div></div>`;
        const confirm = document.getElementById("confirm-budget");
        if (confirm) confirm.addEventListener("click", () => {
          const state = loadStore();
          state.budgets[id] = parsed;
          saveStore(state);
          renderCompany();
        });
        document.getElementById("cancel-budget").addEventListener("click", () => {
          preview.innerHTML = "";
          msg.textContent = "No se cargó. El presupuesto sigue como estaba.";
        });
      } catch (error) {
        msg.textContent = error.message;
      }
    });
    document.getElementById("init-form").addEventListener("submit", onInitiative(id));
    document.getElementById("reset").addEventListener("click", () => {
      const state = loadStore();
      delete state.budgets[id];
      state.initiatives = (state.initiatives || []).filter((entry) => entry.company !== id);
      const edits = state.edits || {};
      DATA.initiatives.filter((entry) => entry.company === id).forEach((entry) => delete edits[entry.id]);
      state.edits = edits;
      saveStore(state);
      renderCompany();
    });
    playFigures(root);
    showNotices(id);
  }

  async function saveExistingInitiative(box) {
    const msg = box.querySelector("[data-msg]");
    const itemId = box.dataset.id;
    const excel = box.querySelector('[data-kind="excel"]').files[0];
    const ppt = box.querySelector('[data-kind="ppt"]').files[0];
    if (!excel && !ppt) {
      msg.textContent = "Elegí un Excel, un PowerPoint, o los dos.";
      return;
    }
    try {
      const patch = {};
      if (excel) Object.assign(patch, readInitiativeRows(await readRows(excel)));
      if (ppt) patch.ppt = rememberPpt(itemId, ppt);
      saveInitiative(itemId, patch);
      renderCompany();
    } catch (error) {
      msg.textContent = error.message;
    }
  }

  function card(item) {
    const ingreso = sum(item.ingreso.map((value) => toUsd(value, item.currency || "USD")));
    const inversion = sum(item.inversion.map((value) => toUsd(value, item.currency || "USD")));
    const who = company(item.company);
    const href = pptHref(item);
    const open = href
      ? `<a class="solid" href="${esc(href)}" target="_blank" rel="noopener">Abrir PowerPoint</a>`
      : `<span class="note">${item.ppt ? "Volvé a adjuntar el PowerPoint para abrirlo." : "Sin PowerPoint."}</span>`;
    return `<article><div><h3>${esc(item.name)}</h3><p>${esc(who ? who.name : item.company)}</p></div><strong>${money(ingreso)} USD</strong>${open}</article>`;
  }

  function previewCard(item, review) {
    const ingreso = sum(item.ingreso.map((value) => toUsd(value, item.currency || "USD")));
    const inversion = sum(item.inversion.map((value) => toUsd(value, item.currency || "USD")));
    const who = company(item.company);
    const href = pptHref(item);
    const preview = !item.uploaded && window.RRE_PREVIEWS ? window.RRE_PREVIEWS[item.ppt] : null;
    const photo = preview
      ? `<img src="${esc(preview.image)}" alt="">`
      : `<div class="preview-fallback">Sin vista previa</div>`;
    const blurb = preview
      ? `<p>${esc(preview.text)}</p>`
      : `<p class="note">${item.ppt ? "Volvé a adjuntar el PowerPoint para ver de qué se trata." : "Sin PowerPoint."}</p>`;
    const open = href
      ? `<a class="solid" href="${esc(href)}" target="_blank" rel="noopener">Abrir PowerPoint</a>`
      : "";
    const decision = (loadStore().decisions || {})[item.id];
    const verdict = decision
      ? `<p class="verdict ${decision.status}">${decision.status === "aceptada" ? "Aceptada por el corporativo" : "Rechazada por el corporativo"}${decision.comment ? `. ${esc(decision.comment)}` : ""}</p>`
      : "";
    const actions = review
      ? `<div class="decide" data-id="${esc(item.id)}"><button class="solid" type="button" data-accept>Aceptar</button><button class="line" type="button" data-reject>Rechazar</button><form class="reject-box" hidden><textarea name="motivo" rows="3" placeholder="Motivo del rechazo" required></textarea><button class="solid" type="submit">Enviar comentario</button></form></div>`
      : "";
    return `<article class="initiative">${photo}<div><h3>${esc(item.name)}</h3><p class="who">${esc(who ? who.name : item.company)}</p>${blurb}<p class="figures"><span>Ingreso ${money(ingreso)} USD</span><span>Inversión ${money(inversion)} USD</span></p>${verdict}${open}${actions}</div></article>`;
  }

  function budgetReview(companyId) {
    const who = company(companyId);
    const decision = (loadStore().decisions || {})[`budget-${companyId}`];
    const verdict = decision
      ? `<p class="verdict ${decision.status}">${decision.status === "aceptada" ? "Aceptado por el corporativo" : "Rechazado por el corporativo"}${decision.comment ? `. ${esc(decision.comment)}` : ""}</p>`
      : `<p class="note">El presupuesto completo de esta empresa, no cada línea.</p>`;
    return `<section class="budget-call"><div><h2>Presupuesto de ${esc(who.name)}</h2>${verdict}</div><div class="decide" data-id="budget-${esc(companyId)}"><button class="solid" type="button" data-accept>Aceptar</button><button class="line" type="button" data-reject>Rechazar</button><form class="reject-box" hidden><textarea name="motivo" rows="3" placeholder="Motivo del rechazo" required></textarea><button class="solid" type="submit">Enviar comentario</button></form></div></section>`;
  }

  function decide(itemId, status, comment) {
    let companyId = "";
    let title = "";
    if (String(itemId).startsWith("budget-")) {
      companyId = String(itemId).slice("budget-".length);
      const who = company(companyId);
      if (!who) return;
      title = `Presupuesto de ${who.name}`;
    } else {
      const item = initiativesOf(null).find((entry) => entry.id === itemId);
      if (!item) return;
      companyId = item.company;
      title = item.name;
    }
    const state = loadStore();
    state.decisions = state.decisions || {};
    state.notices = state.notices || [];
    state.decisions[itemId] = { status, comment, at: Date.now() };
    if (status === "rechazada") {
      state.notices.push({
        id: `ntc-${Date.now()}`,
        company: companyId,
        initiative: title,
        comment,
        seen: false
      });
    }
    saveStore(state);
    renderGroup();
  }

  function bindReview(root) {
    root.querySelectorAll("[data-accept]").forEach((button) => {
      button.addEventListener("click", () => decide(button.closest(".decide").dataset.id, "aceptada", ""));
    });
    root.querySelectorAll("[data-reject]").forEach((button) => {
      button.addEventListener("click", () => {
        const box = button.closest(".decide").querySelector(".reject-box");
        box.hidden = false;
        box.motivo.focus();
      });
    });
    root.querySelectorAll(".reject-box").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const comment = form.motivo.value.trim();
        if (!comment) return;
        decide(form.closest(".decide").dataset.id, "rechazada", comment);
      });
    });
  }

  function showNotices(companyId) {
    const state = loadStore();
    const pending = (state.notices || []).filter((notice) => notice.company === companyId && !notice.seen && notice.comment);
    if (!pending.length) return;
    const layer = document.createElement("div");
    layer.className = "notice-layer";
    layer.innerHTML = `<div class="notice" role="dialog" aria-modal="true" aria-labelledby="notice-title"><h2 id="notice-title">El corporativo rechazó</h2>${pending.map((notice) => `<article><strong>${esc(notice.initiative)}</strong><p>${esc(notice.comment)}</p></article>`).join("")}<button class="solid" type="button" id="close-notice">Entendido</button></div>`;
    document.body.appendChild(layer);
    document.getElementById("close-notice").addEventListener("click", () => {
      const fresh = loadStore();
      const ids = new Set(pending.map((notice) => notice.id));
      (fresh.notices || []).forEach((notice) => {
        if (ids.has(notice.id)) notice.seen = true;
      });
      saveStore(fresh);
      layer.remove();
    });
  }

  function onInitiative(companyId) {
    return async function (event) {
      event.preventDefault();
      const msg = document.getElementById("init-msg");
      try {
        const form = event.target;
        const parsed = readInitiativeRows(await readRows(form.excel.files[0]));
        const { ingreso, inversion, currency } = parsed;
        const state = loadStore();
        const id = `upl-${Date.now()}`;
        const pptName = rememberPpt(id, form.ppt.files[0]);
        state.initiatives.push({
          id,
          company: companyId,
          name: form.titulo.value.trim(),
          ppt: pptName,
          uploaded: true,
          currency,
          ingreso,
          inversion
        });
        saveStore(state);
        msg.textContent = "La iniciativa quedó cargada. El corporativo ya la puede ver en este navegador.";
        renderCompany();
      } catch (error) {
        msg.textContent = error.message;
      }
    };
  }

  function renderGroup() {
    const root = document.getElementById("app");
    const selected = new URLSearchParams(location.search).get("empresa") || "TODAS";
    const ids = selected === "TODAS" ? DATA.companies.map((item) => item.id) : [selected];
    const sales = seriesUsd(ids);
    const list = initiativesOf(selected === "TODAS" ? null : selected);
    const incremental = incrementalUsd(list);
    const change = sum(sales.prior) ? (sum(sales.budget) - sum(sales.prior)) / sum(sales.prior) : 0;
    const options = [`<option value="TODAS">Todas las empresas</option>`]
      .concat(DATA.companies.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${esc(item.name)}</option>`))
      .join("");
    const monthRows = DATA.months.map((name, index) => {
      const delta = sales.prior[index] ? (sales.budget[index] - sales.prior[index]) / sales.prior[index] : 0;
      return `<tr><td>${name}</td><td>${money(sales.prior[index])}</td><td>${money(sales.budget[index])}</td><td class="${delta < 0 ? "down" : "up"}">${pct(delta)}</td><td>${money(incremental[index])}</td><td>${money(sales.budget[index] + incremental[index])}</td></tr>`;
    }).join("");
    const each = ids.map((companyId) => returnsOf(companyId));
    const ebit = each.every((item) => item.ebit == null) ? null : each.reduce((total, item, index) => total + toUsd(item.ebit || 0, DATA.sales[ids[index]].currency), 0);
    const ready = each.every((item) => item.ready);
    const groupReturn = ready ? (() => {
      const nopat = each.reduce((total, item, index) => total + toUsd(item.nopat, DATA.sales[ids[index]].currency), 0);
      const employed = each.reduce((total, item, index) => total + toUsd(detailOf(ids[index]).assumptions.capital_empleado, DATA.sales[ids[index]].currency), 0);
      const invested = each.reduce((total, item, index) => total + toUsd(detailOf(ids[index]).assumptions.capital_invertido, DATA.sales[ids[index]].currency), 0);
      const charge = each.reduce((total, item, index) => total + toUsd(detailOf(ids[index]).assumptions.capital_invertido * detailOf(ids[index]).assumptions.wacc, DATA.sales[ids[index]].currency), 0);
      return { roce: ebit / employed, roic: nopat / invested, eva: nopat - charge };
    })() : null;
    const bars = chart(sales.prior, ids.map((companyId) => ({
      name: company(companyId).name,
      color: colorOf(companyId),
      values: budgetOf(companyId).map((value) => toUsd(value, DATA.sales[companyId].currency))
    })), incremental, 132, "USD");
    root.innerHTML = `
      <header class="top board-top">
        <h1>Grupo unificado</h1>
        <div class="tools">
          <label>Ver <select id="filtro">${options}</select></label>
          <a class="solid" href="detalle.html${selected === "TODAS" ? "" : `?empresa=${selected}`}">Trazar</a>
          <a class="back" href="../index.html">Otro portal</a>
        </div>
      </header>
      <dl class="ledger board-ledger">
        <div><dt>Presupuesto</dt><dd><span data-kind="money" data-value="${sum(sales.budget)}">${money(sum(sales.budget))}</span></dd></div>
        <div><dt>Año pasado</dt><dd><span data-kind="money" data-value="${sum(sales.prior)}">${money(sum(sales.prior))}</span></dd></div>
        <div><dt>Variación</dt><dd class="${change < 0 ? "down" : "up"}"><span data-kind="pct" data-value="${change}">${pct(change)}</span></dd></div>
        <div><dt>Incremental</dt><dd><span data-kind="money" data-value="${sum(incremental)}">${money(sum(incremental))}</span></dd></div>
        <div><dt>EBIT</dt><dd>${ebit == null ? "—" : `<span data-kind="money" data-value="${ebit}">${money(ebit)}</span>`}</dd></div>
        <div><dt>ROIC</dt><dd>${groupReturn ? `<span data-kind="ratio" data-value="${groupReturn.roic}">${pct(groupReturn.roic).replace("+", "")}</span>` : "—"}</dd></div>
        <div><dt>ROCE</dt><dd>${groupReturn ? `<span data-kind="ratio" data-value="${groupReturn.roce}">${pct(groupReturn.roce).replace("+", "")}</span>` : "—"}</dd></div>
        <div><dt>EVA</dt><dd>${groupReturn ? `<span data-kind="money" data-value="${groupReturn.eva}">${money(groupReturn.eva)}</span>` : "—"}</dd></div>
      </dl>
      ${selected === "TODAS" ? "" : budgetReview(selected)}
      <div class="viz">
        <section class="chart-box">${bars}</section>
        <section>${pie()}</section>
      </div>
      <section class="previews">
        <h2>Iniciativas${selected === "TODAS" ? "" : " · " + esc(company(selected).name)}</h2>
        ${selected === "TODAS" ? "" : "<p class='note'>Aceptá o rechazá cada iniciativa. Si la rechazás, el comentario llega al portal de esta empresa.</p>"}
        <div class="preview-row">${list.map((item) => previewCard(item, selected !== "TODAS")).join("") || "<p class='note'>No hay iniciativas para este filtro.</p>"}</div>
      </section>
      <details class="fold">
        <summary>Mes a mes y clientes</summary>
        <div class="sheet"><table><thead><tr><th>Mes</th><th>Ventas 2025</th><th>Presupuesto</th><th>Variación</th><th>Incremental</th><th>Base + incremental</th></tr></thead><tbody>${monthRows}</tbody></table></div>
        <h2>Qué cambió contra el año pasado</h2>
        ${explainTable(ids)}
      </details>
    `;
    document.getElementById("filtro").addEventListener("change", (event) => {
      const value = event.target.value;
      location.search = value === "TODAS" ? "" : `?empresa=${value}`;
    });
    bindPie(root);
    bindReview(root);
    playFigures(root);
  }

  function playFigures(root) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.querySelectorAll("[data-value]").forEach((node) => {
      const target = Number(node.dataset.value);
      if (!isFinite(target)) return;
      const kind = node.dataset.kind;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 720);
        const current = target * (1 - Math.pow(1 - t, 3));
        if (kind === "pct") node.textContent = pct(current);
        else if (kind === "ratio") node.textContent = pct(current).replace("+", "");
        else node.textContent = money(current);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function renderDetail() {
    const root = document.getElementById("app");
    const selected = new URLSearchParams(location.search).get("empresa") || "TODAS";
    const ids = selected === "TODAS" ? DATA.companies.map((item) => item.id) : [selected];
    const options = [`<option value="TODAS">Todas las empresas</option>`]
      .concat(DATA.companies.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${esc(item.name)}</option>`))
      .join("");
    const lines = ids.flatMap((id) => (detailOf(id).lines || []).filter((line) => accountKind(line.cuenta) === "venta").map((line) => Object.assign({ company: id }, line)));
    const body = lines.map((line, index) => `<tr><td>${esc(company(line.company).name)}</td><td>${DATA.months[line.mes - 1] || line.mes}</td><td>${esc(line.cliente)}</td><td>${money(line.importe)} ${esc(line.moneda)}</td><td>${line.dentro ? "No entra" : "Entra"}</td><td>${esc(line.file)}</td><td>${line.row}</td><td><button class="ghost" type="button" data-trace="${index}">Trazar</button></td></tr>`).join("");
    root.innerHTML = `
      <header class="top">
        <div>
          <h1>Detalle de cifras</h1>
          <p class="sub">Cada venta del presupuesto se abre hasta el archivo y la fila que la originó.</p>
        </div>
        <a class="back" href="grupo.html">Volver al corporativo</a>
      </header>
      <div class="tools"><label>Ver <select id="filtro">${options}</select></label></div>
      <div class="sheet"><table><thead><tr><th>Empresa</th><th>Mes</th><th>Cliente</th><th>Importe</th><th>Estado</th><th>Archivo</th><th>Fila</th><th></th></tr></thead><tbody>${body}</tbody></table></div>
      <div id="trace"></div>
    `;
    document.getElementById("filtro").addEventListener("change", (event) => {
      const value = event.target.value;
      location.search = value === "TODAS" ? "" : `?empresa=${value}`;
    });
    document.querySelectorAll("[data-trace]").forEach((button) => {
      button.addEventListener("click", () => {
        const line = lines[Number(button.dataset.trace)];
        const href = line.file.startsWith("datos-demo/") ? `../${line.file}` : "";
        const file = href ? `<a href="${esc(href)}">${esc(line.file)}</a>` : esc(line.file);
        document.getElementById("trace").innerHTML = `<div class="trace"><p><strong>${money(line.importe)} ${esc(line.moneda)}</strong> de ${esc(line.cliente)} en ${DATA.months[line.mes - 1] || ""}. Sale de ${file}, fila ${line.row}. Cuenta: ${esc(line.cuenta)}.</p><p>${line.dentro ? "No entra al número: el cliente está dentro del grupo." : "Esta línea sí entra al presupuesto del grupo."}</p></div>`;
      });
    });
  }

  const page = document.body.dataset.page;
  if (page === "empresa") renderCompany();
  if (page === "grupo") renderGroup();
  if (page === "detalle") renderDetail();
})();
