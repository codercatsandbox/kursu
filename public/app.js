/* Kürsü paneli — bağımlılıksız istemci */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MOOD_COLORS = ['#f27d7d', '#fb923c', '#fbbf24', '#a3e635', '#63d2a1'];
const TRAINING_COLORS = {
  egitim: '#63d2a1',
  program: '#5aa9f0',
  basvuru: '#c084fc',
  kurs: '#f0b45a',
  proje: '#f27d7d',
};
const COURSE_ACTIVITIES = ['ders', 'calisma', 'odev', 'proje', 'lab', 'tekrar'];
const TRAINING_ACTIVITIES = ['egitim', 'proje', 'basvuru', 'toplanti', 'okuma', 'calisma'];
const ACTIVITY_LABELS = {
  ders: 'Ders',
  calisma: 'Çalışma',
  odev: 'Ödev',
  proje: 'Proje',
  lab: 'Lab',
  tekrar: 'Tekrar',
  egitim: 'Eğitim',
  basvuru: 'Başvuru',
  toplanti: 'Toplantı',
  okuma: 'Okuma',
};
const GRADE_OPTIONS = ['', 'AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FD', 'FF'];

const LABELS = {
  courseCategory: { zorunlu: 'Zorunlu', secmeli: 'Seçmeli', staj: 'Staj', diger: 'Diğer' },
  trainingCategory: { egitim: 'Eğitim', program: 'Program', basvuru: 'Başvuru', kurs: 'Kurs', proje: 'Proje' },
  trainingStatus: { planlandi: 'Planlandı', devam: 'Devam', bitti: 'Bitti', iptal: 'İptal' },
  topicStatus: { planlandi: 'Planlandı', devam: 'Devam', bitti: 'Bitti', tekrar: 'Tekrar' },
  milestoneStatus: { bekliyor: 'Bekliyor', devam: 'Devam', bitti: 'Bitti' },
  assessmentType: { vize: 'Vize', final: 'Final', proje: 'Proje', odev: 'Ödev', quiz: 'Quiz', lab: 'Lab', pratik: 'Pratik', sunum: 'Sunum' },
  source: { final: 'final', projeksiyon: 'projeksiyon', hedef: 'hedef' },
};

function label(group, value) {
  return LABELS[group]?.[value] || value;
}

const state = {
  settings: null,
  term: null,
  courses: [],
  trainings: [],
  topics: [],
  milestones: [],
  assessments: [],
  tasks: [],
  gradeScale: [],
  activities: [],
  taskKinds: [],
  topicStatuses: [],
  trainingStatuses: [],
  milestoneStatuses: [],
  today: '',
  date: '',
  day: null,
  summary: null,
  stats: null,
  heat: null,
  gno: null,
  aybuzem: null,
  calendarDays: 30,
  summaryDays: 30,
  mood: null,
  energy: null,
  activeCourseId: null,
  activeTrainingId: null,
};

/* ------------------------------------------------------------- helpers */

function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return localISO(d);
}

function weekdayIndex(iso) {
  return (parseISO(iso).getDay() + 6) % 7;
}

function fmtDate(iso, style = 'short') {
  if (!iso) return '—';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  if (style === 'short') return `${day} ${month.slice(0, 3)}`;
  if (style === 'day') return `${day}`;
  return `${day} ${month} ${d.getFullYear()}`;
}

function fmtDateLong(iso) {
  return `${fmtDate(iso, 'long')}, ${WEEKDAYS[weekdayIndex(iso)]}`;
}

function fmtDateTime(value) {
  if (!value) return '—';
  if (String(value).length <= 10) return fmtDate(value);
  return `${fmtDate(value)} ${String(value).slice(11, 16)}`;
}

function daysUntil(value) {
  if (!value) return null;
  const d = parseISO(value);
  const t = parseISO(state.today);
  return Math.round((d - t) / 86400000);
}

