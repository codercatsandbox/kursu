import { chmod, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, db, todayISO } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.AYBUZEM_CONFIG_PATH
  ? path.resolve(process.env.AYBUZEM_CONFIG_PATH)
  : path.join(__dirname, '..', 'data', 'aybuzem.json');
const DEFAULT_BASE = 'https://aybuzem.aybu.edu.tr';

// Şifre diske yazılmaz; yalnızca bu süreçte token almak için tutulur.
let sessionPassword = '';

async function readConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new HttpError(500, 'AYBÜZEM ayar dosyası okunamadı.');
  }
}

async function writeConfig(config) {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  try {
    await chmod(CONFIG_PATH, 0o600);
  } catch {
    /* Windows'ta chmod etkisiz olabilir */
  }
}

function normalizeBase(value) {
  return String(value || DEFAULT_BASE).trim().replace(/\/+$/, '');
}

function sourceRow() {
  return db.prepare("SELECT * FROM sync_sources WHERE name = 'AYBÜZEM'").get();
}

function ensureSource(baseUrl) {
  db.prepare(`
    INSERT INTO sync_sources (name, base_url, status)
    VALUES ('AYBÜZEM', ?, 'bekliyor')
    ON CONFLICT(name) DO UPDATE SET base_url = excluded.base_url
  `).run(baseUrl);
  return sourceRow();
}

export async function getAybuzemStatus() {
  const config = await readConfig();
  const source = sourceRow();
  return {
    configured: Boolean(config?.username && (config?.token || sessionPassword)),
    baseUrl: config?.baseUrl || source?.base_url || DEFAULT_BASE,
    username: config?.username || '',
    hasToken: Boolean(config?.token),
    hasSessionPassword: Boolean(sessionPassword),
    lastSyncAt: source?.last_sync_at || null,
    status: source?.status || 'bekliyor',
    message: source?.message || '',
    configPath: CONFIG_PATH,
  };
}

export async function saveAybuzemConfig(payload) {
  const baseUrl = normalizeBase(payload.baseUrl);
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');
  const existing = await readConfig();
  if (!username) throw new HttpError(400, 'AYBÜZEM kullanıcı adı gerekli.');

  const usernameChanged = Boolean(existing?.username && existing.username !== username);
  if (password) {
    sessionPassword = password;
  } else if (usernameChanged) {
    sessionPassword = '';
  }

  const keepToken = !password && !usernameChanged;
  const token = payload.token || (keepToken ? existing?.token || '' : '');
  if (!token && !sessionPassword) {
    throw new HttpError(400, 'AYBÜZEM şifresi gerekli. Şifre yalnızca token almak için kullanılır, diske yazılmaz.');
  }

  const config = {
    baseUrl,
    username,
    token,
    savedAt: new Date().toISOString(),
  };
  await writeConfig(config);
  ensureSource(baseUrl);
  return getAybuzemStatus();
}

