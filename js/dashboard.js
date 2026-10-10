const SUPABASE_URL = "https://ffiuayjfnhlvxgktxbal.supabase.co";
const SUPABASE_KEY = "sb_publishable_F8h3Zay5r9pVATEnvAIa-Q_bnaXgj1U";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* Paleta Mantenimiento: acero + ámbar + rojo */
const C = {
  gold: "#F59E0B", goldLight: "#FBBF24", goldDark: "#B45309",
  orange: "#EF6C00", amber: "#FFB300",
  green: "#10B981", red: "#EF4444", blue: "#3B82F6",
  other: "#3A4250", text: "#E8ECF2", dim: "#93A0B8", faint: "#5A6678",
  grid: "rgba(147, 160, 184, 0.10)", panel: "#0D1420",
};
const PALETTE = [C.gold, C.blue, C.green, C.orange, C.red, C.goldLight, C.amber];

Chart.register(ChartDataLabels);
Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = C.dim;
Chart.defaults.animation.duration = 450;
Chart.defaults.plugins.datalabels.display = false;
Chart.defaults.plugins.legend.display = false;

const state = { camionetas: null, mercedes: null };
const charts = {};
let listenersReady = false;
let subActualM = "camionetas";

const fmt = (v, d = 0) => Number(v).toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const round = (v, d = 1) => Number(Number(v).toFixed(d));
const truncar = (s, n = 30) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const $ = (id) => document.getElementById(id);
function hexRgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; }

async function cargarHoja(nombre) {
  const { data, error } = await supabaseClient.from("dashboard_data").select("row_index, data").eq("sheet_name", nombre).order("row_index", { ascending: true }).limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0].data;
}

const centerText = {
  id: "centerText",
  afterDraw(chart, _args, opts) {
    if (!opts || !opts.title) return;
    const { ctx, chartArea: a } = chart;
    const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = C.text; ctx.font = "700 20px Sora, sans-serif";
    ctx.fillText(opts.title, x, y - 8);
    ctx.fillStyle = C.dim; ctx.font = "500 11px 'IBM Plex Sans', sans-serif";
    ctx.fillText(opts.sub || "", x, y + 16); ctx.restore();
  },
};

function tooltipStyle() {
  return {
    backgroundColor: "#070B12", titleColor: C.text, bodyColor: C.text,
    borderColor: "#3A4250", borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4,
    callbacks: { label: (c) => ` ${c.dataset.label ? c.dataset.label + ": " : c.label ? c.label + ": " : ""}${fmt(c.parsed.y !== undefined ? c.parsed.y : c.parsed)}` },
  };
}
function mount(id, config) {
  const canvas = $(id); if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const vacio = !config.data.labels || config.data.labels.length === 0;
  canvas.parentElement.classList.toggle("is-empty", vacio);
  if (vacio) return;
  charts[id] = new Chart(canvas, config);
}
function gradV(c1, c2) { return (ctx) => { const a = ctx.chart.chartArea; if (!a) return c1; const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; }; }
function gradH(c1, c2) { return (ctx) => { const a = ctx.chart.chartArea; if (!a) return c1; const g = ctx.chart.ctx.createLinearGradient(a.left, 0, a.right, 0); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; }; }
const scaleX = () => ({ grid: { display: false }, border: { color: "#3A4250" }, ticks: { color: C.dim, maxRotation: 0, autoSkipPadding: 14 } });
const scaleY = (max) => ({ beginAtZero: true, suggestedMax: max, grid: { color: C.grid }, border: { display: false }, ticks: { color: C.faint, callback: (v) => fmt(v), maxTicksLimit: 6 } });
const labelBase = { color: C.text, font: { family: "'IBM Plex Sans', sans-serif", weight: "600", size: 10.5 } };