function relativeDay(value) {
  const n = daysUntil(value);
  if (n === null) return '';
  if (n === 0) return 'bugün';
  if (n === 1) return 'yarın';
  if (n === -1) return 'dün';
  if (n < 0) return `${Math.abs(n)} gün gecikti`;
  return `${n} gün sonra`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function fmtMinutes(total) {
  const m = Math.max(0, Math.round(Number(total) || 0));
  if (m === 0) return '0 dk';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} dk`;
  if (rest === 0) return `${h} saat`;
  return `${h}sa ${rest}dk`;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('tr-TR');
}

function fmtPoint(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value, goal) {
  if (!goal) return 0;
  return Math.round((value / goal) * 100);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function trimZero(value) {
  return String(Math.round(value * 10) / 10);
}

function activityLabel(value) {
  return ACTIVITY_LABELS[value] || value;
}

function trainingColor(training) {
  return TRAINING_COLORS[training.category] || '#5aa9f0';
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* boş gövde */
  }
  if (!res.ok) throw new Error(data?.error || `İstek başarısız (${res.status}).`);
  return data;
}

let toastTimer = null;
function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

/* --------------------------------------------------------------- init */

async function init() {
  bindEvents();

  try {
    await refreshAll();
    await loadAybuzemStatus();
    switchTab('bugun');
  } catch (err) {
    toast(err.message, true);
  }
}

async function refreshAll() {
  const boot = await api('/api/bootstrap');
  applyBootstrap(boot);

  if (!state.date || state.date > state.today) state.date = state.today;

  const [day, summary, stats, heat, gno] = await Promise.all([
    api(`/api/days/${state.date}`),
    api(`/api/summary?date=${state.date}`),
    api(`/api/stats?days=${state.summaryDays}`),
    api('/api/stats?days=168'),
    api('/api/gno'),
  ]);

  state.day = day;
  state.summary = summary;
  state.stats = stats;
  state.heat = heat;
  state.gno = gno;
  state.mood = day.mood;
  state.energy = day.energy;

  renderAll();
}

function applyBootstrap(boot) {
  state.settings = boot.settings;
  state.term = boot.term;
  state.courses = boot.courses || [];
  state.trainings = boot.trainings || [];
  state.topics = boot.topics || [];
  state.milestones = boot.milestones || [];
  state.assessments = boot.assessments || [];
  state.tasks = boot.tasks || [];
  state.gradeScale = boot.gradeScale || [];
  state.activities = boot.activities || [];
  state.taskKinds = boot.taskKinds || [];
  state.topicStatuses = boot.topicStatuses || [];
  state.trainingStatuses = boot.trainingStatuses || [];
  state.milestoneStatuses = boot.milestoneStatuses || [];
  state.today = boot.today;

  $('#dbPath').textContent = boot.dbPath;
  $('#brandSub').textContent = `${boot.term?.name || 'Dönem'} · Ders ve Eğitim Takibi`;
  document.title = `${boot.settings.student_name} · Kürsü`;
  $('#dateInput').max = boot.today;
  if (!$('#taskDue').value) $('#taskDue').value = `${boot.today}T17:00`;
}

function bindEvents() {
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
  $$('[data-tab-link]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    switchTab(link.dataset.tabLink);
  }));

  $('#prevDay').addEventListener('click', () => changeDate(addDays(state.date, -1)));
  $('#nextDay').addEventListener('click', () => changeDate(addDays(state.date, 1)));
  $('#todayBtn').addEventListener('click', () => changeDate(state.today));
  $('#dateInput').addEventListener('change', (event) => {
    const value = event.target.value;
    if (!value) return;
    changeDate(value > state.today ? state.today : value);
  });

  $('#dayForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveDay();
  });
  $('#dayForm').addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      saveDay();
    }
  });
  $('#dayForm').addEventListener('input', syncTodayTotals);
  $('#dayForm').addEventListener('change', syncTodayTotals);

  $('#moodRow').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-mood]');
    if (!btn) return;
    const mood = Number(btn.dataset.mood);
    state.mood = state.mood === mood ? null : mood;
    renderMood();
  });

  $('#energyRow').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-energy]');
    if (!btn) return;
    const energy = Number(btn.dataset.energy);
    state.energy = state.energy === energy ? null : energy;
    renderMood();
  });

  $('#addCourseBtn').addEventListener('click', () => {
    const panel = $('#courseAddPanel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) $('#courseCode').focus();
  });
  $$('[data-close-panel]').forEach((btn) => btn.addEventListener('click', () => {
    const panel = $(`#${btn.dataset.closePanel}`);
    if (panel) panel.hidden = true;
  }));
  $('#courseForm').addEventListener('submit', addCourse);
  $('#courseGrid').addEventListener('click', (event) => {
    const card = event.target.closest('[data-course-id]');
    if (!card) return;
    openCourseDialog(Number(card.dataset.courseId));
  });

  $('#addTrainingBtn').addEventListener('click', () => {
    const panel = $('#trainingAddPanel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) $('#trainingName').focus();
  });
  $('#trainingForm').addEventListener('submit', addTraining);
  $('#trainingGrid').addEventListener('click', (event) => {
    const card = event.target.closest('[data-training-id]');
    if (!card) return;
    openTrainingDialog(Number(card.dataset.trainingId));
  });

  $('#calendarRange').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-days]');
    if (!btn) return;
    state.calendarDays = Number(btn.dataset.days);
    $$('#calendarRange button').forEach((b) => b.classList.toggle('active', b === btn));
    renderCalendar();
  });

  $('#taskForm').addEventListener('submit', addTask);
  $('#calendarList').addEventListener('click', handleCalendarClick);

  $('#summaryRange').addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-days]');
    if (!btn) return;
    state.summaryDays = Number(btn.dataset.days);
    $$('#summaryRange button').forEach((b) => b.classList.toggle('active', b === btn));
    try {
      state.stats = await api(`/api/stats?days=${state.summaryDays}`);
      renderSummary();
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#settingsForm').addEventListener('submit', saveSettings);
  $('#importBtn').addEventListener('click', importData);
  $('#aybuzemForm').addEventListener('submit', saveAybuzem);
  $('#aybuzemSync').addEventListener('click', runAybuzemSync);

  $$('[data-close-dialog]').forEach((btn) => btn.addEventListener('click', () => {
    $(`#${btn.dataset.closeDialog}`)?.close();
  }));
  $$('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  }));

  $('#courseDialogBody').addEventListener('submit', handleCourseDialogSubmit);
  $('#courseDialogBody').addEventListener('change', handleCourseDialogChange);
  $('#courseDialogBody').addEventListener('click', handleCourseDialogClick);

  $('#trainingDialogBody').addEventListener('submit', handleTrainingDialogSubmit);
  $('#trainingDialogBody').addEventListener('change', handleTrainingDialogChange);
  $('#trainingDialogBody').addEventListener('click', handleTrainingDialogClick);
}

function switchTab(name) {
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${name}`));

  if (name === 'dersler') renderCourses();
  if (name === 'takvim') renderCalendar();
  if (name === 'egitimler') renderTrainings();
  if (name === 'notlar') renderGrades();
  if (name === 'ozet') renderSummary();
  if (name === 'ayarlar') renderSettings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --------------------------------------------------------------- render */

function renderAll() {
  renderToday();
  renderCourses();
  renderCalendar();
  renderTrainings();
  renderGrades();
  renderSummary();
  renderSettings();
}

function renderToday() {
  if (!state.settings || !state.day) return;
  const isToday = state.date === state.today;
  const isYesterday = state.date === addDays(state.today, -1);

  $('#dayEyebrow').textContent = isToday
    ? `Bugün · ${fmtDateLong(state.date)}`
    : isYesterday
      ? `Dün · ${fmtDateLong(state.date)}`
      : fmtDateLong(state.date);
  $('#dayTitle').textContent = isToday ? 'Günlük kayıt' : 'Geçmiş kayıt';
  $('#dateInput').value = state.date;
  $('#dateInput').max = state.today;
  $('#nextDay').disabled = state.date >= state.today;
  $('#todayBtn').style.opacity = isToday ? '0.5' : '1';

  renderLogRows();
  renderMood();
  $('#noteInput').value = state.day.note || '';
  renderTodayStats();
  renderTodayUpcoming();
  renderTodayRisks();
  syncTodayTotals();
}

function renderLogRows() {
  const courseLogs = new Map();
  const trainingLogs = new Map();
  for (const log of state.day.logs || []) {
    if (log.course_id) courseLogs.set(log.course_id, log);
    if (log.training_id) trainingLogs.set(log.training_id, log);
  }

  const rows = [
    ...state.courses
      .filter((c) => c.status === 'aktif')
      .map((c) => logRowHTML('course', c, courseLogs.get(c.id))),
    ...state.trainings
      .filter((t) => t.status !== 'iptal')
      .map((t) => logRowHTML('training', t, trainingLogs.get(t.id))),
  ];

  $('#logRows').innerHTML = rows.length
    ? rows.join('')
    : '<div class="empty-state">Ders veya eğitim bulunamadı. Dersler sekmesinden ekleyebilirsin.</div>';
}

function logRowHTML(kind, item, log) {
  const isCourse = kind === 'course';
  const color = isCourse ? item.color : trainingColor(item);
  const code = isCourse ? item.code : (item.category ? label('trainingCategory', item.category) : 'Eğitim');
  const name = isCourse ? item.name : item.name;
  const activities = isCourse ? COURSE_ACTIVITIES : TRAINING_ACTIVITIES;
  const selectedActivity = log?.activity || (isCourse ? 'calisma' : 'egitim');

  let options;
  if (isCourse) {
    const topics = state.topics.filter((t) => t.course_id === item.id);
    options = [
      '<option value="">Genel</option>',
      ...topics.map((t) => `<option value="${t.id}" ${Number(log?.topic_id) === t.id ? 'selected' : ''}>${t.week}. hafta · ${esc(t.title)}</option>`),
    ].join('');
  } else {
    const milestones = state.milestones.filter((m) => m.training_id === item.id);
    options = [
      '<option value="">Genel</option>',
      ...milestones.map((m) => `<option value="${m.id}" ${Number(log?.milestone_id) === m.id ? 'selected' : ''}>${esc(m.title)}</option>`),
    ].join('');
  }

  return `
    <div class="log-row" data-kind="${kind}" data-id="${item.id}">
      <div class="log-name">
        <span class="dot" style="background:${color}"></span>
        <span>
          <b>${esc(code)}</b>
          <small title="${esc(name)}">${esc(name)}</small>
        </span>
      </div>
      <select class="${isCourse ? 'log-topic' : 'log-milestone'}" aria-label="${esc(name)} konu">
        ${options}
      </select>
      <select class="log-activity" aria-label="${esc(name)} aktivite">
        ${activities.map((a) => `<option value="${a}" ${selectedActivity === a ? 'selected' : ''}>${activityLabel(a)}</option>`).join('')}
      </select>
      <input class="minutes" type="number" min="0" max="1440" step="5" inputmode="numeric"
             value="${log?.minutes ?? 0}" aria-label="${esc(name)} dakika">
    </div>
  `;
}

function renderMood() {
  $$('#moodRow .mood').forEach((btn) => {
    const active = Number(btn.dataset.mood) === state.mood;
    btn.classList.toggle('active', active);
    btn.style.background = active ? MOOD_COLORS[Number(btn.dataset.mood) - 1] : '';
  });
  $$('#energyRow .mood').forEach((btn) => {
    const active = Number(btn.dataset.energy) === state.energy;
    btn.classList.toggle('active', active);
    btn.style.background = active ? '#5aa9f0' : '';
  });
}

function currentMinutes() {
  const rows = $$('#logRows .log-row');
  if (!rows.length) return (state.day?.logs || []).reduce((sum, l) => sum + l.minutes, 0);
  return rows.reduce((sum, row) => sum + (Number($('input.minutes', row).value) || 0), 0);
}

function currentEntryCount() {
  return $$('#logRows .log-row').filter((row) => (Number($('input.minutes', row).value) || 0) > 0).length;
}

function renderTodayStats() {
  if (!state.settings) return;
  const minutes = currentMinutes();
  const week = state.summary?.stats?.week ?? { minutes: 0 };
  const streak = state.summary?.stats?.streak ?? 0;
  const next = state.summary?.next ?? null;
  const gno = state.gno?.cumulative?.gno ?? null;
  const target = state.settings.gno_target;
  const daily = state.settings.daily_minutes;
  const weekly = state.settings.weekly_minutes;

  const minutesValue = minutes >= 60
    ? (minutes % 60 === 0 ? `${Math.floor(minutes / 60)} saat` : `${Math.floor(minutes / 60)}sa ${minutes % 60}dk`)
    : String(minutes);

  $('#todayStats').innerHTML = [
    statCard({
      key: 'today',
      label: 'Bugün',
      value: minutesValue,
      unit: minutes >= 60 ? '' : 'dk',
      badge: daily ? `hedefin %${pct(minutes, daily)}` : '',
      sub: daily ? `Hedef ${fmtMinutes(daily)}` : 'Hedef belirlemek için Ayarlar',
      progress: pct(minutes, daily),
      tone: pct(minutes, daily) >= 100 ? 'green' : pct(minutes, daily) < 40 ? 'amber' : '',
    }),
    statCard({
      label: 'Bu hafta',
      value: fmtMinutes(week.minutes),
      badge: weekly ? `hedefin %${pct(week.minutes, weekly)}` : '',
      sub: weekly ? `Hedef ${fmtMinutes(weekly)}` : '',
      progress: pct(week.minutes, weekly),
      tone: pct(week.minutes, weekly) >= 100 ? 'green' : '',
    }),
    statCard({
      label: 'Seri',
      value: fmtNum(streak),
      unit: 'gün',
      sub: 'kesintisiz kayıt',
      cls: 'flame',
    }),
    statCard({
      label: 'Yaklaşan',
      value: next ? `${Math.max(0, daysUntil(next.due_date))}` : '—',
      unit: next ? 'gün' : '',
      sub: next ? next.title : '14 gün içinde kayıt yok',
      badge: next ? fmtDate(next.due_date) : '',
    }),
    statCard({
      label: 'GNO',
      value: gno !== null ? fmtPoint(gno) : '—',
      badge: target ? `hedef ${fmtPoint(target)}` : '',
      sub: state.gno?.term?.gpa !== null && state.gno?.term?.gpa !== undefined
        ? `Dönem ${fmtPoint(state.gno.term.gpa)} · ${state.gno.term.ects} AKTS`
        : 'Final notları girildikçe güncellenir',
    }),
  ].join('');
}

function statCard({ key = '', label, value, unit = '', badge = '', sub = '', progress = null, tone = '', cls = '' }) {
  return `
    <div class="stat ${cls}" ${key ? `data-stat="${key}"` : ''}>
      <div class="stat-top">
        <span class="stat-label">${label}</span>
        ${badge ? `<span class="stat-badge">${badge}</span>` : ''}
      </div>
      <div class="stat-value">${value}${unit ? `<span class="unit">${unit}</span>` : ''}</div>
      ${progress !== null ? `<div class="progress ${tone}"><span style="width:${clamp(progress, 0, 100)}%"></span></div>` : ''}
      ${sub ? `<div class="stat-sub">${esc(sub)}</div>` : ''}
    </div>
  `;
}

function miniItem({ title, sub, level = '', kind = '' }) {
  return `
    <div class="mini-item ${level}">
      <span class="mi-dot"></span>
      <span class="mi-main">
        <b title="${esc(title)}">${esc(title)}</b>
        ${sub ? `<small>${esc(sub)}</small>` : ''}
      </span>
    </div>
  `;
}

function renderTodayUpcoming() {
  const items = (state.summary?.upcoming || []).slice(0, 5);
  $('#todayUpcoming').innerHTML = items.length
    ? items.map((item) => miniItem({
        title: item.title,
        sub: `${fmtDateTime(item.due_date)} · ${relativeDay(item.due_date)}`,
        level: daysUntil(item.due_date) <= 2 ? 'high' : '',
      })).join('')
    : '<div class="mini-empty">14 gün içinde teslim veya sınav yok.</div>';
}

function renderTodayRisks() {
  const risks = (state.summary?.risks || []).slice(0, 6);
  $('#todayRisks').innerHTML = risks.length
    ? risks.map((r) => miniItem({ title: r.text, sub: r.course || '', level: r.level })).join('')
    : '<div class="mini-empty">Şu an kritik bir risk yok.</div>';
}

function syncTodayTotals() {
  const minutes = currentMinutes();
  const entries = currentEntryCount();
  $('#liveMinutes').textContent = fmtMinutes(minutes);
  $('#liveEntries').textContent = `${entries} kayıt`;
  $('#saveSummary').textContent = `${fmtMinutes(minutes)} · ${entries} kayıt`;
  renderTodayStats();
}

/* ---------------------------------------------------------------- day */

function collectDay() {
  const logs = [];
  $$('#logRows .log-row').forEach((row) => {
    const minutes = Number($('input.minutes', row).value) || 0;
    if (minutes <= 0) return;
    const activity = $('select.log-activity', row).value;
    const kind = row.dataset.kind;
    const id = Number(row.dataset.id);
    if (kind === 'course') {
      const topic = $('select.log-topic', row)?.value;
      logs.push({ course_id: id, topic_id: topic ? Number(topic) : null, minutes, activity });
    } else {
      const milestone = $('select.log-milestone', row)?.value;
      logs.push({ training_id: id, milestone_id: milestone ? Number(milestone) : null, minutes, activity });
    }
  });
  return {
    mood: state.mood,
    energy: state.energy,
    note: $('#noteInput').value,
    logs,
  };
}

async function saveDay() {
  const btn = $('#saveDayBtn');
  btn.disabled = true;
  btn.textContent = 'Kaydediliyor…';
  try {
    state.day = await api(`/api/days/${state.date}`, {
      method: 'PUT',
      body: JSON.stringify(collectDay()),
    });
    toast('Gün kaydedildi.');
    await refreshAll();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kaydet';
  }
}

function changeDate(date) {
  const next = date > state.today ? state.today : date;
  if (next === state.date) {
    $('#dateInput').value = state.date;
    return;
  }
  state.date = next;
  refreshAll().catch((err) => toast(err.message, true));
}

/* ------------------------------------------------------------- courses */

function renderCourses() {
  const grid = $('#courseGrid');
  if (!state.courses.length) {
    grid.innerHTML = '<div class="empty-state">Henüz ders yok. “Ders ekle” ile başla.</div>';
    return;
  }

  grid.innerHTML = state.courses.map((course) => {
    const grade = course.final_grade || course.projected_grade || course.target_grade || '—';
    const next = course.next_assessment;
    const risk = course.risk && course.status === 'aktif';
    return `
      <article class="course-card" data-course-id="${course.id}" style="--card-color:${course.color}">
        <div class="course-top">
          <span class="course-code">${esc(course.code)}</span>
          <span class="grade-badge ${course.projected_grade && course.projected_grade !== 'FF' ? 'green' : ''}">${esc(grade)}</span>
        </div>
        <h3>${esc(course.name)}</h3>
        <p class="course-meta">${course.ects} AKTS · ${esc(label('courseCategory', course.category))}${course.instructor ? ` · ${esc(course.instructor)}` : ''}</p>
        <div class="course-stats">
          <div><b>${fmtMinutes(course.week_minutes)}</b><span>bu hafta</span></div>
          <div><b>${fmtMinutes(course.total_minutes)}</b><span>toplam</span></div>
          <div><b>${course.topic_progress}%</b><span>konu</span></div>
        </div>
        <div>
          <div class="progress-label"><span>Konu ilerlemesi</span><span>${course.topic_done}/${course.topic_total}</span></div>
          <div class="progress"><span style="width:${course.topic_progress}%"></span></div>
        </div>
        <div class="course-foot">
          <span>${next ? `${esc(next.title)} · ${fmtDate(next.date)}` : 'Yaklaşan sınav yok'}</span>
          <span class="${risk ? 'risk-tag' : 'ok-tag'}">${risk ? 'risk' : 'yolunda'}</span>
        </div>
      </article>
    `;
  }).join('');
}

async function addCourse(event) {
  event.preventDefault();
  const button = $('button[type="submit"]', $('#courseForm'));
  button.disabled = true;
  try {
    await api('/api/courses', {
      method: 'POST',
      body: JSON.stringify({
        code: $('#courseCode').value,
        name: $('#courseName').value,
        instructor: $('#courseInstructor').value,
        ects: Number($('#courseEcts').value) || 0,
        category: $('#courseCategory').value,
        target_grade: $('#courseTarget').value || null,
        grading_type: $('#courseGrading').value,
        color: $('#courseColor').value,
      }),
    });
    $('#courseForm').reset();
    $('#courseEcts').value = 5;
    $('#courseColor').value = '#f0b45a';
    $('#courseAddPanel').hidden = true;
    await refreshAll();
    toast('Ders eklendi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
  }
}

async function openCourseDialog(id) {
  try {
    const course = await api(`/api/courses/${id}`);
    state.activeCourseId = id;
    $('#courseDialogEyebrow').textContent = `${course.code} · ${course.ects} AKTS`;
    $('#courseDialogTitle').textContent = course.name;

    const grade = course.final_grade || course.projected_grade || course.target_grade || '—';
    const next = course.next_assessment;

    $('#courseDialogBody').innerHTML = `
      <div class="detail-grid">
        <div class="detail-cell"><span>Hedef</span><b>${esc(course.target_grade || '—')}</b></div>
        <div class="detail-cell"><span>Projeksiyon</span><b>${esc(grade)}</b></div>
        <div class="detail-cell"><span>Bu hafta</span><b>${fmtMinutes(course.week_minutes)}</b></div>
        <div class="detail-cell"><span>Toplam</span><b>${fmtMinutes(course.total_minutes)}</b></div>
        <div class="detail-cell"><span>Konu</span><b>${course.topic_done}/${course.topic_total}</b></div>
        <div class="detail-cell"><span>Tamamlanan bileşen</span><b>${course.assessment.percent !== null ? `%${course.assessment.percent}` : '—'}</b></div>
        <div class="detail-cell"><span>Son kayıt</span><b>${course.last_log_date ? fmtDate(course.last_log_date) : '—'}</b></div>
        <div class="detail-cell"><span>Yaklaşan</span><b>${next ? fmtDate(next.date) : '—'}</b></div>
      </div>

      <div class="dialog-section">
        <div class="dialog-section-head"><h3>Ders bilgisi</h3><span class="hint">final notu GNO’ya işler</span></div>
        <form id="courseEditForm" class="dialog-form form-grid three">
          <label class="field"><span>Hedef not</span>
            <select name="target_grade">${GRADE_OPTIONS.map((g) => `<option value="${g}" ${course.target_grade === g ? 'selected' : ''}>${g || '—'}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Final notu</span>
            <select name="final_grade">${GRADE_OPTIONS.map((g) => `<option value="${g}" ${course.final_grade === g ? 'selected' : ''}>${g || '—'}</option>`).join('')}</select>
          </label>
          <label class="field"><span>AKTS</span><input name="ects" type="number" min="0" max="30" value="${course.ects}"></label>
          <label class="field"><span>Hoca</span><input name="instructor" value="${esc(course.instructor)}" maxlength="80"></label>
          <label class="field"><span>Not türü</span>
            <select name="grading_type">
              <option value="letter" ${course.grading_type === 'letter' ? 'selected' : ''}>Harf notu</option>
              <option value="pass_fail" ${course.grading_type === 'pass_fail' ? 'selected' : ''}>Geçti / kaldı</option>
            </select>
          </label>
          <label class="field"><span>Renk</span><input name="color" type="color" value="${esc(course.color)}"></label>
          <label class="field span-3"><span>Not</span><input name="note" value="${esc(course.note)}" maxlength="1000"></label>
          <div class="form-actions span-3">
            <button type="button" class="danger-btn" data-del-course="${course.id}">Dersi sil</button>
            <button type="submit" class="primary-btn">Dersi güncelle</button>
          </div>
        </form>
      </div>

      <div class="dialog-section">
        <div class="dialog-section-head"><h3>Konular</h3><span class="hint">${course.topic_done}/${course.topic_total} bitti</span></div>
        <div class="topic-list">
          ${course.topics.length ? course.topics.map((t) => `
            <div class="topic-row" data-topic-id="${t.id}">
              <span class="week">${t.week}. hf</span>
              <span class="title" title="${esc(t.title)}">${esc(t.title)}</span>
              <select class="topic-status" data-topic-id="${t.id}" aria-label="${esc(t.title)} durumu">
                ${state.topicStatuses.map((s) => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${label('topicStatus', s)}</option>`).join('')}
              </select>
              <button type="button" class="del" data-del-topic="${t.id}" title="Sil">×</button>
            </div>
          `).join('') : '<div class="empty-state">Konu yok. Aşağıdan ekle.</div>'}
        </div>
        <form id="topicForm" class="dialog-form form-grid three">
          <label class="field"><span>Hafta</span><input name="week" type="number" min="0" max="60" value="${(course.topics.at(-1)?.week || 0) + 1}"></label>
          <label class="field span-2"><span>Konu</span><input name="title" maxlength="200" placeholder="Örn. Graph Algorithms" required></label>
          <div class="form-actions span-3"><button type="submit" class="ghost-btn">Konu ekle</button></div>
        </form>
      </div>

      <div class="dialog-section">
        <div class="dialog-section-head"><h3>Değerlendirmeler</h3><span class="hint">ağırlık toplamı %${course.assessment.weight_total}</span></div>
        <div class="assessment-head"><span>Başlık</span><span>Tarih</span><span>Ağırlık</span><span>Puan</span><span>Katkı</span><span></span></div>
        <div class="assessment-list">
          ${course.assessments.length ? course.assessments.map((a) => `
            <div class="assessment-row" data-assessment-id="${a.id}">
              <span class="a-title" title="${esc(a.title)}">${esc(a.title)} <span class="a-type">${esc(label('assessmentType', a.type))}</span></span>
              <span>${a.date ? fmtDate(a.date) : '—'}</span>
              <span>%${a.weight}</span>
              <span class="a-score">
                <input class="a-score-input" data-field="score" type="number" min="0" step="0.5" value="${a.score ?? ''}" placeholder="—">
                <span>/</span>
                <input class="a-score-input" data-field="max_score" type="number" min="0" step="0.5" value="${a.max_score ?? ''}" placeholder="—">
              </span>
              <span>${a.contribution !== null ? fmtPoint(a.contribution) : '—'}</span>
              <button type="button" class="del" data-del-assessment="${a.id}" title="Sil">×</button>
            </div>
          `).join('') : '<div class="empty-state">Değerlendirme yok. Aşağıdan ekle.</div>'}
        </div>
        <form id="assessmentForm" class="dialog-form form-grid three">
          <label class="field"><span>Tür</span>
            <select name="type">
              <option value="vize">Vize</option><option value="final">Final</option><option value="proje">Proje</option>
              <option value="odev">Ödev</option><option value="quiz">Quiz</option><option value="lab">Lab</option>
              <option value="pratik">Pratik</option><option value="sunum">Sunum</option>
            </select>
          </label>
          <label class="field span-2"><span>Başlık</span><input name="title" maxlength="120" placeholder="Midterm" required></label>
          <label class="field"><span>Tarih</span><input name="date" type="date"></label>
          <label class="field"><span>Ağırlık (%)</span><input name="weight" type="number" min="0" max="200" step="1" value="0"></label>
          <label class="field"><span>Maks puan</span><input name="max_score" type="number" min="0" step="0.5" placeholder="100"></label>
          <div class="form-actions span-3"><button type="submit" class="ghost-btn">Değerlendirme ekle</button></div>
        </form>
      </div>
    `;

    const dialog = $('#courseDialog');
    if (!dialog.open) dialog.showModal();
  } catch (err) {
    toast(err.message, true);
  }
}

async function handleCourseDialogSubmit(event) {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === 'courseEditForm') {
      const data = new FormData(form);
      await api(`/api/courses/${state.activeCourseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          target_grade: data.get('target_grade') || null,
          final_grade: data.get('final_grade') || null,
          ects: Number(data.get('ects')) || 0,
          instructor: data.get('instructor'),
          grading_type: data.get('grading_type'),
          color: data.get('color'),
          note: data.get('note'),
        }),
      });
      toast('Ders güncellendi.');
    } else if (form.id === 'topicForm') {
      const data = new FormData(form);
      await api(`/api/courses/${state.activeCourseId}/topics`, {
        method: 'POST',
        body: JSON.stringify({
          week: Number(data.get('week')) || 0,
          title: data.get('title'),
        }),
      });
      toast('Konu eklendi.');
    } else if (form.id === 'assessmentForm') {
      const data = new FormData(form);
      await api('/api/assessments', {
        method: 'POST',
        body: JSON.stringify({
          course_id: state.activeCourseId,
          type: data.get('type'),
          title: data.get('title'),
          date: data.get('date') || null,
          weight: Number(data.get('weight')) || 0,
          max_score: data.get('max_score') ? Number(data.get('max_score')) : null,
        }),
      });
      toast('Değerlendirme eklendi.');
    } else {
      return;
    }
    await refreshAll();
    await openCourseDialog(state.activeCourseId);
  } catch (err) {
    toast(err.message, true);
  }
}

