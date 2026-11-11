/* =========================================================
   PeakSet · Lógica de la Landing Page (Desktop + Responsive)
   HU: 001-005, 007-011, 014-017, 019, 026-029, 031-033,
       036, 039-041, 044-046, 051
   ========================================================= */
'use strict';


/* ---------- 1. Datos de ejemplo (tomados de los mockups) ---------- */
const EXERCISES = [
  { name: 'Sentadilla con barra', sets: 4, load: 60,  reps: 8  },
  { name: 'Prensa de piernas',    sets: 3, load: 100, reps: 12 },
  { name: 'Curl femoral',         sets: 3, load: 40,  reps: 10 },
  { name: 'Elevación de gemelos', sets: 3, load: 50,  reps: 15 }
];

const PAST_SESSIONS = [
  { date: '28 oct', day: 28, text: 'Sentadilla 60 kg × 8 (4 series)' },
  { date: '25 oct', day: 25, text: 'Sentadilla 57,5 kg × 8 (4 series)' },
  { date: '21 oct', day: 21, text: 'Sentadilla 55 kg × 8 (4 series)' }
];

const CLIENTS = [
  { name: 'Ana Torres', group: 'Piernas', exercise: 'Sentadilla con barra', load: 60,  reps: 8,  sets: 4 },
  { name: 'Luis Ramos', group: 'Espalda', exercise: 'Remo con barra',       load: 50,  reps: 10, sets: 3 },
  { name: 'Marta Díaz', group: 'Piernas', exercise: 'Prensa de piernas',    load: 100, reps: 12, sets: 3 }
];

const NAV_ITEMS = {
  atleta: [
    ['train',   'Mi entrenamiento'],
    ['routine', 'Mis rutinas'],
    ['history', 'Historial']
  ],
  entrenador: [
    ['clients', 'Clientes']
  ]
};

const VIEW_TITLES = {
  train:   'Mi entrenamiento',
  routine: 'Mis rutinas',
  history: 'Historial',
  clients: 'Clientes'
};


/* ---------- 2. Estado de la aplicación ---------- */
const state = {
  role: null,                                  // 'atleta' | 'entrenador'
  exercise: 0,                                 // índice del ejercicio actual
  sets: EXERCISES.map(() => []),               // series registradas por ejercicio
  load: EXERCISES[0].load,
  reps: EXERCISES[0].reps,
  lastSet: null,                               // última serie registrada
  restSeconds: 90,                             // duración del descanso (HU-008)
  restStart: 0,
  restTimer: null,
  selectedClient: null,
  editing: false,                              // HU-003: corrigiendo la última serie
  editDeadline: 0,                             // HU-003: hasta cuándo se puede corregir
  finished: false                              // HU-031: la sesión ya se cerró
};

const TOTAL_SETS = EXERCISES.reduce((sum, ex) => sum + ex.sets, 0);

let activeFilter = 'Todos';                   // filtro del panel del entrenador (HU-044)


/* ---------- 3. Utilidades ---------- */
const $ = (id) => document.getElementById(id);

// Muestra los decimales con coma: 62.5 -> "62,5"
const fmt = (n) => String(n).replace('.', ',');

const completedSets = () => state.sets.reduce((sum, list) => sum + list.length, 0);

const completedExercises = () =>
  state.sets.filter((list, i) => list.length >= EXERCISES[i].sets).length;

let toastTimer;

function showToast(text, withActions, kind) {
  // 5.3 / 5.4: el aviso lleva ícono además de texto ('ok' = confirmación, 'info' = aviso)
  $('toast').dataset.kind = kind || 'info';
  $('toast-ico').textContent = kind === 'ok' ? '✓' : 'i';
  $('toast').hidden = true;                    // reinicia la animación de entrada
  void $('toast').offsetWidth;
  $('toast-txt').textContent = text;
  $('undo').hidden = !withActions;
  if ($('fix')) {
    $('fix').hidden = !withActions;
  }
  $('toast').hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $('toast').hidden = true;
  }, withActions ? 10000 : 3000);    // HU-003: 10 s para corregir o deshacer
}


