self.onmessage = function (e) {
  const { tipo, rows } = e.data;
  try {
    let resultado;
    if (tipo === "MANTOS CAMIONETAS" || tipo === "MANT_CAMIONETAS") resultado = procesarMantos(rows, "CAMIONETAS");
    else if (tipo === "MANTOS MERCEDES" || tipo === "MANT_MERCEDES") resultado = procesarMantos(rows, "MERCEDES");
    else throw new Error("Tipo desconocido: " + tipo);
    self.postMessage({ ok: true, tipo, resultado });
  } catch (err) {
    self.postMessage({ ok: false, tipo, error: err.message });
  }
};

function norm(v) { return v !== undefined && v !== null ? v.toString().trim() : ""; }
function num(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = v.toString().replace(",", ".").replace(/[^0-9.-]/g, "");
  return parseFloat(s) || 0;
}
function fechaOrdenable(valor) {
  const s = norm(valor);
  if (!s) return "";
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s);
    const d = new Date((serial - 25569) * 86400 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (m) {
    let a = +m[3]; if (a < 100) a += 2000;
    return `${a}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
  }
  return s;
}
const MESES_ABREV = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function etiquetaFecha(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return String(+m[3]).padStart(2, "0") + " " + MESES_ABREV[+m[2] - 1];
}

function procesarMantos(rows, grupo) {
  let headerIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const f = rows[i].map(c => (c || "").toString().trim().toLowerCase());
    if (f.includes("placa") && f.includes("equipo")) { headerIndex = i; break; }
  }
  const headers = rows[headerIndex].map((h, i) => (h || "").toString().trim() || `Columna_${i + 1}`);

  const cItem = headers.findIndex(h => h.toLowerCase() === "ítem" || h.toLowerCase() === "item");
  const cProyecto = headers.findIndex(h => h.toLowerCase() === "proyecto");
  const cContrato = headers.findIndex(h => h.toLowerCase() === "contrato");
  const cCodInt = headers.findIndex(h => h.toLowerCase().includes("cod.int"));
  const cPlaca = headers.findIndex(h => h.toLowerCase() === "placa");
  const cEquipo = headers.findIndex(h => h.toLowerCase() === "equipo");
  const cMarca = headers.findIndex(h => h.toLowerCase() === "marca");
  const cModelo = headers.findIndex(h => h.toLowerCase() === "modelo");
  const cObs = headers.findIndex(h => h.toLowerCase() === "obs");
  const cFrec = headers.findIndex(h => h.toLowerCase().includes("frecuencia de mtto"));
  const cUltMtto = headers.findIndex(h => h.toLowerCase().includes("ultimo mtto") || h.toLowerCase().includes("último mtto"));
  const cFechaUlt = headers.findIndex(h => h.toLowerCase().includes("fecha de ultimo") || h.toLowerCase().includes("fecha de último"));
  const cProxMtto = headers.findIndex(h => h.toLowerCase().includes("proximo mtto") || h.toLowerCase().includes("próximo mtto"));
  const cKmAct = headers.findIndex(h => h.toLowerCase().includes("km actual"));

  const filas = [];
  const porProyecto = {}, porContrato = {}, porTipo = {}, porMarca = {}, porFrecuencia = {}, porMes = {};
  let conObs = 0, sinUltMtto = 0, conProx = 0;
  let sumaKm = 0, countKm = 0;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const placa = norm(r[cPlaca]);
    if (!placa) continue;

    const proyecto = norm(r[cProyecto]) || "Sin proyecto";
    const contrato = norm(r[cContrato]) || "Sin contrato";
    const equipo = norm(r[cEquipo]) || "Sin equipo";
    const marca = norm(r[cMarca]) || "Sin marca";
    const modelo = norm(r[cModelo]);
    const obs = norm(r[cObs]);
    const frecuencia = norm(r[cFrec]) || "Sin frecuencia";
    const ultMtto = norm(r[cUltMtto]);
    const proxMtto = norm(r[cProxMtto]);
    const fechaUlt = fechaOrdenable(r[cFechaUlt]);
    const fechaEt = fechaUlt ? etiquetaFecha(fechaUlt) : "";
    const kmAct = num(r[cKmAct]);

    if (obs) conObs++;
    if (!ultMtto) sinUltMtto++;
    if (proxMtto) conProx++;
    if (kmAct > 0) { sumaKm += kmAct; countKm++; }

    if (!porProyecto[proyecto]) porProyecto[proyecto] = { nombre: proyecto, count: 0 };
    porProyecto[proyecto].count++;

    if (!porContrato[contrato]) porContrato[contrato] = { nombre: contrato, count: 0 };
    porContrato[contrato].count++;

    if (!porTipo[equipo]) porTipo[equipo] = { nombre: equipo, count: 0 };
    porTipo[equipo].count++;

    const mk = marca + " " + modelo;
    if (!porMarca[mk]) porMarca[mk] = { nombre: mk.trim(), count: 0 };
    porMarca[mk].count++;

    if (!porFrecuencia[frecuencia]) porFrecuencia[frecuencia] = { nombre: frecuencia, count: 0 };
    porFrecuencia[frecuencia].count++;

    if (fechaUlt) {
      const mes = fechaUlt.substring(0, 7);
      if (!porMes[mes]) porMes[mes] = { mes, count: 0 };
      porMes[mes].count++;
    }

    filas.push({ item: norm(r[cItem]), proyecto, contrato, codInt: norm(r[cCodInt]), placa, equipo, marca, modelo, obs, frecuencia, ultMtto, proxMtto, fechaUlt, fechaEt, kmAct });
  }

  return {
    tipo: "MANT_" + grupo,
    kpis: {
      totalVehiculos: filas.length,
      conObservacion: conObs,
      sinUltimoMtto: sinUltMtto,
      conProximoMtto: conProx,
      kmPromedio: countKm ? Math.round(sumaKm / countKm) : 0,
    },
    porProyecto: Object.values(porProyecto).sort((a, b) => b.count - a.count),
    porContrato: Object.values(porContrato).sort((a, b) => b.count - a.count),
    porTipo: Object.values(porTipo).sort((a, b) => b.count - a.count),
    porMarca: Object.values(porMarca).sort((a, b) => b.count - a.count),
    porFrecuencia: Object.values(porFrecuencia).sort((a, b) => b.count - a.count),
    porMes: Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes)),
    filas,
  };
}