const SUPABASE_URL = "https://ffiuayjfnhlvxgktxbal.supabase.co";
const SUPABASE_KEY = "sb_publishable_F8h3Zay5r9pVATEnvAIa-Q_bnaXgj1U";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const fileInput = document.getElementById('excelFile');
const sheetStatus = document.getElementById('sheetStatus');
const sheetList = document.getElementById('sheetList');
const btnSubir = document.getElementById('btnSubir');
const mensaje = document.getElementById('mensaje');
const progressBox = document.getElementById('progressBox');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const progressPct = document.getElementById('progressPct');
const tipoDetected = document.getElementById('tipoDetected');
const tipoNombre = document.getElementById('tipoNombre');

const HOJAS_VALIDAS = {
  "MANTOS CAMIONETAS": "MANT_CAMIONETAS",
  "MANTOS MERCEDES": "MANT_MERCEDES",
};

let resultados = {};

function setProgreso(pct, label) {
  progressBox.style.display = 'block';
  progressBar.style.width = pct + '%';
  progressPct.textContent = Math.round(pct) + '%';
  if (label) progressLabel.textContent = label;
}
function ocultarProgreso() { setTimeout(() => { progressBox.style.display = 'none'; }, 1500); }

function procesarEnWorker(tipo, rows) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('js/worker.js');
    worker.onmessage = (e) => {
      const data = e.data;
      worker.terminate();
      if (data.ok) resolve(data.resultado);
      else reject(new Error(data.error || 'Error en worker'));
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error('Error del worker: ' + err.message));
    };
    worker.postMessage({ tipo, rows });
  });
}

fileInput.addEventListener('change', async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  resultados = {};
  sheetList.innerHTML = '';
  sheetStatus.style.display = 'none';
  tipoDetected.style.display = 'none';
  mensaje.className = 'mensaje';
  mensaje.textContent = '';

  try {
    setProgreso(5, 'Leyendo archivo…');
    const data = new Uint8Array(await file.arrayBuffer());

    setProgreso(15, 'Abriendo Excel…');
    const workbook = XLSX.read(data, { type: 'array', cellDates: false, cellNF: false, cellStyles: false });

    const hojasEncontradas = Object.keys(HOJAS_VALIDAS).filter(h => workbook.SheetNames.includes(h));
    if (hojasEncontradas.length === 0) {
      setProgreso(100, 'Error');
      mostrarMensaje('El Excel debe tener las hojas "MANTOS CAMIONETAS" y "MANTOS MERCEDES".', 'error');
      ocultarProgreso();
      return;
    }

    tipoNombre.textContent = hojasEncontradas.join(", ");
    tipoDetected.style.display = 'flex';

    const totalHojas = hojasEncontradas.length;
    for (let idx = 0; idx < totalHojas; idx++) {
      const nombreHoja = hojasEncontradas[idx];
      const tipoKey = HOJAS_VALIDAS[nombreHoja];
      const pctBase = 20 + (idx / totalHojas) * 70;

      setProgreso(pctBase, `Leyendo ${nombreHoja}…`);
      const worksheet = workbook.Sheets[nombreHoja];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });

      setProgreso(pctBase + 15, `Procesando ${nombreHoja} (${rows.length} filas)…`);
      const agregado = await procesarEnWorker(nombreHoja, rows);
      resultados[tipoKey] = agregado;

      const li = document.createElement('li');
      li.innerHTML = `<i class="fas fa-check-circle"></i> ${nombreHoja} · ${rows.length} filas procesadas`;
      sheetList.appendChild(li);
    }

    setProgreso(100, 'Procesamiento completo');
    sheetStatus.style.display = 'block';
    mostrarMensaje(`Listo para subir (${totalHojas} hojas).`, 'ok');
    ocultarProgreso();
  } catch (err) {
    console.error(err);
    setProgreso(100, 'Error');
    mostrarMensaje('❌ Error: ' + err.message, 'error');
    ocultarProgreso();
  }
});

btnSubir.addEventListener('click', async function () {
  if (Object.keys(resultados).length === 0) { mostrarMensaje('Primero selecciona el Excel.', 'error'); return; }
  btnSubir.disabled = true;
  btnSubir.textContent = 'Subiendo…';
  setProgreso(0, 'Subiendo a Supabase…');
  try {
    const keys = Object.keys(resultados);
    for (let i = 0; i < keys.length; i++) {
      const sheetName = keys[i];
      const payload = resultados[sheetName];
      const pct = ((i + 1) / keys.length) * 100;
      setProgreso(pct * 0.5, `Borrando datos anteriores de ${sheetName}…`);
      await supabaseClient.from('dashboard_data').delete().eq('sheet_name', sheetName);
      setProgreso(pct * 0.5 + 10, `Insertando ${sheetName}…`);
      const { error } = await supabaseClient.from('dashboard_data').insert([{ sheet_name: sheetName, row_index: 0, data: payload }]);
      if (error) throw error;
      setProgreso(pct, `${sheetName} subido`);
    }
    setProgreso(100, '¡Listo!');
    mostrarMensaje('✅ Proceso terminado.', 'ok');
    resultados = {};
    sheetStatus.style.display = 'none';
    fileInput.value = '';
    ocultarProgreso();
  } catch (err) {
    console.error(err);
    mostrarMensaje('❌ Error: ' + err.message, 'error');
    setProgreso(100, 'Error');
    ocultarProgreso();
  } finally {
    btnSubir.disabled = false;
    btnSubir.textContent = 'Subir a Supabase';
  }
});

function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = 'mensaje ' + tipo;
}