// 5.3: la cifra "late" brevemente cuando cambia (retroalimentación visual inmediata)
function setMetric(id, text) {
  const el = $(id);
  if (el.textContent === text) {
    return;
  }
  el.textContent = text;
  el.classList.remove('bump');
  void el.offsetWidth;                         // reinicia la animación
  el.classList.add('bump');
}

// 5.4: mientras hay una ventana abierta, el resto de la página queda inerte
// (sin foco ni lectura); el aviso con «Corregir» y «Deshacer» sigue disponible
function setBackgroundInert(on) {
  $('app').inert = on;
  $('v-role').inert = on;
  $('skip').inert = on;
}


/* ---------- 4. Entrada y navegación (HU-051) ---------- */
document.querySelectorAll('[data-role]').forEach((button) => {
  button.addEventListener('click', () => {
    state.role = button.dataset.role;

    $('v-role').hidden = true;
    $('app').hidden = false;

    buildNav();
    goTo(state.role === 'atleta' ? 'train' : 'clients', true);
  });
});

function buildNav() {
  $('user-name').textContent = state.role === 'atleta' ? 'Ana Torres' : 'Entrenador';

  $('nav').innerHTML = NAV_ITEMS[state.role]
    .map(([key, label]) => `<li><button type="button" data-go="${key}">${label}</button></li>`)
    .join('');
}

function goTo(view, moveFocus) {
  // Mostrar solo la vista elegida
  document.querySelectorAll('.view').forEach((section) => {
    section.hidden = section.id !== 'v-' + view;
  });

  // Marcar el ítem activo del menú
  document.querySelectorAll('#nav button').forEach((button) => {
    if (button.dataset.go === view) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  $('crumb').textContent = 'PeakSet / ' + VIEW_TITLES[view];
  document.title = VIEW_TITLES[view] + ' · PeakSet';          // 5.4: título de página por vista (WCAG 2.4.2)

  const renderers = {
    train: renderTrain,
    routine: renderRoutine,
    history: renderHistory,
    clients: renderClients
  };
  renderers[view]();

  // 5.4: al cambiar de vista, el foco pasa al título para teclado y lectores de pantalla
  if (moveFocus) {
    window.scrollTo(0, 0);
    $('t-' + view).focus({ preventScroll: true });
  }
}

// Cualquier elemento con data-go navega a esa vista
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-go]');
  if (target) {
    goTo(target.dataset.go, true);
  }
});


/* ---------- 5. Entrenamiento (HU-001, 002, 005, 007, 027, 028, 029) ---------- */
function renderTrain() {
  const ex = EXERCISES[state.exercise];
  const done = state.sets[state.exercise].length;
  const next = EXERCISES[state.exercise + 1];

  $('ex-name').textContent = ex.name;
  $('ex-meta').textContent =
    `Ejercicio ${state.exercise + 1} de ${EXERCISES.length} · ` +
    `Serie ${Math.min(done + 1, ex.sets)} de ${ex.sets} · ` +
    `Objetivo: ${ex.reps} repeticiones`;

  setMetric('load', fmt(state.load) + ' kg');
  setMetric('reps', String(state.reps));
  $('b-register').textContent = state.editing ? 'Actualizar serie' : 'Registrar serie';

  // HU-029: progreso de la sesión
  $('prog').textContent = `${completedSets()} / ${TOTAL_SETS} series`;
  $('bar').value = completedSets();
  $('prog-meta').textContent =
    `${completedSets()} completadas · ${TOTAL_SETS - completedSets()} pendientes · ` +
    `${completedExercises()}/${EXERCISES.length} ejercicios completos`;

  // Tabla de series del ejercicio
  $('sets').innerHTML = Array.from({ length: ex.sets }, (_, i) => {
    const set = state.sets[state.exercise][i];
    let detail;
    let status;

    if (set) {
      detail = `${fmt(set.load)} kg × ${set.reps}`;
      status = 'Hecha' + (set.rest !== null ? ` · descanso ${set.rest} s` : '');
    } else {
      detail = `${fmt(ex.load)} kg × ${ex.reps}`;
      status = i === done ? 'Actual' : 'Pendiente';
    }
    return `<tr><td>${i + 1}</td><td>${detail}</td><td>${status}</td></tr>`;
  }).join('');

  $('next').textContent = next
    ? `Siguiente: ${next.name} · ${next.load} kg · ${next.sets} × ${next.reps}`
    : 'Último ejercicio de la rutina';
  $('b-next').hidden = !next;
  $('b-repeat').disabled = !state.lastSet;

  renderSuggestion();
}