function renderColumns(id, labels, data, color1 = C.goldLight, color2 = C.goldDark, decimals = 0) {
  const max = Math.max(...data, 0);
  mount(id, {
    type: "bar",
    data: { labels, datasets: [{ data, borderRadius: { topLeft: 7, topRight: 7 }, borderSkipped: false, maxBarThickness: 54, backgroundColor: gradV(color1, color2) }] },
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 14 } },
      plugins: { tooltip: tooltipStyle(), datalabels: { ...labelBase, display: labels.length <= 14, anchor: "end", align: "end", offset: 3, formatter: (v) => fmt(v, decimals) } },
      scales: { x: scaleX(), y: scaleY(max * 1.22) } },
  });
}
function renderScrollHBar(id, labels, data, color1 = C.goldDark, color2 = C.goldLight, decimals = 0) {
  const ctx = $(id); if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  const wrap = ctx.parentElement;
  wrap.style.maxHeight = "420px"; wrap.style.overflowY = "auto"; wrap.style.overflowX = "hidden";
  ctx.style.height = Math.max(420, labels.length * 32) + "px"; ctx.style.maxHeight = "none";
  const max = Math.max(...data, 0);
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, borderRadius: 6, borderSkipped: false, barThickness: 16, backgroundColor: gradH(color1, color2) }] },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, layout: { padding: { right: 12 } },
      plugins: { tooltip: tooltipStyle(), datalabels: { ...labelBase, display: true, anchor: "end", align: "right", offset: 4, formatter: (v) => fmt(v, decimals) } },
      scales: { x: { ...scaleY(max * 1.18), ticks: { color: C.faint, callback: (v) => fmt(v), maxTicksLimit: 5 } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: C.text, callback(v) { return truncar(this.getLabelForValue(v), 28); } } } } },
  });
}
function renderDoughnut(id, labels, data, centerTitle, centerSub, decimals = 0) {
  const total = data.reduce((a, b) => a + Number(b), 0);
  const colores = labels.map((l, i) => (l === "Otros" ? C.other : PALETTE[i % PALETTE.length]));
  mount(id, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: colores, borderColor: "#0D1420", borderWidth: 3, hoverOffset: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "68%",
      plugins: {
        tooltip: { ...tooltipStyle(), callbacks: { label: (c) => ` ${c.label}: ${fmt(c.parsed, decimals)} (${total ? Math.round((c.parsed / total) * 100) : 0}%)` } },
        datalabels: { ...labelBase, display: (c) => total > 0 && c.dataset.data[c.dataIndex] / total >= 0.06, color: "#0D1420", font: { family: "'IBM Plex Sans', sans-serif", weight: "700", size: 11 }, formatter: (v) => Math.round((v / total) * 100) + "%" },
        centerText: { title: centerTitle, sub: centerSub },
      } },
    plugins: [centerText],
  });
  const lg = $(id + "Legend");
  if (lg) lg.innerHTML = labels.map((l, i) => `<div class="legend-item"><i style="background:${colores[i]}"></i><span title="${l}">${truncar(l, 22)}</span><b>${total ? Math.round((data[i] / total) * 100) : 0}%</b></div>`).join("");
}
function renderArea(id, labels, datasets, { decimals = 0 } = {}) {
  const maxAll = Math.max(...datasets.flatMap((d) => d.data), 0);
  mount(id, {
    type: "line",
    data: { labels, datasets: datasets.map((d) => ({
      label: d.label, data: d.data, borderColor: d.color, borderWidth: 2.5, tension: 0.35, fill: true,
      backgroundColor: (ctx) => { const a = ctx.chart.chartArea; if (!a) return hexRgba(d.color, 0.15); const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, hexRgba(d.color, 0.34)); g.addColorStop(1, hexRgba(d.color, 0)); return g; },
      pointBackgroundColor: d.color, pointBorderColor: "#0D1420", pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
      datalabels: { display: false },
    })) },
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 16, right: 10 } },
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: datasets.length > 1, position: "bottom", labels: { color: C.dim, usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 14 } }, tooltip: tooltipStyle() },
      scales: { x: scaleX(), y: scaleY(maxAll * 1.15) } },
  });
}

