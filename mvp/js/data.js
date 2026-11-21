/* Datos ficticios del Grupo Istmo. No son contabilidad de Grupo AG. */
(function () {
  const COMPANIES = [
    { id: "EMP01", name: "Aceros del Sur", country: "Guatemala", currency: "GTQ", role: "Acero y reciclaje" },
    { id: "EMP02", name: "Distribuidora Metro", country: "Guatemala", currency: "GTQ", role: "Distribución" },
    { id: "EMP03", name: "Logística CA", country: "El Salvador", currency: "USD", role: "Logística" },
    { id: "EMP04", name: "Aceros Honduras", country: "Honduras", currency: "HNL", role: "Acero" },
    { id: "EMP05", name: "Ferretería Norte", country: "Honduras", currency: "HNL", role: "Retail" },
    { id: "EMP06", name: "Holding Servicios", country: "Panamá", currency: "USD", role: "Holding" }
  ];

  const FX = {
    USD: { budget: 1, actual: 1 },
    GTQ: { budget: 7.75, actual: 7.72 },
    HNL: { budget: 25, actual: 25.2 }
  };

  const PARAMS = {
    tax: 0.25,
    wacc: 0.105,
    period: "2026",
    prior: "2025",
    currency: "USD",
    filialHnl: 24.5
  };

  const CATALOG = {
    "4100": { name: "Ingresos a terceros", statement: "P&L", sign: 1 },
    "4200": { name: "Ingresos entre empresas", statement: "P&L", sign: 1 },
    "5100": { name: "Costo a terceros", statement: "P&L", sign: -1 },
    "5200": { name: "Costo entre empresas", statement: "P&L", sign: -1 },
    "6100": { name: "Gastos operativos", statement: "P&L", sign: -1 },
    "6200": { name: "Gastos entre empresas", statement: "P&L", sign: -1 },
    "6300": { name: "Depreciación", statement: "P&L", sign: -1 },
    "1050": { name: "Efectivo", statement: "BS", sign: 0 },
    "1100": { name: "Activos totales", statement: "BS", sign: 0 },
    "2100": { name: "Pasivo corriente", statement: "BS", sign: 0 },
    "2200": { name: "Deuda financiera", statement: "BS", sign: 0 },
    "3100": { name: "Patrimonio", statement: "BS", sign: 0 }
  };

  const FILES = {
    EMP01: "mvp/data/fuentes/EMP01_Aceros_del_Sur_GT.csv",
    EMP02: "mvp/data/fuentes/EMP02_Distribuidora_Metro_GT.csv",
    EMP03: "mvp/data/fuentes/EMP03_Logistica_CA_SV.csv",
    EMP04: "mvp/data/fuentes/EMP04_Aceros_Honduras_HN.csv",
    EMP05: "mvp/data/fuentes/EMP05_Ferreteria_Norte_HN.csv",
    EMP06: "mvp/data/fuentes/EMP06_Holding_Servicios_PA.csv"
  };

  function row(partial) {
    const budget = partial.budget;
    return Object.assign(
      {
        actual: budget,
        prior: budget,
        counterparty: "",
        ic: false,
        justification: "",
        note: "",
        raw: "",
        fxMemo: null
      },
      partial,
      { file: FILES[partial.company] }
    );
  }

  const ROWS = [
    row({ company: "EMP01", line: 2, account: "4100", name: "Ventas locales de acero estructural", currency: "GTQ", budget: 116250000, actual: 124000000, prior: 110000000, note: "Mayor demanda de productos largos en obra vial" }),
    row({ company: "EMP01", line: 3, account: "4200", name: "Ventas de acero a Distribuidora Metro", currency: "GTQ", budget: 15500000, counterparty: "EMP02", ic: true, note: "Despachos de planta al centro de distribución" }),
    row({ company: "EMP01", line: 4, account: "4200", name: "Venta de chatarra a Ferretería Norte", currency: "GTQ", budget: 77500, counterparty: "EMP05", ic: true, note: "Sin registro espejo en la ferretería" }),
    row({ company: "EMP01", line: 5, account: "5100", name: "Costo de chatarra y palanquilla", currency: "GTQ", budget: 69750000, actual: 82653750, note: "Alza internacional +18,5% del precio por tonelada" }),
    row({ company: "EMP01", line: 6, account: "6100", name: "Gastos de administración y ventas", currency: "GTQ", budget: 15500000, note: "Ejecución en línea" }),
    row({ company: "EMP01", line: 7, account: "6200", name: "Honorarios de gestión del holding", currency: "GTQ", budget: 2325000, counterparty: "EMP06", ic: true, note: "Fee anual según contrato" }),
    row({ company: "EMP01", line: 8, account: "6300", name: "Depreciación de hornos y maquinaria", currency: "GTQ", budget: 3875000 }),
    row({ company: "EMP01", line: 9, account: "1050", name: "Efectivo y bancos", currency: "GTQ", budget: 15500000 }),
    row({ company: "EMP01", line: 10, account: "1100", name: "Activos totales", currency: "GTQ", budget: 193750000 }),
    row({ company: "EMP01", line: 11, account: "2100", name: "Pasivos corrientes", currency: "GTQ", budget: 46500000 }),
    row({ company: "EMP01", line: 12, account: "2200", name: "Deuda financiera", currency: "GTQ", budget: 38750000 }),
    row({ company: "EMP01", line: 13, account: "3100", name: "Patrimonio", currency: "GTQ", budget: 108500000 }),

    row({ company: "EMP02", line: 5, account: "4100", name: "Ventas mayoreo", currency: "GTQ", budget: 62000000, note: "Primera fila de datos. Arriba hay títulos." }),
    row({ company: "EMP02", line: 6, account: "5100", name: "Compras a proveedores externos", currency: "GTQ", budget: 31000000 }),
    row({ company: "EMP02", line: 7, account: "5200", name: "Compras de acero a Aceros del Sur", currency: "GTQ", budget: 15500000, counterparty: "EMP01", ic: true }),
    row({ company: "EMP02", line: 8, account: "6100", name: "Gastos de distribución y flota", currency: "GTQ", budget: 7750000 }),
    row({ company: "EMP02", line: 9, account: "6100", name: "Gastos administrativos de bodega", currency: "GTQ", budget: 3875000 }),
    row({ company: "EMP02", line: 10, account: "6300", name: "Depreciación de bodega", currency: "GTQ", budget: 775000 }),
    row({ company: "EMP02", line: 11, account: "6100", name: "Ajuste manual de flete", currency: "GTQ", budget: -5450000, note: "Signo invertido en el archivo" }),
    row({ company: "EMP02", line: 12, account: "1050", name: "Caja y bancos", currency: "GTQ", budget: 3875000 }),
    row({ company: "EMP02", line: 13, account: "1100", name: "Activos totales", currency: "GTQ", budget: 46500000 }),
    row({ company: "EMP02", line: 14, account: "2100", name: "Pasivos de corto plazo", currency: "GTQ", budget: 15500000 }),
    row({ company: "EMP02", line: 15, account: "2200", name: "Préstamos bancarios", currency: "GTQ", budget: 7750000 }),
    row({ company: "EMP02", line: 16, account: "3100", name: "Capital contable", currency: "GTQ", budget: 23250000 }),

    row({ company: "EMP03", line: 2, account: "4100", name: "Flete a terceros", currency: "USD", budget: 6400000, note: "Clientes en El Salvador y Guatemala" }),
    row({ company: "EMP03", line: 3, account: "4200", name: "Flete cobrado a Aceros Honduras", currency: "USD", budget: 420000, counterparty: "EMP04", ic: false, note: "El archivo dice que no es entre empresas. El monto sí tiene espejo." }),
    row({ company: "EMP03", line: 4, account: "5100", name: "Combustible y mantenimiento", currency: "USD", budget: 3100000, actual: 3782000, note: "Diésel +22% y corredor nuevo" }),
    row({ company: "EMP03", line: 5, account: "6100", name: "Gastos de la sede", currency: "USD", budget: 715000 }),
    row({ company: "EMP03", line: 6, account: "6100", name: "Licencia GPS de proveedor europeo", currency: "EUR", budget: 45000, note: "Factura en euros. La empresa presupuesta en dólares." }),
    row({ company: "EMP03", line: 7, account: "6300", name: "Depreciación de flota", currency: "USD", budget: 680000 }),
    row({ company: "EMP03", line: 8, account: "1050", name: "Efectivo", currency: "USD", budget: 850000 }),
    row({ company: "EMP03", line: 9, account: "1100", name: "Activos totales", currency: "USD", budget: 12000000 }),
    row({ company: "EMP03", line: 10, account: "2100", name: "Pasivo corriente", currency: "USD", budget: 2500000 }),
    row({ company: "EMP03", line: 11, account: "2200", name: "Deuda financiera", currency: "USD", budget: 4000000 }),
    row({ company: "EMP03", line: 12, account: "3100", name: "Patrimonio", currency: "USD", budget: 5500000 }),

    row({ company: "EMP04", line: 2, account: "4100", name: "Ventas de acero en Honduras", currency: "HNL", budget: 250000000, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 3, account: "4200", name: "Ventas a Ferretería Norte", currency: "HNL", budget: 25000000, counterparty: "EMP05", ic: true, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 4, account: "5100", name: "Costo de producción", currency: "HNL", budget: 175000000, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 5, account: "5200", name: "Fletes de Logística CA", currency: "HNL", budget: 10500000, counterparty: "EMP03", ic: true, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 6, account: "6100", name: "Gastos generales", currency: "HNL", budget: 32500000, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 7, account: "6100", name: "Energía del horno", currency: "HNL", budget: 5000000, prior: 8000000, justification: "Contrato de eficiencia del horno. Menor consumo eléctrico.", fxMemo: 24.5, note: "El presupuesto baja y la razón viene en el archivo." }),
    row({ company: "EMP04", line: 8, account: "6200", name: "Cuota de servicios del holding", currency: "HNL", budget: 5000000, counterparty: "EMP06", ic: true, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 9, account: "6300", name: "Depreciación de planta", currency: "HNL", budget: 12500000, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 10, account: "TOTAL_REV", name: "Total de ventas", currency: "HNL", budget: 300000000, fxMemo: 24.5, note: "Total que no cuadra con el detalle" }),
    row({ company: "EMP04", line: 11, account: "1050", name: "Efectivo", currency: "HNL", budget: 25000000, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 12, account: "1100", name: "Activos totales", currency: "HNL", budget: 300000000, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 13, account: "2100", name: "Pasivo corriente", currency: "HNL", budget: 50000000, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 14, account: "2200", name: "Deuda financiera", currency: "HNL", budget: 75000000, fxMemo: 24.5 }),
    row({ company: "EMP04", line: 15, account: "3100", name: "Patrimonio", currency: "HNL", budget: 175000000, fxMemo: 24.5 }),

    row({ company: "EMP05", line: 2, account: "4100", name: "Ventas de mostrador", currency: "HNL", budget: 75000000, raw: "L 75,000,000.00" }),
    row({ company: "EMP05", line: 3, account: "5100", name: "Costo de mercadería", currency: "HNL", budget: 37500000, raw: "L 37,500,000.00" }),
    row({ company: "EMP05", line: 4, account: "5200", name: "Compras de acero a Aceros Honduras", currency: "HNL", budget: 25000000, counterparty: "EMP04", ic: true, raw: "L 25,000,000.00" }),
    row({ company: "EMP05", line: 5, account: "6100", name: "Nómina administrativa de sucursales", currency: "HNL", budget: 10000000, raw: "L 10,000,000.00" }),
    row({ company: "EMP05", line: 6, account: "6100", name: "Nómina administrativa de sucursales", currency: "HNL", budget: 10000000, raw: "L 10,000,000.00", note: "Misma empresa, cuenta, monto y detalle que la fila 5" }),
    row({ company: "EMP05", line: 7, account: "6100", name: "Alquileres de locales", currency: "HNL", budget: 5000000, raw: "L 5,000,000.00" }),
    row({ company: "EMP05", line: 8, account: "6100", name: "Publicidad", currency: "HNL", budget: 5000000, prior: 8000000, raw: "L 5,000,000.00", note: "Baja contra 2025 y el archivo no trae razón" }),
    row({ company: "EMP05", line: 9, account: "6300", name: "Depreciación de tienda", currency: "HNL", budget: 2500000, raw: "L 2,500,000.00" }),
    row({ company: "EMP05", line: 10, account: "1050", name: "Efectivo", currency: "HNL", budget: 10000000, raw: "L 10,000,000.00" }),
    row({ company: "EMP05", line: 11, account: "1100", name: "Activos totales", currency: "HNL", budget: 75000000, raw: "L 75,000,000.00" }),
    row({ company: "EMP05", line: 12, account: "2100", name: "Pasivo corriente", currency: "HNL", budget: 25000000, raw: "L 25,000,000.00" }),
    row({ company: "EMP05", line: 13, account: "2200", name: "Deuda financiera", currency: "HNL", budget: 12500000, raw: "L 12,500,000.00" }),
    row({ company: "EMP05", line: 14, account: "3100", name: "Patrimonio", currency: "HNL", budget: 37500000, raw: "L 37,500,000.00" }),

    row({ company: "EMP06", line: 2, account: "4100", name: "Asesoría externa", currency: "USD", budget: 250000, actual: 260000, note: "Ingreso a terceros" }),
    row({ company: "EMP06", line: 3, account: "4200", name: "Fee a Aceros del Sur", currency: "USD", budget: 300000, counterparty: "EMP01", ic: true }),
    row({ company: "EMP06", line: 4, account: "4200", name: "Fee a Aceros Honduras", currency: "USD", budget: 200000, counterparty: "EMP04", ic: true }),
    row({ company: "EMP06", line: 5, account: "6100", name: "Nómina y nube", currency: "USD", budget: 520000, actual: 545000, note: "Equipo corporativo y licencias" }),
    row({ company: "EMP06", line: 6, account: "9999", name: "Gastos varios sin clasificar", currency: "USD", budget: 150000, note: "Cuenta fuera del catálogo" }),
    row({ company: "EMP06", line: 7, account: "6300", name: "Amortización de software", currency: "USD", budget: 65000 }),
    row({ company: "EMP06", line: 8, account: "1050", name: "Efectivo", currency: "USD", budget: 620000 }),
    row({ company: "EMP06", line: 9, account: "1100", name: "Activos totales", currency: "USD", budget: 2400000 }),
    row({ company: "EMP06", line: 10, account: "2100", name: "Pasivo corriente", currency: "USD", budget: 280000 }),
    row({ company: "EMP06", line: 11, account: "2200", name: "Deuda corporativa", currency: "USD", budget: 500000 }),
    row({ company: "EMP06", line: 12, account: "3100", name: "Patrimonio", currency: "USD", budget: 1620000 })
  ];

  const PASTED = [
    { indicator: "ROIC", value: 0.165, source: "mvp/data/maestros/kpis_pegados.csv", line: 3, origin: "Hoja local de Aceros Honduras, copiada a mano" },
    { indicator: "ROCE", value: 0.22, source: "mvp/data/maestros/kpis_pegados.csv", line: 4, origin: "Hoja local de Aceros Honduras, copiada a mano" },
    { indicator: "EVA", value: 850000, source: "mvp/data/maestros/kpis_pegados.csv", line: 5, origin: "Hoja local de Aceros Honduras, copiada a mano" }
  ];

  const INITIATIVES = [
    {
      id: "I1",
      title: "Horno de reciclaje de chatarra",
      capex: 2000000,
      annualEbit: 900000,
      tags: ["reciclaje", "sostenibilidad"],
      file: "mvp/data/iniciativas/01_horno_reciclaje.txt"
    },
    {
      id: "I2",
      title: "Tren de laminación de productos largos",
      capex: 18000000,
      annualEbit: 3200000,
      tags: ["importacion", "largos"],
      file: "mvp/data/iniciativas/02_laminacion_largos.txt"
    },
    {
      id: "I3",
      title: "Remodelación de oficinas del holding",
      capex: 450000,
      annualEbit: 0,
      tags: ["oficinas"],
      file: "mvp/data/iniciativas/03_oficinas.txt"
    },
    {
      id: "I4",
      title: "Trazabilidad y debida diligencia de chatarra",
      capex: 180000,
      annualEbit: 250000,
      tags: ["gobernanza", "etica", "reciclaje"],
      file: "mvp/data/iniciativas/04_trazabilidad.txt"
    }
  ];

  const MARKET = {
    label: "Hipótesis de la conversación. No salen del presupuesto cargado.",
    revenueRef: 1000000000,
    marketLow: 20000000000,
    marketHigh: 35000000000,
    multiple: 20,
    importShareGt: 0.4
  };

  window.RRE = { COMPANIES, FX, PARAMS, CATALOG, ROWS, PASTED, INITIATIVES, MARKET };
})();