// Ajuste de carga y repeticiones (HU-002, HU-016)
document.querySelectorAll('[data-load]').forEach((button) => {
  button.addEventListener('click', () => {
    state.load = Math.max(0, state.load + Number(button.dataset.load));
    renderTrain();
  });
});

document.querySelectorAll('[data-reps]').forEach((button) => {
  button.addEventListener('click', () => {
    state.reps = Math.max(1, state.reps + Number(button.dataset.reps));
    renderTrain();
  });
});

// HU-002: cambiar repeticiones deslizando, con la rueda del mouse o con las flechas
const repsPanel = $('reps-panel');
let dragStartY = null;

function changeReps(delta) {
  state.reps = Math.max(1, state.reps + delta);
  renderTrain();
}

repsPanel?.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) {
    return;                                    // los botones − / + funcionan aparte
  }
  dragStartY = event.clientY;
  repsPanel.setPointerCapture(event.pointerId);
});

repsPanel?.addEventListener('pointerup', (event) => {
  if (dragStartY === null) {
    return;
  }
  const distance = event.clientY - dragStartY;
  dragStartY = null;

  if (distance <= -30) {
    changeReps(1);                             // deslizar hacia arriba: +1
  } else if (distance >= 30) {
    changeReps(-1);                            // deslizar hacia abajo: −1
  }
});

repsPanel?.addEventListener('pointercancel', () => {
  dragStartY = null;
});

repsPanel?.addEventListener('wheel', (event) => {
  event.preventDefault();
  changeReps(event.deltaY < 0 ? 1 : -1);
}, { passive: false });

repsPanel?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    changeReps(1);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    changeReps(-1);
  }
});

// Registrar serie (HU-001) y repetir la última (HU-005)
function registerSet(load, reps) {
  const ex = EXERCISES[state.exercise];

  if (state.sets[state.exercise].length >= ex.sets) {
    showToast('Ejercicio completo: pasa al siguiente.');
    return;
  }

  state.sets[state.exercise].push({ load, reps, rest: null });
  state.lastSet = { load, reps };
  state.editDeadline = Date.now() + 10000;     // HU-003: ventana de 10 s para corregir
  state.editing = false;

  renderTrain();

  // HU-031: al registrar la última serie de la rutina, la sesión se cierra sola
  if (completedSets() === TOTAL_SETS) {
    finishSession();
    showToast('Rutina completada: la sesión se cerró automáticamente.', false, 'ok');
    return;
  }

  showToast(`Serie ${state.sets[state.exercise].length} registrada · ${fmt(load)} kg × ${reps}`, true, 'ok'); // HU-007
  startRest();                                                                                           // HU-008
}

// HU-001 registra una serie nueva; HU-003 actualiza la última si se está corrigiendo
$('b-register').addEventListener('click', () => {
  if (!state.editing) {
    registerSet(state.load, state.reps);
    return;
  }

  state.editing = false;

  if (Date.now() > state.editDeadline) {
    renderTrain();
    showToast('La ventana de 10 segundos para corregir ya venció.');
    return;
  }

  const last = state.sets[state.exercise].slice(-1)[0];
  last.load = state.load;
  last.reps = state.reps;
  state.lastSet = { load: last.load, reps: last.reps };

  renderTrain();
  showToast(`Serie actualizada · ${fmt(last.load)} kg × ${last.reps}`, false, 'ok');
});