function heroCard({ title, value, unit, badge, note }) {
  return `<article class="card hero span-3">
    <span class="eyebrow">Indicador principal</span>
    <h3>${title}</h3>
    <div class="hero-val">${value}<small>${unit}</small></div>
    <p class="hero-note">${note}</p>
    <span class="pill pill-orange">${badge}</span>
  </article>`;
}
function kpiCard({ icon, tone, title, value, unit, pct, barLabel, foot }) {
  return `<article class="card kpi tone-${tone} span-3">
    <div class="kpi-head"><span class="kpi-ico"><i class="fas ${icon}"></i></span><h3>${title}</h3></div>
    <div class="kpi-val">${value}<small>${unit}</small></div>
    <div class="bar"><i style="width:${Math.min(100, Math.max(0, pct))}%"></i></div>
    <div class="kpi-foot"><span>${barLabel}</span><b>${fmt(pct, 1)}%</b></div>
    <p class="kpi-note">${foot}</p>
  </article>`;
}
function plotCard(id, titulo, sub, span, size = "") {
  return `<article class="card span-${span}"><div class="card-head"><h3>${titulo}</h3><p>${sub}</p></div>
    <div class="plot ${size}"><canvas id="${id}"></canvas><div class="plot-empty"><i class="fas fa-chart-simple"></i><span>Sin datos para mostrar</span></div></div></article>`;
}
function donutCard(id, titulo, sub, span) {
  return `<article class="card span-${span}"><div class="card-head"><h3>${titulo}</h3><p>${sub}</p></div>
    <div class="plot donut"><canvas id="${id}"></canvas><div class="plot-empty"><i class="fas fa-chart-pie"></i><span>Sin datos para mostrar</span></div></div>
    <div class="legend" id="${id}Legend"></div></article>`;
}
function slotCard(id, titulo, sub, span) {
  return `<article class="card span-${span}"><div class="card-head"><h3>${titulo}</h3><p>${sub}</p></div><div id="${id}" class="mini-table"></div></article>`;
}
function tabla(encabezados, filas) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${encabezados.map((h) => `<th class="${h.num ? "num" : ""}">${h.t}</th>`).join("")}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c, i) => `<td class="${encabezados[i].num ? "num" : ""} ${i === 0 ? "name" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function vacioMensaje(span = 12) {
  return `<article class="card span-${span}"><div class="plot-empty" style="display:flex;position:static;min-height:200px"><i class="fas fa-database"></i><span>No se encontraron datos.</span></div></article>`;
}

function construirLayoutInterno() {
  // Camionetas
  $("filtersCam").innerHTML = `
    <div class="filter-chip"><i class="fas fa-tags"></i>
      <select id="fCamProyecto" class="filter-select"><option value="">Proyecto</option></select></div>
    <div class="filter-chip"><i class="fas fa-file-contract"></i>
      <select id="fCamContrato" class="filter-select"><option value="">Contrato</option></select></div>
    <div class="filter-chip"><i class="fas fa-truck"></i>
      <select id="fCamTipo" class="filter-select"><option value="">Tipo equipo</option></select></div>
    <button id="clearCam" class="btn-clear-chips"><i class="fas fa-eraser"></i> Limpiar</button>`;
  $("gridCam").innerHTML = [
    donutCard("cmTipo", "Total vehículos por tipo", "Distribución por equipo", 6),
    plotCard("cmContrato", "Vehículos por contrato", "Contratos activos", 6, "tall"),
    plotCard("cmFrec", "Mantenimientos por frecuencia", "5KM · 7.5KM · etc.", 6, "tall"),
    plotCard("cmMes", "Último MTTO por mes", "Evolución mensual", 6, "tall"),
    slotCard("cmProx", "Vehículos con próximo MTTO", "Placa · Proyecto · Próximo", 12),
    slotCard("cmSin", "Vehículos sin último MTTO", "Placa · Proyecto · Contrato", 12),
  ].join("");

  // Mercedes
  $("filtersMer").innerHTML = `
    <div class="filter-chip"><i class="fas fa-tags"></i>
      <select id="fMerProyecto" class="filter-select"><option value="">Proyecto</option></select></div>
    <div class="filter-chip"><i class="fas fa-file-contract"></i>
      <select id="fMerContrato" class="filter-select"><option value="">Contrato</option></select></div>
    <div class="filter-chip"><i class="fas fa-truck"></i>
      <select id="fMerTipo" class="filter-select"><option value="">Tipo equipo</option></select></div>
    <button id="clearMer" class="btn-clear-chips"><i class="fas fa-eraser"></i> Limpiar</button>`;
  $("gridMer").innerHTML = [
    donutCard("meTipo", "Total vehículos por tipo", "Distribución por equipo", 6),
    plotCard("meContrato", "Vehículos por contrato", "Contratos activos", 6, "tall"),
    plotCard("meFrec", "Mantenimientos por frecuencia", "5KM · 7.5KM · etc.", 6, "tall"),
    plotCard("meMes", "Último MTTO por mes", "Evolución mensual", 6, "tall"),
    slotCard("meProx", "Vehículos con próximo MTTO", "Placa · Proyecto · Próximo", 12),
    slotCard("meSin", "Vehículos sin último MTTO", "Placa · Proyecto · Contrato", 12),
  ].join("");
}

function llenarSelect(id, valores, etiqueta) {
  const sel = $(id); if (!sel) return;
  const actual = sel.value;
  sel.innerHTML = `<option value="">${etiqueta}</option>`;
  valores.forEach((v) => { const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o); });
  if (actual && valores.includes(actual)) sel.value = actual;
}
function llenarSegmentadores() {
  [["camionetas", "fCamProyecto", "fCamContrato", "fCamTipo"], ["mercedes", "fMerProyecto", "fMerContrato", "fMerTipo"]].forEach(([key, idProy, idCont, idTipo]) => {
    const d = state[key]; if (!d) return;
    llenarSelect(idProy, [...new Set(d.filas.map(f => f.proyecto))].sort(), "Proyecto");
    llenarSelect(idCont, [...new Set(d.filas.map(f => f.contrato))].sort(), "Contrato");
    llenarSelect(idTipo, [...new Set(d.filas.map(f => f.equipo))].sort(), "Tipo equipo");
  });
}

function filtroActivo(id) { const el = $(id); return el ? el.value : ""; }

function renderSub(key) {
  const d = state[key];
  const pref = key === "camionetas" ? "Cam" : "Mer";
  const sub = key === "camionetas" ? "camionetas" : "mercedes";
  if (!d) { $(key === "camionetas" ? "gridCam" : "gridMer").innerHTML = vacioMensaje(12); $(key === "camionetas" ? "kpiCam" : "kpiMer").innerHTML = ""; return; }

  const fP = filtroActivo(`f${pref}Proyecto`);
  const fC = filtroActivo(`f${pref}Contrato`);
  const fT = filtroActivo(`f${pref}Tipo`);

  const filas = d.filas.filter(f => {
    if (fP && f.proyecto !== fP) return false;
    if (fC && f.contrato !== fC) return false;
    if (fT && f.equipo !== fT) return false;
    return true;
  });

  const sinUlt = filas.filter(f => !f.ultMtto);
  const conProx = filas.filter(f => f.proxMtto);
  const kms = filas.filter(f => f.kmAct > 0);
  const kmProm = kms.length ? Math.round(kms.reduce((a, x) => a + x.kmAct, 0) / kms.length) : 0;

  const porTipo = {}, porContrato = {}, porFrec = {}, porMes = {};
  filas.forEach(f => {
    porTipo[f.equipo] = (porTipo[f.equipo] || 0) + 1;
    porContrato[f.contrato] = (porContrato[f.contrato] || 0) + 1;
    porFrec[f.frecuencia] = (porFrec[f.frecuencia] || 0) + 1;
    if (f.fechaUlt) {
      const mes = f.fechaUlt.substring(0, 7);
      porMes[mes] = (porMes[mes] || 0) + 1;
    }
  });

  const kpiId = key === "camionetas" ? "kpiCam" : "kpiMer";
  $(kpiId).innerHTML = [
    heroCard({
      title: "Total vehículos", value: fmt(filas.length), unit: "",
      note: `${Object.keys(porTipo).length} tipos · ${Object.keys(porContrato).length} contratos`,
      badge: `${fmt(sinUlt.length)} sin último MTTO`,
    }),
    kpiCard({ icon: "fa-calendar-check", tone: "gold", title: "Con próximo MTTO", value: fmt(conProx.length), unit: "",
      pct: filas.length ? (conProx.length / filas.length) * 100 : 0, barLabel: "Del total",
      foot: `Mantenimientos programados` }),
    kpiCard({ icon: "fa-triangle-exclamation", tone: "orange", title: "Sin último MTTO", value: fmt(sinUlt.length), unit: "",
      pct: filas.length ? (sinUlt.length / filas.length) * 100 : 0, barLabel: "Del total",
      foot: `Revisar historial` }),
    kpiCard({ icon: "fa-tachometer-alt", tone: "green", title: "KM promedio", value: fmt(kmProm), unit: "km",
      pct: 100, barLabel: "En la flota",
      foot: `${kms.length} vehículos con KM` }),
  ].join("");

  const pfx = key === "camionetas" ? "cm" : "me";

  const tipoArr = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  const top6 = tipoArr.slice(0, 6);
  const otros = tipoArr.slice(6).reduce((a, e) => a + e[1], 0);
  const td = top6.map(t => t[1]); const tl = top6.map(t => t[0]);
  if (otros > 0) { td.push(otros); tl.push("Otros"); }
  renderDoughnut(`${pfx}Tipo`, tl, td, fmt(filas.length), "vehículos");

  const contArr = Object.entries(porContrato).sort((a, b) => b[1] - a[1]);
  renderScrollHBar(`${pfx}Contrato`, contArr.map(c => truncar(c[0], 25)), contArr.map(c => c[1]), C.goldDark, C.goldLight, 0);

  const frecArr = Object.entries(porFrec).sort((a, b) => b[1] - a[1]);
  renderColumns(`${pfx}Frec`, frecArr.map(f => f[0]), frecArr.map(f => f[1]), C.goldLight, C.goldDark, 0);

  const mesesArr = Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  renderArea(`${pfx}Mes`, mesesArr.map(m => m[0]), [
    { label: "Mantenimientos", color: C.gold, data: mesesArr.map(m => m[1]) },
  ], { decimals: 0 });

  const proxId = key === "camionetas" ? "cmProx" : "meProx";
  const proxList = conProx.slice(0, 40);
  $(proxId).innerHTML = proxList.length
    ? tabla(
        [{ t: "Placa" }, { t: "Proyecto" }, { t: "Contrato" }, { t: "Equipo" }, { t: "Último MTTO" }, { t: "Próximo MTTO" }],
        proxList.map(f => [f.placa, truncar(f.proyecto, 14), truncar(f.contrato, 14), truncar(f.equipo, 18), f.ultMtto || "-", f.proxMtto || "-"])
      )
    : `<div class="plot-empty" style="display:flex;position:static;min-height:120px"><i class="fas fa-check-circle"></i><span>Sin programados</span></div>`;

  const sinId = key === "camionetas" ? "cmSin" : "meSin";
  const sinList = sinUlt.slice(0, 40);
  $(sinId).innerHTML = sinList.length
    ? tabla(
        [{ t: "Placa" }, { t: "Proyecto" }, { t: "Contrato" }, { t: "Equipo" }, { t: "Marca/Modelo" }, { t: "Obs." }],
        sinList.map(f => [f.placa, truncar(f.proyecto, 14), truncar(f.contrato, 14), truncar(f.equipo, 18), truncar(`${f.marca} ${f.modelo}`, 20), f.obs || "-"])
      )
    : `<div class="plot-empty" style="display:flex;position:static;min-height:120px"><i class="fas fa-check-circle"></i><span>Sin pendientes</span></div>`;
}

function cambiarSubM(sub) {
  subActualM = sub;
  document.querySelectorAll("#subTabsM .subtab").forEach(t => t.classList.toggle("active", t.dataset.sub === sub));
  ["camionetas", "mercedes"].forEach(s => {
    const el = document.getElementById("subM-" + s);
    if (el) el.style.display = s === sub ? "block" : "none";
  });
  renderSub(sub);
  requestAnimationFrame(() => Object.values(charts).forEach(c => c.resize()));
}

function engancharEventos() {
  if (listenersReady) return;
  listenersReady = true;

  document.querySelectorAll("#subTabsM .subtab").forEach(t => {
    t.addEventListener("click", () => cambiarSubM(t.dataset.sub));
  });
  ["fCamProyecto","fCamContrato","fCamTipo"].forEach(id => {
    const el = $(id); if (el) el.addEventListener("change", () => renderSub("camionetas"));
  });
  ["fMerProyecto","fMerContrato","fMerTipo"].forEach(id => {
    const el = $(id); if (el) el.addEventListener("change", () => renderSub("mercedes"));
  });
  $("clearCam").addEventListener("click", () => {
    ["fCamProyecto","fCamContrato","fCamTipo"].forEach(x => { const el = $(x); if (el) el.value = ""; });
    renderSub("camionetas");
  });
  $("clearMer").addEventListener("click", () => {
    ["fMerProyecto","fMerContrato","fMerTipo"].forEach(x => { const el = $(x); if (el) el.value = ""; });
    renderSub("mercedes");
  });

  document.querySelectorAll(".js-refresh").forEach((b) =>
    b.addEventListener("click", async () => {
      document.querySelectorAll(".js-refresh").forEach((x) => { x.disabled = true; x.classList.add("is-loading"); });
      try { await cargarTodo(); } catch (err) { console.error(err); }
      document.querySelectorAll(".js-refresh").forEach((x) => { x.disabled = false; x.classList.remove("is-loading"); });
    })
  );
}

async function cargarTodo() {
  const [cam, mer] = await Promise.all([
    cargarHoja("MANT_CAMIONETAS").catch(() => null),
    cargarHoja("MANT_MERCEDES").catch(() => null),
  ]);
  state.camionetas = cam;
  state.mercedes = mer;

  const count = [cam, mer].filter(Boolean).length;
  $("stRegistros").textContent = `${count} / 2`;
  $("stSync").textContent = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  const total = (cam?.kpis?.totalVehiculos || 0) + (mer?.kpis?.totalVehiculos || 0);
  $("chipVeh").textContent = fmt(total);
  $("chipSync").textContent = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  llenarSegmentadores();
  renderSub(subActualM);
}

(async function init() {
  construirLayoutInterno();
  try {
    await cargarTodo();
    $("loading").hidden = true;
    $("topbar").hidden = false;
    $("shell").hidden = false;
    $("mantenimiento").hidden = false;
    engancharEventos();
    renderSub(subActualM);
  } catch (err) {
    console.error(err);
    $("loading").innerHTML = `<div class="error-box"><i class="fas fa-triangle-exclamation"></i><h3>No se pudieron cargar los datos</h3><p>${err.message || err}</p></div>`;
  }
})();