async function requestToken(baseUrl, username, password) {
  const body = new URLSearchParams({
    username,
    password,
    service: 'moodle_mobile_app',
  });
  let res;
  try {
    res = await fetch(`${baseUrl}/login/token.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    throw new HttpError(502, `AYBÜZEM’e bağlanılamadı: ${err.message}`);
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(502, 'AYBÜZEM token yanıtı JSON değil. Web servisleri kapalı olabilir.');
  }
  if (data.error) throw new HttpError(401, `AYBÜZEM giriş hatası: ${data.error}`);
  if (!data.token) throw new HttpError(502, 'AYBÜZEM token döndürmedi. Mobil web servisi kapalı olabilir.');
  return data.token;
}

async function callWs(baseUrl, token, fn, params = {}) {
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction: fn,
    moodlewsrestformat: 'json',
  });
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v, i) => body.append(`${key}[${i}]`, String(v)));
    } else if (value !== undefined && value !== null && value !== '') {
      body.append(key, String(value));
    }
  }

  let res;
  try {
    res = await fetch(`${baseUrl}/webservice/rest/server.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    throw new HttpError(502, `AYBÜZEM web servisi hatası: ${err.message}`);
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(502, `AYBÜZEM ${fn} yanıtı JSON değil.`);
  }
  if (data?.exception || data?.error) {
    throw new HttpError(502, data.message || data.error || `${fn} çağrısı başarısız.`);
  }
  return data;
}

function unixToLocal(unix) {
  if (!unix) return null;
  const d = new Date(Number(unix) * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function upsertSyncItem(sourceId, externalId, kind, courseId, payload) {
  db.prepare(`
    INSERT INTO sync_items (source_id, external_id, kind, course_id, payload_json, fetched_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(source_id, external_id) DO UPDATE SET
      kind = excluded.kind,
      course_id = excluded.course_id,
      payload_json = excluded.payload_json,
      fetched_at = excluded.fetched_at
  `).run(sourceId, externalId, kind, courseId ?? null, JSON.stringify(payload));
}

function matchLocalCourse(course) {
  const source = `${course.shortname || ''} ${course.fullname || ''}`.toUpperCase();
  const code = source.match(/\b[A-Z]{2,5}\d{3}\b/)?.[0];
  if (!code) return null;
  return db.prepare('SELECT * FROM courses WHERE upper(code) = ?').get(code) ?? null;
}

export async function syncAybuzem() {
  const config = await readConfig();
  if (!config?.username) {
    throw new HttpError(400, 'Önce Ayarlar → AYBÜZEM bölümünden kullanıcı adı ve şifreyi kaydet.');
  }
  const baseUrl = normalizeBase(config.baseUrl);
  const source = ensureSource(baseUrl);

  let token = config.token;
  if (!token) {
    if (!sessionPassword) {
      throw new HttpError(400, 'AYBÜZEM token yok veya süresi doldu. Ayarlar bölümünden şifreyi yeniden girip kaydet.');
    }
    token = await requestToken(baseUrl, config.username, sessionPassword);
    await writeConfig({
      baseUrl,
      username: config.username,
      token,
      savedAt: new Date().toISOString(),
    });
  }

  try {
    const site = await callWs(baseUrl, token, 'core_webservice_get_site_info');
    const courses = await callWs(baseUrl, token, 'core_enrol_get_users_courses', { userid: site.userid });
    const localCourses = new Map();
    for (const course of Array.isArray(courses) ? courses : []) {
      const local = matchLocalCourse(course);
      if (local) {
        localCourses.set(Number(course.id), local);
        db.prepare('UPDATE courses SET external_id = ? WHERE id = ?').run(String(course.id), local.id);
      }
      upsertSyncItem(source.id, `course:${course.id}`, 'course', local?.id ?? null, course);
    }

    const courseIds = [...localCourses.keys()];
    let assignments = [];
    if (courseIds.length) {
      const data = await callWs(baseUrl, token, 'mod_assign_get_assignments', { courseids: courseIds });
      assignments = (data.courses || []).flatMap((c) => c.assignments || []);
      for (const assignment of assignments) {
        const local = localCourses.get(Number(assignment.course));
        upsertSyncItem(source.id, `assign:${assignment.id}`, 'assignment', local?.id ?? null, assignment);
        const due = unixToLocal(assignment.duedate);
        db.prepare(`
          INSERT INTO tasks (course_id, title, kind, due_date, priority, status, note, source, external_id)
          VALUES (?, ?, 'teslim', ?, 'normal', 'acik', ?, 'aybuzem', ?)
          ON CONFLICT(source, external_id) DO UPDATE SET
            title = excluded.title,
            due_date = excluded.due_date,
            course_id = excluded.course_id,
            note = excluded.note
        `).run(
          local?.id ?? null,
          assignment.name || 'AYBÜZEM ödevi',
          due,
          assignment.intro ? String(assignment.intro).replace(/<[^>]+>/g, ' ').slice(0, 500) : '',
          `assign:${assignment.id}`,
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const events = await callWs(baseUrl, token, 'core_calendar_get_action_events_by_timesort', {
      timesortfrom: now - 7 * 86400,
      timesortto: now + 90 * 86400,
      limitnum: 50,
    });
    for (const event of events.events || []) {
      upsertSyncItem(source.id, `event:${event.id}`, 'event', null, event);
    }

    db.prepare(`
      UPDATE sync_sources SET last_sync_at = datetime('now'), status = 'ok', message = ?
       WHERE id = ?
    `).run(`${courses?.length ?? 0} ders, ${assignments.length} ödev, ${events?.events?.length ?? 0} etkinlik`, source.id);

    return {
      ok: true,
      courses: courses?.length ?? 0,
      matchedCourses: localCourses.size,
      assignments: assignments.length,
      events: events?.events?.length ?? 0,
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    db.prepare(`
      UPDATE sync_sources SET status = 'hata', message = ?, last_sync_at = datetime('now')
       WHERE id = ?
    `).run(String(err.message || err).slice(0, 500), source.id);
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      sessionPassword = '';
      await writeConfig({
        baseUrl,
        username: config.username,
        token: '',
        savedAt: new Date().toISOString(),
      });
    }
    throw err;
  }
}

export function aybuzemToday() {
  return todayISO();
}