$('b-repeat').addEventListener('click', () => {
  if (state.lastSet) {
    registerSet(state.lastSet.load, state.lastSet.reps);
  }
});

// Historial dentro de la pantalla (HU-019)
$('b-hist').addEventListener('click', (event) => {
  const list = $('inline-hist');
  const willOpen = list.hidden;

  list.hidden = !willOpen;
  event.currentTarget.setAttribute('aria-expanded', String(willOpen));
  list.innerHTML = PAST_SESSIONS.map((s) => `<li>${s.date}: ${s.text}</li>`).join('');
});

// Siguiente ejercicio (HU-028)
$('b-next').addEventListener('click', () => {
  state.exercise += 1;
  state.load = EXERCISES[state.exercise].load;
  state.reps = EXERCISES[state.exercise].reps;
  state.lastSet = null;
  renderTrain();
});

// Deshacer la última serie (HU-003)
$('undo').addEventListener('click', () => {
  const removed = state.sets[state.exercise].pop();

  if (removed) {
    state.lastSet = state.sets[state.exercise].slice(-1)[0] || null;
    state.editing = false;
    closeRest(true);
    renderTrain();
    showToast('Serie deshecha.');
  }
});

// Corregir la última serie dentro de los 10 s (HU-003)
$('fix')?.addEventListener('click', () => {
  const last = state.sets[state.exercise].slice(-1)[0];

  if (!last || Date.now() > state.editDeadline) {
    showToast('La ventana de 10 segundos para corregir ya venció.');
    return;
  }

  state.load = last.load;
  state.reps = last.reps;
  state.editing = true;

  closeRest(true);                             // oculta el descanso para editar
  renderTrain();
  showToast('Ajusta carga o repeticiones y pulsa «Actualizar serie».');
});


/* ---------- 6. Sugerencia de peso (HU-014, 015, 016, 017) ---------- */
function renderSuggestion() {
  const box = $('suggest');
  const last = state.lastSet;

  if (!last) {
    box.textContent = 'Primera serie: usa la carga estándar del ejercicio.';
    return;
  }

  // Si se completaron las repeticiones objetivo, sube 2,5 kg; si no, mantiene (HU-017: motivo)
  const reachedTarget = last.reps >= EXERCISES[state.exercise].reps;
  const suggested = reachedTarget ? last.load + 2.5 : last.load;
  const reason = reachedTarget
    ? 'completaste todas las repeticiones'
    : 'no completaste las repeticiones objetivo, mantén el peso';

  box.innerHTML =
    `Carga sugerida: <strong>${fmt(suggested)} kg</strong> — ${reason}. ` +
    '<button class="btn" id="accept">Aceptar</button>';

  // HU-015: aceptar con un toque
  $('accept').addEventListener('click', () => {
    state.load = suggested;
    renderTrain();
  });
}


/* ---------- 7. Descanso (HU-004, 008, 009, 010, 011) ---------- */
function startRest() {
  const ex = EXERCISES[state.exercise];
  const last = state.lastSet;
  const done = state.sets[state.exercise].length;

  state.restSeconds = 90;
  state.restStart = Date.now();

  $('rest').hidden = false;
  setBackgroundInert(true);
  $('rest-sub').textContent =
    `${ex.name} · ${fmt(last.load)} kg × ${last.reps} · Serie ${done} guardada`;
  $('rest-foot').textContent =
    `El descanso medido se guarda junto al registro. Siguiente: ${fmt(state.load)} kg × ${state.reps}.`;
  $('rest-msg').textContent = 'Ajusta o finaliza el descanso según tu recuperación.';
  $('rest-state').textContent = 'En curso';
  $('clock').classList.remove('end');
  $('rest-continue').focus();

  updateClock();
  clearInterval(state.restTimer);
  state.restTimer = setInterval(updateClock, 250);
}