async function handleCourseDialogChange(event) {
  const target = event.target;
  try {
    if (target.matches('.topic-status')) {
      await api(`/api/topics/${target.dataset.topicId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: target.value }),
      });
      await refreshAll();
      await openCourseDialog(state.activeCourseId);
    } else if (target.matches('.a-score-input')) {
      const row = target.closest('.assessment-row');
      const score = $('.a-score-input[data-field="score"]', row).value;
      const max = $('.a-score-input[data-field="max_score"]', row).value;
      await api(`/api/assessments/${row.dataset.assessmentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          score: score === '' ? null : Number(score),
          max_score: max === '' ? null : Number(max),
          status: score !== '' ? 'girildi' : 'planlandi',
        }),
      });
      await refreshAll();
      await openCourseDialog(state.activeCourseId);
    }
  } catch (err) {
    toast(err.message, true);
  }
}

async function handleCourseDialogClick(event) {
  const courseBtn = event.target.closest('[data-del-course]');
  const topicBtn = event.target.closest('[data-del-topic]');
  const assessmentBtn = event.target.closest('[data-del-assessment]');
  try {
    if (courseBtn) {
      if (!window.confirm('Bu ders ve bağlı konu/değerlendirmeler silinsin mi? Günlük kaydı varsa silinemez.')) return;
      await api(`/api/courses/${courseBtn.dataset.delCourse}`, { method: 'DELETE' });
      $('#courseDialog').close();
      await refreshAll();
      toast('Ders silindi.');
    } else if (topicBtn) {
      if (!window.confirm('Bu konu silinsin mi?')) return;
      await api(`/api/topics/${topicBtn.dataset.delTopic}`, { method: 'DELETE' });
      await refreshAll();
      await openCourseDialog(state.activeCourseId);
    } else if (assessmentBtn) {
      if (!window.confirm('Bu değerlendirme silinsin mi?')) return;
      await api(`/api/assessments/${assessmentBtn.dataset.delAssessment}`, { method: 'DELETE' });
      await refreshAll();
      await openCourseDialog(state.activeCourseId);
    }
  } catch (err) {
    toast(err.message, true);
  }
}

