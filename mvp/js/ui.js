(function () {
  const app = document.getElementById("app");
  const drawer = document.getElementById("drawer");
  const shade = document.getElementById("shade");
  let scenario = "oficial";
  let extraInitiatives = [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function openTrace(title, rows) {
    drawer.innerHTML = "<p class='kicker'>De dónde sale</p><h2>" + esc(title) + "</h2>" +
      rows.map((r) => "<div class='item'><b>" + esc(r.label) + "</b><div>" + esc(r.value) + "</div></div>").join("") +
      "<p><button class='ghost' id='close-drawer' type='button'>Cerrar</button></p>";
    drawer.classList.add("open");
    shade.classList.add("open");
    document.getElementById("close-drawer").onclick = closeTrace;
  }

  function closeTrace() {
    drawer.classList.remove("open");
    shade.classList.remove("open");
  }

  function traceRows(t, extra) {
    const rows = [
      { label: "Empresa", value: t.company },
      { label: "Archivo", value: t.file },
      { label: "Fila", value: String(t.line) },
      { label: "Cuenta", value: t.account + " · " + t.name },
      { label: "Moneda", value: t.currency },
      { label: "Presupuesto", value: window.RRE.local(t.budget) },
      { label: "Real", value: window.RRE.local(t.actual) },
      { label: "Año anterior", value: window.RRE.local(t.prior) }
    ];
    if (t.raw) rows.push({ label: "Texto original", value: t.raw });
    if (t.note) rows.push({ label: "Nota del archivo", value: t.note });
    if (t.counterparty) rows.push({ label: "Contraparte", value: t.counterparty });
    return rows.concat(extra || []);
  }

  function render() {
    const check = window.RRE.selfCheck();
    const snap = scenario === "oficial" ? check.result : window.RRE.consolidate(scenario);
    const usd = window.RRE.usd;
    const pct = window.RRE.pct;
    const initiatives = window.RRE.INITIATIVES.concat(extraInitiatives).map((item) => window.RRE.analyzeInitiative(item, snap));
    const maxSales = Math.max.apply(null, snap.byCompany.map((c) => Math.abs(c.sales) || 1));
    const market = window.RRE.MARKET;
    const ambition = market.revenueRef * market.multiple;

    app.innerHTML = ""
      + (check.ok ? "" : "<p class='fail'>La prueba interna no cerró: " + esc(check.errors.join(", ")) + "</p>")
      + "<section class='hero' id='numero'>"
      + "<article class='card'>"
      + "<div class='kicker'>EBIT limpio del grupo · " + (scenario === "oficial" ? "tasa oficial" : "tasa filial 24,5") + "</div>"
      + "<div class='big'><button type='button' id='open-ebit'>" + esc(usd(snap.ebit)) + "</button></div>"
      + "<p class='sub'>Seis presupuestos, una moneda. Las ventas entre empresas ya salieron. Cada cifra de esta pantalla abre el archivo y la fila.</p>"
      + "<div class='chips'>"
      + chip("Confianza del número", pct(snap.confidence), "Después de frenar errores")
      + chip("NOPAT", usd(snap.nopat), "EBIT × (1 − " + pct(snap.tax) + ")")
      + chip("EVA", usd(snap.eva), snap.eva > 0 ? "El grupo crea valor" : "El grupo destruye valor")
      + chip("Filas leídas", String(snap.rowsRead), snap.blocks.length + " se frenan")
      + "</div></article>"
      + "<article class='card'>"
      + "<div class='kicker'>Decisión de sala</div>"
      + "<p class='decision'>" + (snap.eva > 0 ? "El número limpio crea valor." : "El número limpio destruye valor.") + "</p>"
      + "<p class='sub'>Capital empleado " + esc(usd(snap.capital)) + ". WACC " + esc(pct(snap.wacc)) + ". Cargo de capital " + esc(usd(Math.round(snap.capital * snap.wacc))) + ".</p>"
      + "<p class='sub'>Caja disponible " + esc(usd(snap.cash)) + ".</p>"
      + "<div class='chips'>"
      + "<button class='primary' id='copy-log' type='button'>Copiar bitácora</button>"
      + "<button class='ghost' id='tour' type='button'>Recorrido de 6 pasos</button>"
      + "</div></article></section>"

      + "<section class='grid-2'>"
      + "<article class='card' id='ventas'><h2>Ventas, sin doble conteo</h2>"
      + waterfall(snap, usd)
      + "</article>"
      + "<article class='card'><h2>De dónde sale el EBIT</h2>"
      + "<p class='sub'>Ingresos a terceros menos costos y gastos que sí pasaron el filtro.</p>"
      + part("Ingresos a terceros", snap.revenue, usd)
      + part("Costo a terceros", -snap.cogs, usd)
      + part("Gastos", -snap.opex, usd)
      + part("Depreciación", -snap.da, usd)
      + "<div class='checkline'><b>EBIT</b><b>" + esc(usd(snap.ebit)) + "</b></div>"
      + "</article></section>"

      + "<h2 id='empresas'>Seis empresas</h2>"
      + "<div class='card grid-6'>" + snap.byCompany.map((c) => ""
        + "<button class='chip company' type='button' data-company='" + c.id + "'>"
        + "<span>" + esc(c.name) + " · " + esc(c.currency) + "</span>"
        + "<b>" + esc(usd(c.ebit)) + "</b>"
        + "<span>EBIT · ventas " + esc(usd(c.sales)) + "</span>"
        + "<div class='track'><span style='width:" + Math.max(6, Math.round(Math.abs(c.sales) / maxSales * 100)) + "%'></span></div>"
        + "</button>").join("") + "</div>"

      + "<h2 id='validar'>Lo que no entra</h2>"
      + "<p class='section-lead'>El validador frena la fila antes de que toque el número del grupo. Al lado, el golpe si alguien la suma a mano.</p>"
      + "<div class='grid-2'><article class='card'>" + snap.blocks.map((b, i) => ""
        + "<div class='item'><span class='tag'>" + esc(b.kind) + "</span>"
        + "<p class='sentence'>" + esc(b.sentence) + "</p>"
        + "<button class='ghost' type='button' data-block='" + i + "'>Ver " + esc(b.trace.company) + ", fila " + b.trace.line + "</button> "
        + "<span class='warn'>" + esc(usd(b.impactUsd)) + "</span> <span class='sub'>" + esc(b.impactLabel) + "</span>"
        + "</div>").join("") + "</article>"
      + "<article class='card'><h3>Ventas entre empresas</h3>"
      + snap.pairs.map((p, i) => "<div class='item'><p class='sentence'>" + esc(companyName(p.rev.company)) + " fila " + p.rev.line + " y " + esc(companyName(p.cost.company)) + " fila " + p.cost.line + " calzan en " + esc(usd(p.rev.budgetUsd)) + ". Salen las dos.</p><button class='ghost' type='button' data-pair='" + i + "'>Ver las dos filas</button></div>").join("")
      + "<h3>Descalce</h3>"
      + (snap.descalces.length ? snap.descalces.map((d, i) => "<div class='item'><p class='sentence'>" + esc(companyName(d.company)) + " deja " + esc(d.name) + " por " + esc(usd(d.budgetUsd)) + " sin el otro lado. Fuera del número limpio.</p><button class='ghost' type='button' data-gap='" + i + "'>Ver fila " + d.line + "</button></div>").join("") : "<p>Con esta tasa no hay descalce.</p>")
      + "<h3>Avisos</h3>"
      + snap.warnings.map((w) => "<p class='sentence'>" + esc(w.sentence) + "</p>").join("")
      + "<h3>Recorte aceptado</h3>"
      + snap.accepted.map((a) => "<p class='sentence ok'>" + esc(a.sentence) + "</p>").join("")
      + "</article></div>"

      + "<h2 id='desvios'>Por qué se movió el real</h2>"
      + "<p class='section-lead'>El explicador separa el cambio del negocio y el cambio de la tasa. La frase sale de la nota de la fila.</p>"
      + "<div class='card'>" + snap.deviations.slice(0, 5).map((d, i) => ""
        + "<div class='item'><b class='" + (d.effect >= 0 ? "ok" : "bad") + "'>" + esc(usd(d.effect)) + "</b> en EBIT · " + esc(d.company) + " · " + esc(d.name)
        + "<p class='sentence'>" + esc(d.sentence) + "</p>"
        + "<p class='sub'>Negocio " + esc(usd(d.volume)) + " · Tasa " + esc(usd(d.fx)) + "</p>"
        + "<button class='ghost' type='button' data-dev='" + i + "'>Abrir fila " + d.trace.line + "</button></div>").join("")
      + "</div>"

      + "<h2 id='valor'>ROIC, ROCE y EVA calculados</h2>"
      + "<p class='section-lead'>El tablero no copia la hoja local. La muestra al lado para que se vea la diferencia.</p>"
      + "<div class='grid-3'>" + snap.kpis.map((k) => ""
        + "<article class='card'><div class='kicker'>" + esc(k.indicator) + "</div>"
        + "<div class='big' style='font-size:40px'>" + esc(k.indicator === "EVA" ? usd(k.calculated) : pct(k.calculated)) + "</div>"
        + "<p class='sub'>" + esc(k.formula) + "</p>"
        + "<p>Pegado a mano: <b class='bad'>" + esc(k.indicator === "EVA" ? usd(k.pasted) : pct(k.pasted)) + "</b></p>"
        + "<p class='sub'>Diferencia: " + esc(k.indicator === "EVA" ? usd(k.calculated - k.pasted) : ((k.calculated - k.pasted) * 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " puntos") + "</p>"
        + "<button class='ghost' type='button' data-kpi='" + esc(k.indicator) + "'>Ver fórmula y archivo</button></article>").join("")
      + "</div>"

      + "<h2 id='iniciativas'>Iniciativas: del PPT a una decisión</h2>"
      + "<p class='section-lead'>Se carga el texto de la iniciativa. El motor lo cruza con caja, WACC, impuesto y con reciclaje, ética y gobernanza.</p>"
      + "<div class='drop' id='drop'><b>Soltá un PPTX o un TXT</b><p class='sub'>Tiene que decir la inversión y el beneficio. Si no vienen, la decisión se detiene.</p><input id='file' type='file' accept='.pptx,.txt,.md'></div>"
      + "<div class='grid-2'>" + initiatives.map((item, i) => ""
        + "<article class='card'><span class='tag'>" + esc(item.decision) + "</span> <span class='sub'>puntaje " + item.score + "</span>"
        + "<h3>" + esc(item.title) + "</h3>"
        + "<p>Inversión " + esc(usd(item.capex)) + " · EBIT anual " + esc(usd(item.annualEbit)) + "</p>"
        + "<p class='" + (item.eva >= 0 ? "ok" : "bad") + "'>EVA de la iniciativa " + esc(usd(item.eva)) + "</p>"
        + item.reasons.map((reason) => "<p class='sentence'>" + esc(reason) + "</p>").join("")
        + "<button class='ghost' type='button' data-init='" + i + "'>Ver criterio</button></article>").join("")
      + "</div>"

      + "<h2 id='casos'>Los casos de uso, ya resueltos en esta corrida</h2>"
      + "<div class='card'>"
      + checkLine("Cada empresa trae otro formato", "6 archivos, títulos, punto y coma, montos con L y una cuenta en inglés")
      + checkLine("La venta entre empresas no se cuenta dos veces", snap.pairs.length + " pares eliminados por " + usd(snap.icSales))
      + checkLine("Varias monedas, una tasa oficial", "GTQ 7,75 · HNL 25 · USD 1. El botón de arriba muestra la tasa 24,5")
      + checkLine("ROIC, ROCE y EVA no se copian", "Calculados desde el EBIT limpio. La hoja pegada queda al lado")
      + checkLine("La desviación se explica sola", snap.deviations.length + " movimientos con nota, negocio y tasa")
      + checkLine("Un presupuesto menor al año anterior exige razón", snap.blocks.some((b) => b.kind === "recorte") ? "El recorte sin razón volvió al año anterior" : "Sin recortes")
      + "</div>"

      + "<h2 id='mercado'>Contexto para la conversación</h2>"
      + "<p class='section-lead'>" + esc(market.label) + "</p>"
      + "<div class='grid-3'>"
      + "<article class='card'><div class='kicker'>Facturación de referencia</div><div class='big' style='font-size:36px'>" + esc(usd(market.revenueRef)) + "</div><p class='sub'>Orden de magnitud del tipo de cliente. No es el presupuesto de esta demo.</p></article>"
      + "<article class='card'><div class='kicker'>Ambición 20×</div><div class='big' style='font-size:36px'>" + esc(usd(ambition)) + "</div><p class='sub'>Cae en el piso del mercado de largos en LatAm (" + esc(usd(market.marketLow)) + " a " + esc(usd(market.marketHigh)) + ").</p></article>"
      + "<article class='card'><div class='kicker'>Importación en Guatemala</div><div class='big' style='font-size:36px'>" + esc(pct(market.importShareGt)) + "</div><p class='sub'>La iniciativa de laminación ataca ese hueco. El presupuesto de la demo no calcula la cuota.</p></article>"
      + "</div>"
      + "<p class='foot'>Demo ficticia Grupo Istmo, período 2026. Activo " + esc(usd(snap.assets)) + " · Pasivo corriente " + esc(usd(snap.currentLiab)) + " · Patrimonio " + esc(usd(snap.equity)) + " · Deuda " + esc(usd(snap.debt)) + ". Capital por las dos vías: " + esc(usd(snap.capital)) + ".</p>";

    bind(snap, initiatives);
  }

  function chip(label, value, note) {
    return "<div class='chip'><span>" + esc(label) + "</span><b>" + esc(value) + "</b><span>" + esc(note) + "</span></div>";
  }

  function part(label, value, usd) {
    return "<div class='checkline'><span>" + esc(label) + "</span><b>" + esc(usd(value)) + "</b></div>";
  }

  function waterfall(snap, usd) {
    const steps = [
      ["Ventas cargadas", snap.loadedSales],
      ["Entre empresas", -snap.icSales],
      ["Descalce fuera", -snap.gapSales],
      ["Ventas a terceros", snap.cleanSales]
    ];
    return steps.map((s) => "<div class='checkline'><span>" + s[0] + "</span><b>" + esc(usd(s[1])) + "</b></div>").join("");
  }

  function checkLine(title, detail) {
    return "<div class='checkline'><div><b class='ok'>Listo.</b> " + esc(title) + "<div class='sub'>" + esc(detail) + "</div></div></div>";
  }

  function companyName(id) {
    return window.RRE.COMPANIES.find((c) => c.id === id).name;
  }

  function bind(snap, initiatives) {
    document.querySelectorAll("[data-scenario]").forEach((btn) => {
      btn.classList.toggle("on", btn.getAttribute("data-scenario") === scenario);
      btn.onclick = () => {
        scenario = btn.getAttribute("data-scenario");
        render();
      };
    });
    document.getElementById("open-ebit").onclick = () => openTrace("EBIT limpio", [
      { label: "Ingresos", value: window.RRE.usd(snap.revenue) },
      { label: "Costos", value: window.RRE.usd(snap.cogs) },
      { label: "Gastos", value: window.RRE.usd(snap.opex) },
      { label: "Depreciación", value: window.RRE.usd(snap.da) },
      { label: "EBIT", value: window.RRE.usd(snap.ebit) },
      { label: "Fórmula", value: "Ingresos − costos − gastos − depreciación, ya en USD y sin ventas internas" }
    ].concat(snap.clean.filter((r) => window.RRE.CATALOG[r.account].sign !== 0).slice(0, 8).map((r) => ({
      label: companyName(r.company) + " fila " + r.line,
      value: r.file
    }))));
    document.getElementById("copy-log").onclick = async () => {
      const text = window.RRE.bitacora(snap);
      try { await navigator.clipboard.writeText(text); } catch (err) { console.log(text); }
      openTrace("Bitácora lista para pegar", [{ label: "Uso", value: "Quedó en el portapapeles. También se ve abajo." }, { label: "Texto", value: text }]);
    };
    document.getElementById("tour").onclick = () => {
      const ids = ["numero", "ventas", "validar", "desvios", "valor", "iniciativas"];
      let i = 0;
      const step = () => {
        const el = document.getElementById(ids[i]);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("pulse");
        setTimeout(() => el.classList.remove("pulse"), 1200);
        i += 1;
        if (i < ids.length) setTimeout(step, 1400);
      };
      step();
    };
    document.querySelectorAll("[data-company]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-company");
        const lines = snap.clean.filter((r) => r.company === id);
        openTrace(companyName(id), lines.map((r) => ({
          label: "Fila " + r.line + " · " + r.name,
          value: window.RRE.usd(window.RRE.CATALOG[r.account].sign * r.budgetUsd) + " · " + r.file
        })));
      };
    });
    document.querySelectorAll("[data-block]").forEach((btn) => {
      btn.onclick = () => {
        const b = snap.blocks[Number(btn.getAttribute("data-block"))];
        openTrace("Fila frenada", traceRows(b.trace, [{ label: "Por qué", value: b.sentence }]));
      };
    });
    document.querySelectorAll("[data-pair]").forEach((btn) => {
      btn.onclick = () => {
        const p = snap.pairs[Number(btn.getAttribute("data-pair"))];
        openTrace("Par eliminado", traceRows(p.rev.trace ? p.rev : {
          company: companyName(p.rev.company),
          file: p.rev.file,
          line: p.rev.line,
          account: p.rev.account,
          name: p.rev.name,
          currency: p.rev.currency,
          budget: p.rev.budget,
          actual: p.rev.actual,
          prior: p.rev.prior,
          note: p.rev.note,
          raw: p.rev.raw,
          counterparty: p.rev.counterparty
        }).concat([{ label: "Espejo", value: companyName(p.cost.company) + " · " + p.cost.file + " fila " + p.cost.line }]));
      };
    });
    document.querySelectorAll("[data-gap]").forEach((btn) => {
      btn.onclick = () => {
        const d = snap.descalces[Number(btn.getAttribute("data-gap"))];
        openTrace("Descalce", traceRows({
          company: companyName(d.company),
          file: d.file,
          line: d.line,
          account: d.account,
          name: d.name,
          currency: d.currency,
          budget: d.budget,
          actual: d.actual,
          prior: d.prior,
          note: d.note,
          raw: d.raw,
          counterparty: d.counterparty
        }, [{ label: "USD", value: window.RRE.usd(d.budgetUsd) }]));
      };
    });
    document.querySelectorAll("[data-dev]").forEach((btn) => {
      btn.onclick = () => {
        const d = snap.deviations[Number(btn.getAttribute("data-dev"))];
        openTrace("Desviación", traceRows(d.trace, [
          { label: "Efecto en EBIT", value: window.RRE.usd(d.effect) },
          { label: "Negocio", value: window.RRE.usd(d.volume) },
          { label: "Tasa", value: window.RRE.usd(d.fx) }
        ]));
      };
    });
    document.querySelectorAll("[data-kpi]").forEach((btn) => {
      btn.onclick = () => {
        const k = snap.kpis.find((item) => item.indicator === btn.getAttribute("data-kpi"));
        const shown = k.indicator === "EVA" ? window.RRE.usd(k.calculated) : window.RRE.pct(k.calculated);
        const pasted = k.indicator === "EVA" ? window.RRE.usd(k.pasted) : window.RRE.pct(k.pasted);
        openTrace(k.indicator, [
          { label: "Fórmula", value: k.formula },
          { label: "Calculado", value: shown },
          { label: "EBIT", value: window.RRE.usd(snap.ebit) },
          { label: "NOPAT", value: window.RRE.usd(snap.nopat) },
          { label: "Capital", value: window.RRE.usd(snap.capital) },
          { label: "Pegado", value: pasted },
          { label: "Archivo", value: k.source + " fila " + k.line },
          { label: "Origen", value: k.origin }
        ]);
      };
    });
    document.querySelectorAll("[data-init]").forEach((btn) => {
      btn.onclick = () => {
        const item = initiatives[Number(btn.getAttribute("data-init"))];
        openTrace(item.title, [
          { label: "Decisión", value: item.decision },
          { label: "Inversión", value: window.RRE.usd(item.capex) },
          { label: "EBIT anual", value: window.RRE.usd(item.annualEbit) },
          { label: "EVA", value: window.RRE.usd(item.eva) },
          { label: "Caja del grupo", value: window.RRE.usd(snap.cash) },
          { label: "WACC", value: window.RRE.pct(snap.wacc) },
          { label: "Archivo", value: item.file },
          { label: "Por qué", value: item.reasons.join(" ") }
        ]);
      };
    });
    const file = document.getElementById("file");
    const drop = document.getElementById("drop");
    file.onchange = () => { if (file.files[0]) ingest(file.files[0]); };
    drop.ondragover = (e) => { e.preventDefault(); };
    drop.ondrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) ingest(e.dataTransfer.files[0]);
    };
    shade.onclick = closeTrace;
  }

  async function ingest(file) {
    let text = "";
    if (/\.pptx$/i.test(file.name)) text = await pptxText(file);
    else text = await file.text();
    const item = window.RRE.initiativeFromText(text, file.name);
    extraInitiatives.push(item);
    render();
    document.getElementById("iniciativas").scrollIntoView({ behavior: "smooth" });
  }

  async function pptxText(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("PPTX ilegible");
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const chunks = [];
    for (let n = 0; n < count; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      const method = view.getUint16(p + 10, true);
      const compSize = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const localOffset = view.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      if (/ppt\/slides\/slide\d+\.xml/.test(name)) {
        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const start = localOffset + 30 + localNameLen + localExtraLen;
        const comp = bytes.subarray(start, start + compSize);
        let xml;
        if (method === 0) xml = new TextDecoder().decode(comp);
        else {
          const stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
          xml = await new Response(stream).text();
        }
        chunks.push(xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
    return chunks.join("\n");
  }

  document.getElementById("close-x").onclick = closeTrace;
  render();
})();
