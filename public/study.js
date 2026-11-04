// Kürsü study viewer — no dependencies, same-origin API only.
const $ = (selector) => document.querySelector(selector);

const params = new URLSearchParams(location.search);
const materialId = Number(params.get('material'));

let material = null;
let sessionId = null;
let sessionClosed = false;
let currentPage = 1;
let pageKind = false;
let frameUrl = '';

function status(message, isError = false) {
  const el = $('#studyStatus');
  el.textContent = message;
  el.classList.toggle('error', isError);
}

function setError(message) {
  const el = $('#studyError');
  el.textContent = message;
  el.hidden = false;
  status(message, true);
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
    /* empty body */
  }
  if (!res.ok) throw new Error(data?.error || `İstek başarısız (${res.status}).`);
  return data;
}

function sessionKey() {
  return `kursu.studySession.${materialId}`;
}

function savedSessionId() {
  try {
    return Number(sessionStorage.getItem(sessionKey())) || null;
  } catch {
    return null;
  }
}

function rememberSession(id) {
  try {
    sessionStorage.setItem(sessionKey(), String(id));
  } catch {
    /* storage unavailable */
  }
}

function forgetSession() {
  try {
    sessionStorage.removeItem(sessionKey());
  } catch {
    /* storage unavailable */
  }
}

function setFrame(page) {
  if (!material) return;
  const target = `${frameUrl}#page=${page}&zoom=page-width&toolbar=1`;
  const frame = $('#materialFrame');
  if (frame.src === target) return;
  frame.src = target;
}

function updatePage(page, { navigate = true, announce = false } = {}) {
  const max = material?.page_count || null;
  let next = Number(page) || 1;
  if (next < 1) next = 1;
  if (max) next = Math.min(max, next);
  currentPage = next;
  $('#pageInput').value = String(next);
  $('#pageMeta').textContent = max ? `${next} / ${max} sayfa` : `${next}. sayfa`;
  if (navigate) setFrame(next);
  if (announce) status(`Sayfa ${next} açıldı.`);
}

async function startSession() {
  try {
    const previous = savedSessionId();
    if (previous) {
      const existing = await api(`/api/study/sessions/${previous}`);
      if (existing && !existing.ended_at) {
        sessionId = existing.id;
        return;
      }
    }
  } catch {
    /* the old session was deleted; create a new one */
  }

  const created = await api('/api/study/sessions', {
    method: 'POST',
    body: JSON.stringify({
      course_id: material.course_id,
      topic_id: material.topic_id,
      material_id: material.id,
      start_page: currentPage,
    }),
  });
  sessionId = created.id;
  rememberSession(created.id);
}

async function saveProgress() {
  if (!material || !pageKind) return;
  await api(`/api/materials/${material.id}/progress`, {
    method: 'PUT',
    body: JSON.stringify({
      page: currentPage,
      page_count: material.page_count || undefined,
    }),
  });
}

async function closeSession({ silent = false } = {}) {
  if (!sessionId || sessionClosed) return;
  sessionClosed = true;
  try {
    await api(`/api/study/sessions/${sessionId}/close`, {
      method: 'POST',
      body: JSON.stringify({ end_page: pageKind ? currentPage : null }),
    });
    forgetSession();
    if (!silent) status('Çalışma oturumu kaydedildi.');
  } catch (err) {
    sessionClosed = false;
    if (!silent) status(err.message, true);
  }
}

async function savePlace() {
  try {
    await saveProgress();
    await closeSession({ silent: true });
    status(pageKind
      ? `Burada kaldın: ${currentPage}. sayfa kaydedildi.`
      : 'Materyal konumu kaydedildi.');
  } catch (err) {
    status(err.message, true);
  }
}

async function finishTopic() {
  if (!material?.topic_id) {
    status('Bu materyal bir konuya bağlı değil.', true);
    return;
  }
  if (!window.confirm('Bu konu "bitti" olarak işaretlensin mi?')) return;
  try {
    await api(`/api/topics/${material.topic_id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'bitti' }),
    });
    await savePlace();
    status('Konu bitti olarak işaretlendi.');
  } catch (err) {
    status(err.message, true);
  }
}

async function load() {
  if (!Number.isFinite(materialId) || materialId <= 0) {
    setError('Materyal kimliği eksik. Kürsü’deki ders detayından bir materyal aç.');
    return;
  }

  material = await api(`/api/materials/${materialId}`);
  pageKind = ['pdf', 'pptx', 'docx'].includes(String(material.kind || '').toLowerCase());
  frameUrl = `/api/materials/${material.id}/file`;

  document.title = `Kürsü · ${material.title}`;
  $('#studyEyebrow').textContent = [material.course_code, material.topic_week ? `${material.topic_week}. hafta` : '']
    .filter(Boolean).join(' · ') || 'Materyal';
  $('#studyTitle').textContent = material.title;
  $('#studyCourse').textContent = `${material.course_code || ''} ${material.course_name || ''}`.trim() || '—';
  $('#studyTopic').textContent = material.topic_title
    ? `${material.topic_week ? `${material.topic_week}. hafta · ` : ''}${material.topic_title}`
    : 'Konuya bağlı değil';
  $('#studyMaterial').textContent = material.kind ? `${material.kind.toUpperCase()} · ${material.title}` : material.title;

  if (!pageKind) {
    $('#studyControls').hidden = false;
    $('#pageInput').disabled = true;
    $('#goPage').disabled = true;
    $('#pageMeta').textContent = 'Bu materyal türünde sayfa takibi yok.';
    $('#savePlace').textContent = 'Konumu kaydet';
  }

  const requestedPage = Number(params.get('page')) || material.page || 1;
  updatePage(requestedPage, { navigate: false });
  setFrame(currentPage);

  try {
    await startSession();
    status(sessionId ? 'Çalışma oturumu açıldı.' : 'Materyal açıldı.');
  } catch (err) {
    status(`Oturum açılamadı: ${err.message}`, true);
  }
}

$('#goPage').addEventListener('click', () => updatePage($('#pageInput').value, { announce: true }));
$('#pageInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    updatePage($('#pageInput').value, { announce: true });
  }
});
$('#savePlace').addEventListener('click', savePlace);
$('#finishTopic').addEventListener('click', finishTopic);
$('#endSession').addEventListener('click', async () => {
  try {
    await saveProgress();
    await closeSession({ silent: true });
    status('Oturum kaydedildi.');
  } catch (err) {
    status(err.message, true);
  }
});

window.addEventListener('beforeunload', () => {
  if (!sessionId || sessionClosed) return;
  const body = new Blob([JSON.stringify({ end_page: pageKind ? currentPage : null })], {
    type: 'application/json',
  });
  navigator.sendBeacon(`/api/study/sessions/${sessionId}/close`, body);
});

load().catch((err) => setError(err.message));