/* ----------------------------------------------------------- trainings */

function renderTrainings() {
  const grid = $('#trainingGrid');
  if (!state.trainings.length) {
    grid.innerHTML = '<div class="empty-state">Henüz eğitim yok. “Eğitim ekle” ile başla.</div>';
    return;
  }

  grid.innerHTML = state.trainings.map((t) => {
    const color = trainingColor(t);
    return `
      <article class="training-card" data-training-id="${t.id}" style="--card-color:${color}">
        <div class="training-top">
          <span class="training-cat">${esc(label('trainingCategory', t.category))}</span>
          <span class="grade-badge ${t.status === 'bitti' ? 'green' : ''}">${esc(label('trainingStatus', t.status))}</span>
        </div>
        <h3>${esc(t.name)}</h3>
        <p class="training-meta">${esc(t.provider || '—')}${t.start_date ? ` · ${fmtDate(t.start_date)}` : ''}${t.end_date ? ` → ${fmtDate(t.end_date)}` : ''}</p>
        <div class="training-progress">
          <div class="progress"><span style="width:${t.progress}%"></span></div>
          <b>${t.milestone_done}/${t.milestone_total}</b>
        </div>
        <div class="course-stats">
          <div><b>${fmtMinutes(t.logged_minutes)}</b><span>kayıt</span></div>
          <div><b>${t.total_hours ? `${t.completed_hours}/${t.total_hours} sa` : '—'}</b><span>saat</span></div>
        </div>
        <div class="training-foot">
          <span>${t.last_log_date ? `son ${fmtDate(t.last_log_date)}` : 'henüz kayıt yok'}</span>
          <span>${t.progress}%</span>
        </div>
      </article>
    `;
  }).join('');
}

