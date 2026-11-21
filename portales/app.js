(function () {
  const DATA = window.RRE_DATA;
  const STORE = "rre-portales-v1";
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
    if (custom && custom.length === 12) return custom.map(Number);
    return DATA.sales[id].budget.slice();
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
    const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(",").map((header) => header.trim().toLowerCase());
    return lines.map((line) => {
      const cells = line.split(",");
      const row = {};
      headers.forEach((header, index) => { row[header] = (cells[index] || "").trim(); });
      return row;
    });
  }

  async function readRows(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) return parseCsv(await file.text());
    if (!window.XLSX) {
      throw new Error("Para leer Excel hace falta conexión la primera vez. También podés subir el CSV de la misma carpeta.");
    }
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: "" });
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

  function chart(prior, base, incremental) {
    const max = Math.max(...prior.map((value, index) => Math.max(value, base[index] + (incremental[index] || 0))), 1);
    const height = 230;
    const columns = DATA.months.map((name, index) => {
      const priorPx = Math.round(prior[index] / max * height);
      const basePx = Math.round(base[index] / max * height);
      const rawInc = Math.round((incremental[index] || 0) / max * height);
      const incPx = incremental[index] ? Math.max(rawInc, 5) : 0;
      return `<div class="month"><div class="pair"><div class="col"><div class="bar prior" style="height:${priorPx}px"></div></div><div class="col stack"><div class="bar inc" style="height:${incPx}px"></div><div class="bar base" style="height:${basePx}px"></div></div></div><span class="name">${name}</span></div>`;
    }).join("");
    return `<div class="legend"><span><i class="swatch prior"></i>Año pasado</span><span><i class="swatch base"></i>Presupuesto base</span><span><i class="swatch inc"></i>Incremental, encima</span></div><div class="chart">${columns}</div>`;
  }

  function shareLabel(value) {
    return (value * 100).toLocaleString("es-GT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  }

  function pie() {
    const colors = ["#f4e7c3", "#d4b06a", "#f7f7f7", "#8ea4c8", "#a8843d", "#d8dee8"];
    const parts = DATA.companies.map((item) => ({
      name: item.name,
      value: sum(budgetOf(item.id).map((amount) => toUsd(amount, item.currency)))
    }));
    const total = sum(parts.map((part) => part.value)) || 1;
    let cursor = 0;
    const stops = parts.map((part, index) => {
      const start = cursor / total * 360;
      cursor += part.value;
      const end = cursor / total * 360;
      return `${colors[index]} ${start}deg ${end}deg`;
    });
    const legend = parts.map((part, index) => `<li><span><i style="background:${colors[index]}"></i>${esc(part.name)}</span><span>${shareLabel(part.value / total)}</span></li>`).join("");
    return `<div class="pie-wrap"><div class="pie" style="background:conic-gradient(${stops.join(",")})"></div><ul class="pie-legend">${legend}</ul></div>`;
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
        <div><dt>Presupuesto 2026</dt><dd>${money(sum(budget))} <small>${esc(item.currency)}</small></dd></div>
        <div><dt>Ventas 2025</dt><dd>${money(sum(prior))} <small>${esc(item.currency)}</small></dd></div>
        <div><dt>Contra el año pasado</dt><dd class="${change < 0 ? "down" : "up"}">${pct(change)}</dd></div>
      </dl>
      <div class="split">
        <div>
          ${chart(prior, budget, added)}
          ${monthTable(prior, budget, item.currency)}
        </div>
        <aside class="actions">
          <button class="solid" type="button" id="toggle-budget">Editar presupuesto</button>
          <button class="solid" type="button" id="toggle-init">Editar o subir iniciativas</button>
          <form id="budget-form" hidden>
            <p class="note">Excel o CSV con columnas mes, cuenta, moneda, importe. Reemplaza el presupuesto actual.</p>
            <input type="file" name="archivo" accept=".xlsx,.xls,.csv" required>
            <button class="solid" type="submit">Cargar presupuesto</button>
            <p class="note" id="budget-msg"></p>
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
        const rows = await readRows(event.target.archivo.files[0]);
        const next = Array(12).fill(0);
        let used = 0;
        rows.forEach((raw) => {
          const row = normalizeRow(raw);
          const account = String(row.cuenta || "");
          if (!/venta/i.test(account)) return;
          const month = Number(row.mes);
          const amount = Number(String(row.importe).replace(/,/g, ""));
          if (month >= 1 && month <= 12 && isFinite(amount)) {
            next[month - 1] += amount;
            used += 1;
          }
        });
        if (!used) throw new Error("No encontré filas de ventas. La columna cuenta tiene que decir Ventas.");
        const state = loadStore();
        state.budgets[id] = next;
        saveStore(state);
        msg.textContent = `Listo. Entré ${used} filas de ventas.`;
        renderCompany();
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
    root.innerHTML = `
      <header class="top">
        <div>
          <h1>Grupo unificado</h1>
          <p class="sub">Ventas pasadas a dólares con la tasa oficial, más el incremental de las iniciativas. ${esc(DATA.note)}</p>
        </div>
        <a class="back" href="../index.html">Elegir otro portal</a>
      </header>
      <div class="tools">
        <label>Ver <select id="filtro">${options}</select></label>
        <a class="solid" href="#iniciativas">Ver iniciativas</a>
      </div>
      <dl class="ledger">
        <div><dt>Presupuesto base</dt><dd>${money(sum(sales.budget))} <small>USD</small></dd></div>
        <div><dt>Ventas 2025</dt><dd>${money(sum(sales.prior))} <small>USD</small></dd></div>
        <div><dt>Contra el año pasado</dt><dd class="${change < 0 ? "down" : "up"}">${pct(change)}</dd></div>
        <div><dt>Incremental</dt><dd>${money(sum(incremental))} <small>USD</small></dd></div>
      </dl>
      <div class="viz">
        <section class="chart-box">${chart(sales.prior, sales.budget, incremental)}</section>
        <section>
          <h2>Aporte de cada empresa</h2>
          ${pie()}
        </section>
      </div>
      <div class="sheet" style="margin-top:22px"><table><thead><tr><th>Mes</th><th>Ventas 2025</th><th>Presupuesto base</th><th>Variación</th><th>Incremental</th><th>Base + incremental</th></tr></thead><tbody>${monthRows}</tbody></table></div>
      <p class="note">Dólares. Quetzal a 7,75. Lempira a 25. La barra blanca es el año pasado. La dorada es el presupuesto, con el incremental blanco encima.</p>
      <h2 id="iniciativas">Iniciativas de crecimiento</h2>
      <div class="init-list">${list.map(card).join("") || "<p class='note'>No hay iniciativas para este filtro.</p>"}</div>
    `;
    document.getElementById("filtro").addEventListener("change", (event) => {
      const value = event.target.value;
      location.search = value === "TODAS" ? "" : `?empresa=${value}`;
    });
  }

  const page = document.body.dataset.page;
  if (page === "empresa") renderCompany();
  if (page === "grupo") renderGroup();
})();