// HU-011: tiempo restante visible y barra de progreso
function updateClock() {
  const elapsed = Math.floor((Date.now() - state.restStart) / 1000);
  const left = Math.max(0, state.restSeconds - elapsed);
  const percent = state.restSeconds > 0 ? Math.min(100, (elapsed / state.restSeconds) * 100) : 100;

  $('clock').textContent =
    String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
  $('rest-bar').value = percent;

  if (left === 0 && state.restTimer) {
    clearInterval(state.restTimer);
    state.restTimer = null;
    alertRestEnd();
  }
}

// HU-009: sonido y vibración (solo con la pestaña abierta)
function alertRestEnd() {
  $('clock').classList.add('end');
  $('rest-state').textContent = 'Descanso terminado';
  $('rest-msg').textContent = '¡Registra tu siguiente serie cuando estés listo!';

  if (navigator.vibrate) {
    navigator.vibrate([300, 100, 300]);
  }

  if (!$('mute').checked) {
    try {
      const audio = new AudioContext();
      const tone = audio.createOscillator();
      tone.connect(audio.destination);
      tone.frequency.value = 880;
      tone.start();
      tone.stop(audio.currentTime + 0.4);
    } catch (error) {
      // Si el navegador bloquea el audio, queda el aviso visual
    }
  }
}

// HU-010: ajustar el tiempo de descanso en +/- 30 s
document.querySelectorAll('[data-rest]').forEach((button) => {
  button.addEventListener('click', () => {
    state.restSeconds = Math.max(0, state.restSeconds + Number(button.dataset.rest));

    const elapsed = (Date.now() - state.restStart) / 1000;
    if (!state.restTimer && state.restSeconds > elapsed) {
      state.restTimer = setInterval(updateClock, 250);
      $('clock').classList.remove('end');
      $('rest-state').textContent = 'En curso';
    }
    updateClock();
  });
});

// HU-004: guarda el descanso real tomado
function closeRest(discard) {
  clearInterval(state.restTimer);
  state.restTimer = null;
  $('rest').hidden = true;
  setBackgroundInert(false);

  if (!discard) {
    const set = state.sets[state.exercise].slice(-1)[0];
    if (set) {
      set.rest = Math.round((Date.now() - state.restStart) / 1000);
    }
    renderTrain();
  }
  $('b-register').focus();
}

// "Continuar entrenando" y "Finalizar descanso" cierran el descanso
document.querySelectorAll('[data-close-rest]').forEach((button) => {
  button.addEventListener('click', () => closeRest(false));
});


/* ---------- 8. Rutina y cierre de sesión (HU-026, 029, 031, 036) ---------- */
function renderRoutine() {
  $('routine').innerHTML = EXERCISES.map((ex, i) => {
    const current = i === state.exercise ? ' aria-current="step"' : '';
    return `<li${current}><strong>${ex.name}</strong> — ${ex.sets} × ${ex.reps} · ` +
           `${ex.load} kg · ${state.sets[i].length}/${ex.sets} series</li>`;
  }).join('');
}

function finishSession() {
  const volume = state.sets.flat().reduce((sum, s) => sum + s.load * s.reps, 0);
  const pending = TOTAL_SETS - completedSets();

  if (!state.finished) {
    PAST_SESSIONS.unshift({
      date: 'Hoy',
      text: `${completedSets()} series · ${fmt(volume)} kg de volumen`
    });
    state.finished = true;
  }

  goTo('history');

  // HU-036: resumen automático, con opción de cerrarlo conservando los datos
  const summary = $('summary');
  summary.hidden = false;
  summary.innerHTML =
    '<h2>Resumen de la sesión</h2>' +
    `<p>${completedSets()} de ${TOTAL_SETS} series · volumen total ${fmt(volume)} kg · ` +
    `${completedExercises()}/${EXERCISES.length} ejercicios completos.</p>` +
    (pending > 0 ? `<p>Quedaron ${pending} series pendientes.</p>` : '<p>¡Rutina completada!</p>') +
    '<button class="btn" id="close-summary">Cerrar resumen</button>';

  $('close-summary').addEventListener('click', () => {
    summary.hidden = true;                     // los datos siguen en el historial
  });
}

// HU-031: cierre manual (también válido con series pendientes)
$('b-finish').addEventListener('click', finishSession);