async function addTraining(event) {
  event.preventDefault();
  const button = $('button[type="submit"]', $('#trainingForm'));
  button.disabled = true;
  try {
    await api('/api/trainings', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#trainingName').value,
        provider: $('#trainingProvider').value,
        category: $('#trainingCategory').value,
        status: $('#trainingStatus').value,
        total_hours: Number($('#trainingHours').value) || 0,
        start_date: $('#trainingStart').value || null,
        end_date: $('#trainingEnd').value || null,
        note: $('#trainingNote').value,
      }),
    });
    $('#trainingForm').reset();
    $('#trainingStatus').value = 'devam';
    $('#trainingAddPanel').hidden = true;
    await refreshAll();
    toast('Eğitim eklendi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
  }
}

async function openTrainingDialog(id) {
  try {
    const training = await api(`/api/trainings/${id}`);
    state.activeTrainingId = id;
    $('#trainingDialogEyebrow').textContent = `${label('trainingCategory', training.category)} · ${training.provider || '—'}`;
    $('#trainingDialogTitle').textContent = training.name;

    $('#trainingDialogBody').innerHTML = `
      <div class="detail-grid">
        <div class="detail-cell"><span>Durum</span><b>${esc(label('trainingStatus', training.status))}</b></div>
        <div class="detail-cell"><span>Milestone</span><b>${training.milestone_done}/${training.milestone_total}</b></div>
        <div class="detail-cell"><span>Kayıt</span><b>${fmtMinutes(training.logged_minutes)}</b></div>
        <div class="detail-cell"><span>Saat</span><b>${training.total_hours ? `${training.completed_hours}/${training.total_hours}` : '—'}</b></div>
      </div>

      <div class="dialog-section">
        <div class="dialog-section-head"><h3>Program bilgisi</h3><span class="hint">ilerleme</span></div>
        <form id="trainingEditForm" class="dialog-form form-grid three">
          <label class="field"><span>Durum</span>
            <select name="status">${state.trainingStatuses.map((s) => `<option value="${s}" ${training.status === s ? 'selected' : ''}>${label('trainingStatus', s)}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Toplam saat</span><input name="total_hours" type="number" min="0" step="1" value="${training.total_hours}"></label>
          <label class="field"><span>Tamamlanan saat</span><input name="completed_hours" type="number" min="0" step="1" value="${training.completed_hours}"></label>
          <label class="field span-3"><span>Not</span><input name="note" value="${esc(training.note)}" maxlength="1000"></label>
          <div class="form-actions span-3">
            <button type="button" class="danger-btn" data-del-training="${training.id}">Eğitimi sil</button>
            <button type="submit" class="primary-btn">Eğitimi güncelle</button>
          </div>
        </form>
      </div>

      <div class="dialog-section">
        <div class="dialog-section-head"><h3>Milestone’lar</h3><span class="hint">${training.progress}%</span></div>
        <div class="topic-list">
          ${training.milestones.length ? training.milestones.map((m) => `
            <div class="milestone-row" data-milestone-id="${m.id}">
              <span class="m-title" title="${esc(m.title)}">${esc(m.title)}</span>
              <span>${m.due_date ? fmtDateTime(m.due_date) : '—'}</span>
              <select class="milestone-status" data-milestone-id="${m.id}" aria-label="${esc(m.title)} durumu">
                ${state.milestoneStatuses.map((s) => `<option value="${s}" ${m.status === s ? 'selected' : ''}>${label('milestoneStatus', s)}</option>`).join('')}
              </select>
              <button type="button" class="del" data-del-milestone="${m.id}" title="Sil">×</button>
            </div>
          `).join('') : '<div class="empty-state">Milestone yok. Aşağıdan ekle.</div>'}
        </div>
        <form id="milestoneForm" class="dialog-form form-grid three">
          <label class="field span-2"><span>Başlık</span><input name="title" maxlength="200" placeholder="Örn. SAGE.13 özgeçmiş" required></label>
          <label class="field"><span>Tarih / saat</span><input name="due_date" type="datetime-local"></label>
          <label class="field"><span>Planlanan saat</span><input name="planned_hours" type="number" min="0" step="1" value="0"></label>
          <div class="form-actions span-3"><button type="submit" class="ghost-btn">Milestone ekle</button></div>
        </form>
      </div>
    `;

    const dialog = $('#trainingDialog');
    if (!dialog.open) dialog.showModal();
  } catch (err) {
    toast(err.message, true);
  }
}

async function handleTrainingDialogSubmit(event) {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === 'trainingEditForm') {
      const data = new FormData(form);
      await api(`/api/trainings/${state.activeTrainingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: data.get('status'),
          total_hours: Number(data.get('total_hours')) || 0,
          completed_hours: Number(data.get('completed_hours')) || 0,
          note: data.get('note'),
        }),
      });
      toast('Eğitim güncellendi.');
    } else if (form.id === 'milestoneForm') {
      const data = new FormData(form);
      await api(`/api/trainings/${state.activeTrainingId}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          title: data.get('title'),
          due_date: data.get('due_date') || null,
          planned_hours: Number(data.get('planned_hours')) || 0,
        }),
      });
      toast('Milestone eklendi.');
    } else {
      return;
    }
    await refreshAll();
    await openTrainingDialog(state.activeTrainingId);
  } catch (err) {
    toast(err.message, true);
  }
}

async function handleTrainingDialogChange(event) {
  const target = event.target;
  if (!target.matches('.milestone-status')) return;
  try {
    await api(`/api/milestones/${target.dataset.milestoneId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: target.value }),
    });
    await refreshAll();
    await openTrainingDialog(state.activeTrainingId);
  } catch (err) {
    toast(err.message, true);
  }
}

async function handleTrainingDialogClick(event) {
  const trainingBtn = event.target.closest('[data-del-training]');
  const milestoneBtn = event.target.closest('[data-del-milestone]');
  try {
    if (trainingBtn) {
      if (!window.confirm('Bu eğitim ve milestone’ları silinsin mi? Günlük kaydı varsa silinemez.')) return;
      await api(`/api/trainings/${trainingBtn.dataset.delTraining}`, { method: 'DELETE' });
      $('#trainingDialog').close();
      await refreshAll();
      toast('Eğitim silindi.');
    } else if (milestoneBtn) {
      if (!window.confirm('Bu milestone silinsin mi?')) return;
      await api(`/api/milestones/${milestoneBtn.dataset.delMilestone}`, { method: 'DELETE' });
      await refreshAll();
      await openTrainingDialog(state.activeTrainingId);
    }
  } catch (err) {
    toast(err.message, true);
  }
}

/* -------------------------------------------------------------- calendar */

function renderCalendar() {
  fillTaskSelects();
  const today = state.today;
  const start = addDays(today, -7);
  const end = addDays(today, state.calendarDays);

  const events = [];
  for (const a of state.assessments) {
    if (!a.date) continue;
    events.push({
      id: `assessment-${a.id}`,
      kind: 'sinav',
      title: a.title,
      sub: `${a.course_code} · %${a.weight}`,
      date: a.date,
      source: 'assessment',
      courseId: a.course_id,
    });
  }
  for (const t of state.tasks) {
    if (t.status !== 'acik' || !t.due_date) continue;
    events.push({
      id: `task-${t.id}`,
      kind: t.kind,
      title: t.title,
      sub: [t.course_code, t.training_name].filter(Boolean).join(' · ') || 'Görev',
      date: t.due_date,
      source: 'task',
      taskId: t.id,
      status: t.status,
    });
  }
  for (const m of state.milestones) {
    if (m.status === 'bitti' || !m.due_date) continue;
    const training = state.trainings.find((t) => t.id === m.training_id);
    events.push({
      id: `milestone-${m.id}`,
      kind: 'milestone',
      title: m.title,
      sub: training?.name || 'Eğitim',
      date: m.due_date,
      source: 'milestone',
      milestoneId: m.id,
    });
  }

  const filtered = events
    .filter((e) => {
      const d = String(e.date).slice(0, 10);
      return d >= start && d <= end;
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.title.localeCompare(b.title, 'tr'));

  const groups = new Map();
  for (const e of filtered) {
    const day = String(e.date).slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(e);
  }

  $('#calendarMeta').textContent = `${filtered.length} kayıt · ${state.calendarDays} gün`;
  const list = $('#calendarList');
  if (!groups.size) {
    list.innerHTML = '<div class="empty-state">Bu aralıkta kayıt yok.</div>';
    return;
  }

  list.innerHTML = [...groups.entries()].map(([day, items]) => `
    <div class="calendar-group">
      <div class="calendar-date">
        ${fmtDateLong(day)}
        ${day === today ? '<span class="today-tag">bugün</span>' : ''}
      </div>
      ${items.map((e) => `
        <div class="calendar-item ${String(e.date).slice(0, 10) < today ? 'overdue' : ''}">
          <span class="ci-kind ${esc(e.kind)}"></span>
          <span class="ci-main">
            <b>${esc(e.title)}</b>
            <small>${esc(e.sub)}${String(e.date).length > 10 ? ` · ${String(e.date).slice(11, 16)}` : ''} · ${relativeDay(e.date)}</small>
          </span>
          <span class="ci-actions">
            ${e.source === 'task' ? `
              <button type="button" data-task-toggle="${e.taskId}" title="Tamamlandı">✓</button>
              <button type="button" data-task-delete="${e.taskId}" title="Sil">×</button>
            ` : ''}
            ${e.source === 'milestone' ? `<button type="button" data-milestone-toggle="${e.milestoneId}" title="Tamamlandı">✓</button>` : ''}
            ${e.source === 'assessment' && e.courseId ? `<button type="button" data-course-open="${e.courseId}" title="Dersi aç">→</button>` : ''}
          </span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function fillTaskSelects() {
  const courseSelect = $('#taskCourse');
  const trainingSelect = $('#taskTraining');
  if (!courseSelect || !trainingSelect) return;
  const courseValue = courseSelect.value;
  const trainingValue = trainingSelect.value;
  courseSelect.innerHTML = '<option value="">—</option>' + state.courses
    .map((c) => `<option value="${c.id}">${esc(c.code)} · ${esc(c.name)}</option>`).join('');
  trainingSelect.innerHTML = '<option value="">—</option>' + state.trainings
    .map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  courseSelect.value = courseValue;
  trainingSelect.value = trainingValue;
}

async function addTask(event) {
  event.preventDefault();
  const button = $('button[type="submit"]', $('#taskForm'));
  button.disabled = true;
  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: $('#taskTitle').value,
        kind: $('#taskKind').value,
        due_date: $('#taskDue').value || null,
        priority: $('#taskPriority').value,
        course_id: $('#taskCourse').value || null,
        training_id: $('#taskTraining').value || null,
        note: $('#taskNote').value,
      }),
    });
    $('#taskTitle').value = '';
    $('#taskNote').value = '';
    await refreshAll();
    toast('Görev eklendi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
  }
}

async function handleCalendarClick(event) {
  const toggle = event.target.closest('[data-task-toggle]');
  const del = event.target.closest('[data-task-delete]');
  const milestone = event.target.closest('[data-milestone-toggle]');
  const courseOpen = event.target.closest('[data-course-open]');
  try {
    if (toggle) {
      await api(`/api/tasks/${toggle.dataset.taskToggle}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'bitti' }),
      });
      await refreshAll();
      toast('Görev tamamlandı.');
    } else if (del) {
      if (!window.confirm('Bu görev silinsin mi?')) return;
      await api(`/api/tasks/${del.dataset.taskDelete}`, { method: 'DELETE' });
      await refreshAll();
      toast('Görev silindi.');
    } else if (milestone) {
      await api(`/api/milestones/${milestone.dataset.milestoneToggle}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'bitti' }),
      });
      await refreshAll();
      toast('Milestone tamamlandı.');
    } else if (courseOpen) {
      await openCourseDialog(Number(courseOpen.dataset.courseOpen));
    }
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---------------------------------------------------------------- grades */