/* ---------- 9. Historial y gráfico (HU-032, 033) ---------- */
function renderHistory() {
  $('sessions').innerHTML = PAST_SESSIONS
    .map((s) => `<li><strong>${s.date}</strong> — ${s.text}</li>`)
    .join('');
  drawChart();
  drawCalendar();
}

function drawChart() {
  const allMonths = [['Ago', 50], ['Sep', 55], ['Oct', 60]];
  const months = Number($('period').value) === 1 ? allMonths.slice(-1) : allMonths;

  $('chart').innerHTML = months.map(([label, kg], i) => {
    const height = kg * 2;
    const x = 40 + i * 100;
    return `<rect x="${x}" y="${140 - height}" width="60" height="${height}" rx="8" fill="#7AA7ED"/>` +
           `<text x="${x + 30}" y="${134 - height}" text-anchor="middle">${kg} kg</text>` +
           `<text x="${x + 30}" y="156" text-anchor="middle">${label}</text>`;
  }).join('');
}

$('period').addEventListener('change', drawChart);

// HU-032: calendario de octubre con detalle por fecha
function drawCalendar() {
  if (!$('calendar')) {
    return;                                    // el HTML del calendario no está en la página
  }

  const firstWeekday = 3;                      // 1 de octubre de 2026 cae jueves (lunes = 0)
  const daysInMonth = 31;

  const headers = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    .map((d) => `<span class="cal-h">${d}</span>`)
    .join('');
  const blanks = '<span></span>'.repeat(firstWeekday);

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const trained = PAST_SESSIONS.some((s) => s.day === day);
    return `<button type="button" class="cal-d${trained ? ' on' : ''}" data-day="${day}" aria-pressed="false" ` +
           `aria-label="${day} de octubre${trained ? ', con entrenamiento' : ''}">${day}</button>`;
  }).join('');

  $('calendar').innerHTML = headers + blanks + days;
}

$('calendar')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-day]');
  if (!button) {
    return;
  }

  // 5.3 / 5.4: marca el día elegido
  document.querySelectorAll('.cal-d').forEach((d) => d.setAttribute('aria-pressed', String(d === button)));

  const day = Number(button.dataset.day);
  const session = PAST_SESSIONS.find((s) => s.day === day);

  $('day-detail').textContent = session
    ? `${session.date}: ${session.text}`
    : `El ${day} de octubre no hay entrenamientos registrados.`;
});


/* ---------- 10. Panel del entrenador (HU-039, 040, 041, 044, 045, 046) ---------- */

// HU-039 y HU-041: lista de clientes con su carga actual
function renderClients() {
  $('clients').innerHTML = CLIENTS
    .filter((c) => activeFilter === 'Todos' || c.group === activeFilter)
    .map((c) =>
      // data-label: rótulo de cada dato cuando la fila se muestra como ficha en móvil (5.2)
      `<tr role="row"><td role="cell" data-label="Cliente">${c.name}</td>` +
      `<td role="cell" data-label="Grupo">${c.group}</td>` +
      `<td role="cell" data-label="Ejercicio">${c.exercise}</td>` +
      `<td role="cell" data-label="Carga actual">${fmt(c.load)} kg × ${c.reps}</td>` +
      `<td role="cell"><button class="btn" type="button" data-client="${c.name}" ` +
      `aria-label="Editar a ${c.name}">Editar</button></td></tr>`
    ).join('');

  document.querySelectorAll('[data-client]').forEach((button) => {
    button.addEventListener('click', () => openEditor(button.dataset.client));
  });
}

// HU-044: filtrar por grupo muscular
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    activeFilter = chip.dataset.f;
    document.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('on', c === chip);
      c.setAttribute('aria-pressed', String(c === chip));      // 5.4: estado para lectores de pantalla
    });
    renderClients();
  });
});