function renderGrades() {
  if (!state.gno) return;
  const gno = state.gno;
  const target = gno.settings.gno_target;

  $('#gnoStats').innerHTML = [
    statCard({
      label: 'Önceki GNO',
      value: fmtPoint(gno.settings.previous_gno),
      sub: `${gno.settings.previous_ects} AKTS`,
    }),
    statCard({
      label: 'Dönem GNO',
      value: gno.term.gpa !== null ? fmtPoint(gno.term.gpa) : '—',
      sub: `${gno.term.ects} AKTS · ${fmtPoint(gno.term.points)} puan`,
      progress: gno.term.gpa !== null ? pct(gno.term.gpa, 4) : null,
    }),
    statCard({
      label: 'Kümülatif GNO',
      value: gno.cumulative.gno !== null ? fmtPoint(gno.cumulative.gno) : '—',
      badge: target ? `hedef ${fmtPoint(target)}` : '',
      sub: `${gno.cumulative.ects} AKTS`,
      progress: gno.cumulative.gno !== null ? pct(gno.cumulative.gno, 4) : null,
      tone: gno.cumulative.gno !== null && gno.cumulative.gno >= target ? 'green' : 'amber',
    }),
    statCard({
      label: 'Hedef',
      value: fmtPoint(target),
      sub: `${gno.target.remaining_ects_from_now} AKTS kaldı`,
      badge: gno.target.feasible_from_now ? 'ulaşılabilir' : 'zor',
    }),
    statCard({
      label: 'Bugünden gereken ortalama',
      value: gno.target.required_average_from_now !== null ? fmtPoint(gno.target.required_average_from_now) : '—',
      unit: '/ 4.00',
      sub: `${gno.target.remaining_ects_from_now} AKTS · mevcut dönem dahil`,
      tone: gno.target.feasible_from_now ? 'green' : 'amber',
    }),
  ].join('');

  const body = $('#gradeTableBody');
  if (!gno.rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="muted">Ders yok.</td></tr>';
  } else {
    body.innerHTML = gno.rows.map((r) => `
      <tr>
        <td class="strong"><span title="${esc(r.name)}">${esc(r.code)}</span><br><small class="muted">${esc(r.name)}</small></td>
        <td class="num">${r.ects}</td>
        <td>${esc(r.target_grade || '—')}</td>
        <td>
          <select data-final-grade="${r.id}" aria-label="${esc(r.code)} final notu">
            ${GRADE_OPTIONS.map((g) => `<option value="${g}" ${r.final_grade === g ? 'selected' : ''}>${g || '—'}</option>`).join('')}
          </select>
        </td>
        <td>${esc(r.projected_grade || '—')} <small class="muted">(${esc(r.source)})</small></td>
        <td class="num">${r.point !== null ? fmtPoint(r.point) : '—'}</td>
        <td class="num">${r.contribution ? fmtPoint(r.contribution) : '—'}</td>
      </tr>
    `).join('');
  }

  $$('#gradeTableBody select[data-final-grade]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        await api(`/api/courses/${select.dataset.finalGrade}`, {
          method: 'PUT',
          body: JSON.stringify({ final_grade: select.value || null }),
        });
        await refreshAll();
        toast('Final notu güncellendi.');
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  const detail = $('#gnoDetail');
  detail.innerHTML = `
    <div class="gno-line"><span>Önceki GNO × AKTS</span><b>${fmtPoint(gno.settings.previous_gno)} × ${gno.settings.previous_ects} = ${fmtPoint(gno.settings.previous_gno * gno.settings.previous_ects)}</b></div>
    <div class="gno-line"><span>Dönem puanı</span><b>${fmtPoint(gno.term.points)} / ${gno.term.ects} AKTS</b></div>
    <div class="gno-line"><span>Kümülatif</span><b>${fmtPoint(gno.cumulative.points)} / ${gno.cumulative.ects} AKTS = ${fmtPoint(gno.cumulative.gno)}</b></div>
    <div class="gno-line"><span>Mezuniyet hedefi</span><b>${fmtPoint(gno.settings.gno_target)} × ${gno.target.ects} AKTS</b></div>
    <div class="gno-line"><span>Bugünden kalan AKTS</span><b>${gno.target.remaining_ects_from_now}</b></div>
    <div class="gno-line"><span>Mevcut dönem dahil gereken ortalama</span><b>${gno.target.required_average_from_now !== null ? fmtPoint(gno.target.required_average_from_now) : '—'} / 4.00</b></div>
    <div class="gno-line"><span>Mevcut dönem projeksiyonu sonrası</span><b>${gno.target.required_average !== null ? fmtPoint(gno.target.required_average) : '—'} / 4.00 · ${gno.target.remaining_ects} AKTS</b></div>
    ${gno.repeat_scenario ? `<div class="gno-line"><span>${esc(gno.repeat_scenario.code)} DD → AA senaryosu</span><b>+${fmtPoint(gno.repeat_scenario.delta_points)} puan · GNO ${fmtPoint(gno.repeat_scenario.dd_gno)} → ${fmtPoint(gno.repeat_scenario.aa_gno)}</b></div>` : ''}
    ${gno.target.required_average !== null && gno.target.required_average > 4
      ? '<div class="gno-warning">Bu hedef, mevcut GNO ve AKTS varsayımıyla 4.00 üstü bir ortalama gerektiriyor. Tekrar dersleri, yaz dönemi veya hedef AKTS’yi güncelle.</div>'
      : '<div class="gno-ok">Hedef, kalan dönemlerde 4.00 ve altı bir ortalama ile ulaşılabilir görünüyor.</div>'}
    <p class="hint">CENG300 geçti/kaldı olduğu için GNO’ya girmez. MATH101 tekrar dersidir; final notu girildiğinde son deneme esas alınır.</p>
  `;
}

/* ---------------------------------------------------------------- summary */

function renderSummary() {
  if (!state.stats) return;
  const stats = state.stats;
  const range = stats.range;
  const goals = state.settings;
  const week = stats.week;

  $('#summaryStats').innerHTML = [
    statCard({
      label: 'Toplam süre',
      value: fmtMinutes(range.minutes),
      sub: `Günlük ort. ${fmtMinutes(range.avgMinutes)}`,
    }),
    statCard({
      label: 'Aktif gün',
      value: fmtNum(range.activeDays),
      unit: `/ ${range.days} gün`,
      badge: `%${pct(range.activeDays, range.days)}`,
      sub: range.moodAvg ? `Ort. ruh hali ${fmtPoint(range.moodAvg)} / 5` : 'Ruh hali girilmedi',
    }),
    statCard({
      label: 'Aktif günde',
      value: fmtMinutes(range.perActiveDayMinutes),
      sub: 'günlük ortalama',
    }),
    statCard({
      label: 'Seri',
      value: fmtNum(stats.streak),
      unit: 'gün',
      sub: 'kesintisiz kayıt',
      cls: 'flame',
    }),
    statCard({
      label: 'Bu hafta',
      value: fmtMinutes(week.minutes),
      badge: goals.weekly_minutes ? `hedefin %${pct(week.minutes, goals.weekly_minutes)}` : '',
      sub: `Hedef ${fmtMinutes(goals.weekly_minutes)} · geçen hafta ${fmtMinutes(stats.lastWeek.minutes)}`,
      progress: pct(week.minutes, goals.weekly_minutes),
      tone: pct(week.minutes, goals.weekly_minutes) >= 100 ? 'green' : '',
    }),
  ].join('');

  $('#summaryChartMeta').textContent = `${fmtMinutes(range.minutes)} · ort. ${fmtMinutes(range.avgMinutes)}/gün`;
  const labelEvery = state.summaryDays <= 7 ? 1 : Math.ceil(state.summaryDays / 8);
  const labelFn = state.summaryDays <= 7
    ? (d) => WEEKDAYS_SHORT[weekdayIndex(d.date)]
    : (d) => fmtDate(d.date, 'day');

  renderBarChart($('#summaryChart'), {
    series: stats.series,
    valueFn: (d) => d.minutes / 60,
    goal: goals.daily_minutes / 60,
    color: '#f0b45a',
    tooltip: (d) => `${fmtDate(d.date)} · ${fmtMinutes(d.minutes)}`,
    goalLabel: (g) => `${fmtPoint(g)} saat`,
    labelEvery,
    labelFn,
  });

  renderBreakdown(stats);
  renderDailySummary();
  renderHeatmap(state.heat);
}

function renderBarChart(container, options) {
  const { series, valueFn, goal = 0, color, tooltip, goalLabel, labelEvery = 1, labelFn } = options;
  const values = series.map(valueFn);

  if (!series.length || values.every((v) => v === 0)) {
    container.innerHTML = '<div class="chart-empty">Bu aralıkta henüz veri yok.</div>';
    return;
  }

  const W = 620;
  const H = 200;
  const pad = { top: 16, right: 10, bottom: 26, left: 10 };
  const plotH = H - pad.top - pad.bottom;
  const plotW = W - pad.left - pad.right;
  const max = Math.max(goal || 0, ...values) * 1.08 || 1;
  const slot = plotW / series.length;
  const barW = Math.max(2, Math.min(24, slot * 0.62));
  const yFor = (value) => pad.top + plotH - (value / max) * plotH;

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Çalışma süresi grafiği">
    <line x1="${pad.left}" y1="${pad.top + plotH}" x2="${W - pad.right}" y2="${pad.top + plotH}" stroke="#2a3446" stroke-width="1" />`;

  if (goal > 0) {
    const gy = yFor(goal);
    svg += `<line x1="${pad.left}" y1="${gy}" x2="${W - pad.right}" y2="${gy}" stroke="#6f7c93" stroke-width="1" stroke-dasharray="4 5" />
      <text x="${W - pad.right}" y="${gy - 6}" text-anchor="end" fill="#6f7c93" font-size="10">hedef ${goalLabel ? goalLabel(goal) : goal}</text>`;
  }

  series.forEach((d, i) => {
    const value = values[i];
    const x = pad.left + slot * i + (slot - barW) / 2;
    const h = value > 0 ? Math.max(2, (value / max) * plotH) : 0;
    if (h > 0) {
      svg += `<rect class="bar" x="${x.toFixed(1)}" y="${(pad.top + plotH - h).toFixed(1)}" width="${barW.toFixed(1)}"
        height="${h.toFixed(1)}" rx="${Math.min(4, barW / 2).toFixed(1)}" fill="${color}">
        <title>${esc(tooltip(d, value))}</title></rect>`;
    }
    if (i % labelEvery === 0 || i === series.length - 1) {
      svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="#6f7c93" font-size="10">${esc(labelFn(d))}</text>`;
    }
  });

  container.innerHTML = `${svg}</svg>`;
}