// HU-040: ver historial del cliente y abrir el editor
function openEditor(name) {
  const client = CLIENTS.find((c) => c.name === name);
  state.selectedClient = client;

  $('editor').hidden = false;
  $('ed-name').textContent = client.name;
  $('ed-load').value = client.load;
  $('ed-reps').value = client.reps;
  $('ed-sets').value = client.sets;
  $('ed-msg').textContent = '';
  $('ed-hist').innerHTML = PAST_SESSIONS.map((s) => `<li>${s.date}: ${s.text}</li>`).join('');

  // 5.2 / 5.4: en móvil el editor queda debajo de la lista; se lleva el foco y la vista hasta él
  $('ed-name').focus({ preventScroll: true });
  $('editor').scrollIntoView({ block: 'nearest' });
}

// HU-045 y HU-046: modificar carga, repeticiones y series con validación
$('ed-save').addEventListener('click', () => {
  const load = Number($('ed-load').value);
  const reps = Number($('ed-reps').value);
  const sets = Number($('ed-sets').value);

  if (!(load >= 0) || reps < 1 || sets < 1) {
    $('ed-msg').textContent = 'Revisa los valores: carga ≥ 0, repeticiones y series ≥ 1.';
    [['ed-load', load >= 0], ['ed-reps', reps >= 1], ['ed-sets', sets >= 1]].forEach(([id, ok]) => {
      $(id).setAttribute('aria-invalid', String(!ok));         // 5.4: marca el campo con error
    });
    return;
  }

  ['ed-load', 'ed-reps', 'ed-sets'].forEach((id) => $(id).removeAttribute('aria-invalid'));
  Object.assign(state.selectedClient, { load, reps, sets });
  $('ed-msg').textContent = `Cambios aplicados: ${fmt(load)} kg × ${reps} · ${sets} series.`;
  renderClients();
});


/* ---------- 11. Descarga de la app (pantalla de entrada) ---------- */
const appModal = $('app-modal');

function closeAppModal() {
  appModal.hidden = true;
  setBackgroundInert(false);
  $('b-app').focus();
}

$('b-app')?.addEventListener('click', () => {
  appModal.hidden = false;
  setBackgroundInert(true);
  $('app-close').focus();
});

$('app-close')?.addEventListener('click', closeAppModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && appModal && !appModal.hidden) {
    closeAppModal();
  } else if (event.key === 'Escape' && !$('rest').hidden) {
    closeRest(false);                          // 5.3: Esc equivale a «Finalizar descanso»
  }
});



/* ---------- 12. Cambiar de perspectiva (volver a la pantalla de entrada) ---------- */
$('b-switch')?.addEventListener('click', () => {
  state.role = null;
  $('app').hidden = true;
  $('v-role').hidden = false;
  document.title = 'PeakSet · Registro de entrenamiento';
  window.scrollTo(0, 0);
  $('t-role').focus({ preventScroll: true });               // 5.4: foco en el título de la pantalla
});


/* ---------- 13. Interacciones y accesibilidad adicionales (5.3 y 5.4) ---------- */

// Enlace «Saltar al contenido»: lleva el foco a la zona principal visible
$('skip').addEventListener('click', (event) => {
  event.preventDefault();
  const target = $('v-role').hidden ? document.querySelector('.content') : $('v-role');
  target.focus();
});

// Botones aún no disponibles: en vez de no responder, explican por qué
document.querySelectorAll('.btn[aria-disabled="true"]').forEach((button) => {
  button.addEventListener('click', () => {
    showToast(`«${button.textContent.trim()}» estará disponible en una próxima versión.`);
  });
});

// Clic fuera de la ventana de descarga: la cierra
appModal?.addEventListener('click', (event) => {
  if (event.target === appModal) {
    closeAppModal();
  }
});

// El aviso no desaparece mientras el puntero o el foco están sobre él (WCAG 2.2.1)
['pointerenter', 'focusin'].forEach((type) => {
  $('toast').addEventListener(type, () => clearTimeout(toastTimer));
});

['pointerleave', 'focusout'].forEach((type) => {
  $('toast').addEventListener(type, () => {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      $('toast').hidden = true;
    }, 3000);
  });
});