function renderBreakdown(stats) {
  const rows = [
    ...(stats.courses || []).map((c) => ({ name: c.code, minutes: c.minutes, color: c.color })),
    ...(stats.trainings || []).map((t) => ({ name: t.name, minutes: t.minutes, color: trainingColor(t) })),
  ].filter((r) => r.minutes > 0).sort((a, b) => b.minutes - a.minutes);

  const container = $('#summaryBreakdown');
  if (!rows.length) {
    container.innerHTML = '<div class="breakdown-empty">Bu aralıkta ders veya eğitim kaydı yok.</div>';
    return;
  }
  const max = Math.max(...rows.map((r) => r.minutes), 1);
  container.innerHTML = rows.map((r) => `
    <div class="breakdown-row">
      <span class="name" title="${esc(r.name)}">${esc(r.name)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(r.minutes / max) * 100}%;background:${r.color || '#f0b45a'}"></span></span>
      <span class="value">${fmtMinutes(r.minutes)}</span>
    </div>
  `).join('');
}

function renderDailySummary() {
  const yesterday = addDays(state.today, -1);
  const today = state.today;
  const tomorrow = addDays(state.today, 1);
  const series = state.stats?.series || [];
  const y = series.find((d) => d.date === yesterday);
  const t = series.find((d) => d.date === today);
  const tomorrowItems = (state.summary?.upcoming || []).filter((i) => String(i.due_date).slice(0, 10) === tomorrow);

  $('#dailySummary').innerHTML = `
    <div class="summary-block">
      <h3>Dün · ${fmtDate(yesterday)}</h3>
      <p><b>${fmtMinutes(y?.minutes || 0)}</b> çalışma · ${y?.entries || 0} kayıt${y?.note ? ` · “${esc(y.note)}”` : ''}</p>
    </div>
    <div class="summary-block">
      <h3>Bugün · ${fmtDate(today)}</h3>
      <p><b>${fmtMinutes(t?.minutes || 0)}</b> çalışma · hedef ${fmtMinutes(state.settings.daily_minutes)} · %${pct(t?.minutes || 0, state.settings.daily_minutes)}</p>
    </div>
    <div class="summary-block">
      <h3>Yarın · ${fmtDate(tomorrow)}</h3>
      <p>${tomorrowItems.length ? tomorrowItems.map((i) => `<b>${esc(i.title)}</b> (${fmtDateTime(i.due_date)})`).join(' · ') : 'Planlı teslim veya sınav yok.'}</p>
    </div>
    <div class="summary-block">
      <h3>Tek odak</h3>
      <p>${state.summary?.next ? `<b>${esc(state.summary.next.title)}</b> · ${relativeDay(state.summary.next.due_date)}` : 'Yaklaşan kritik kayıt yok; zayıf derse 45 dk ayır.'}</p>
    </div>
  `;
}

function renderHeatmap(heat) {
  const el = $('#heatmap');
  if (!heat) {
    el.innerHTML = '';
    return;
  }
  const goals = state.settings;
  const cells = [];
  const first = heat.series[0].date;
  for (let i = 0; i < weekdayIndex(first); i += 1) {
    cells.push('<i class="hm empty" aria-hidden="true"></i>');
  }

  for (const d of heat.series) {
    let level = 0;
    if (d.minutes > 0 || d.note) {
      const ratio = goals.daily_minutes ? d.minutes / goals.daily_minutes : 0;
      level = ratio >= 1 ? 4 : ratio >= 0.7 ? 3 : ratio >= 0.35 ? 2 : 1;
    }
    cells.push(`<i class="hm l${level}" title="${esc(fmtDate(d.date))} · ${fmtMinutes(d.minutes)}"></i>`);
  }

  while (cells.length % 7 !== 0) cells.push('<i class="hm empty" aria-hidden="true"></i>');
  el.innerHTML = cells.join('');
}

/* -------------------------------------------------------------- settings */

function renderSettings() {
  if (!state.settings) return;
  const s = state.settings;
  $('#studentNameInput').value = s.student_name;
  $('#dailyHours').value = trimZero(s.daily_minutes / 60);
  $('#weeklyHours').value = trimZero(s.weekly_minutes / 60);
  $('#gnoTarget').value = s.gno_target;
  $('#previousGno').value = s.previous_gno;
  $('#previousEcts').value = s.previous_ects;
  $('#targetEcts').value = s.target_ects;

  $('#scaleTable').innerHTML = state.gradeScale.map((g) => `
    <div class="scale-item"><span>${g.grade} · ${g.min}+</span><b>${fmtPoint(g.point)}</b></div>
  `).join('');
}

async function saveSettings(event) {
  event.preventDefault();
  const button = $('button[type="submit"]', $('#settingsForm'));
  button.disabled = true;
  try {
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        student_name: $('#studentNameInput').value,
        daily_minutes: Math.round((Number($('#dailyHours').value) || 0) * 60),
        weekly_minutes: Math.round((Number($('#weeklyHours').value) || 0) * 60),
        gno_target: Number($('#gnoTarget').value) || 0,
        previous_gno: Number($('#previousGno').value) || 0,
        previous_ects: Number($('#previousEcts').value) || 0,
        target_ects: Number($('#targetEcts').value) || 240,
      }),
    });
    await refreshAll();
    toast('Ayarlar kaydedildi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
  }
}

async function importData() {
  const file = $('#importFile').files?.[0];
  if (!file) {
    toast('Önce bir CSV veya HTML dosyası seç.', true);
    return;
  }
  if (file.size > 1_000_000) {
    toast('Dosya 1 MB sınırını aşıyor.', true);
    return;
  }
  const button = $('#importBtn');
  button.disabled = true;
  try {
    const text = await file.text();
    const result = await api('/api/import', {
      method: 'POST',
      body: JSON.stringify({ kind: $('#importKind').value, text }),
    });
    $('#importMessage').textContent = [
      `${result.imported} eklendi`,
      result.updated ? `${result.updated} güncellendi` : null,
      result.days ? `${result.days} gün` : null,
      result.skipped ? `${result.skipped} atlandı` : null,
    ].filter(Boolean).join(' · ');
    $('#importFile').value = '';
    await refreshAll();
    if (result.errors?.length) toast(result.errors[0], true);
    else toast('İçe aktarma tamamlandı.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
  }
}

/* -------------------------------------------------------------- aybuzem */

async function loadAybuzemStatus() {
  try {
    state.aybuzem = await api('/api/aybuzem/status');
    const s = state.aybuzem;
    $('#aybuzemStatus').textContent = s.configured ? (s.status === 'ok' ? 'bağlı' : s.status) : 'yapılandırılmadı';
    $('#aybuzemBase').value = s.baseUrl || 'https://aybuzem.aybu.edu.tr';
    if (s.username) $('#aybuzemUser').value = s.username;
    $('#aybuzemMessage').textContent = s.lastSyncAt
      ? `Son senkron: ${s.lastSyncAt} · ${s.message || ''}`
      : 'Moodle mobil web servisi gerekir; veriler salt okunur çekilir.';
  } catch (err) {
    toast(err.message, true);
  }
}

async function saveAybuzem(event) {
  event.preventDefault();
  const button = $('button[type="submit"]', $('#aybuzemForm'));
  button.disabled = true;
  try {
    state.aybuzem = await api('/api/aybuzem/config', {
      method: 'POST',
      body: JSON.stringify({
        baseUrl: $('#aybuzemBase').value,
        username: $('#aybuzemUser').value,
        password: $('#aybuzemPass').value,
      }),
    });
    $('#aybuzemPass').value = '';
    await loadAybuzemStatus();
    toast('AYBÜZEM ayarları kaydedildi.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
  }
}

async function runAybuzemSync() {
  const button = $('#aybuzemSync');
  button.disabled = true;
  button.textContent = 'Senkronize ediliyor…';
  try {
    const result = await api('/api/aybuzem/sync', { method: 'POST' });
    await loadAybuzemStatus();
    await refreshAll();
    toast(`AYBÜZEM: ${result.courses} ders, ${result.assignments} ödev, ${result.events} etkinlik.`);
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Şimdi senkronize et';
  }
}

/* ------------------------------------------------------------------ run */

init();
