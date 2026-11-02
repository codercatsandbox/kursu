import { chmod, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, db, todayISO } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.AYBUZEM_CONFIG_PATH
  ? path.resolve(process.env.AYBUZEM_CONFIG_PATH)
  : path.join(__dirname, '..', 'data', 'aybuzem.json');
const DEFAULT_BASE = 'https://aybuzem.aybu.edu.tr';
const SYNC_INTERVAL_MS = 30 * 60 * 1000;

// Şifre diske yazılmaz; yalnızca bu süreçte token almak için tutulur.
let sessionPassword = '';
let scheduledSyncRunning = false;

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

function contentRoot() {
  if (process.env.AYBUZEM_CONTENT_DIR) return path.resolve(process.env.AYBUZEM_CONTENT_DIR);
  const home = homedir();
  const desktop = ['Masaüstü', 'Desktop'].map((name) => path.join(home, name)).find(existsSync)
    ?? path.join(home, 'Masaüstü');
  return path.join(desktop, 'CENG 3rd Fall');
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function safePathPart(value, fallback = 'genel') {
  let cleaned = decodeHtmlEntities(value || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  cleaned = cleaned.replace(/[ .]+$/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) return `_${cleaned}`;
  return cleaned.slice(0, 120);
}

function contentFileName(content) {
  const rawName = decodeHtmlEntities(content.filename || `file-${content.type || 'content'}`);
  if (content.type === 'url' && !/\.[a-z0-9]{2,8}$/i.test(rawName)) return `${rawName}.html`;
  return rawName;
}

function contentWithoutUrl(content) {
  const { fileurl, ...safeContent } = content;
  return safeContent;
}

function syncSectionTopic(localCourse, section, index) {
  if (!localCourse || !section.name || /^general$/i.test(section.name.trim())) return false;
  const title = section.name.trim();
  const exists = db.prepare('SELECT id FROM topics WHERE course_id = ? AND lower(title) = lower(?)').get(localCourse.id, title);
  if (exists) return false;
  const week = Number.isInteger(Number(section.section)) ? Number(section.section) : index;
  const order = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM topics WHERE course_id = ?').get(localCourse.id).n || 0) + 10;
  db.prepare(`
    INSERT INTO topics (course_id, week, title, status, resource, note, sort_order)
    VALUES (?, ?, ?, 'planlandi', 'AYBÜZEM', 'AYBÜZEM içerik senkronundan eklendi.', ?)
  `).run(localCourse.id, Math.max(0, week), title, order);
  return true;
}

async function downloadContentFile(baseUrl, token, fileurl, destination) {
  const url = new URL(fileurl, `${baseUrl}/`);
  url.searchParams.set('token', token);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Dosya indirilemedi (${response.status}): ${url.pathname}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function syncCourseContents(baseUrl, token, sourceId, remoteCourseId, localCourse) {
  const sections = await callWs(baseUrl, token, 'core_course_get_contents', { courseid: remoteCourseId });
  const root = contentRoot();
  const courseName = safePathPart(localCourse?.code || `course-${remoteCourseId}`);
  const courseDir = path.join(root, courseName);
  const manifest = { course: localCourse?.code || null, remoteCourseId, syncedAt: new Date().toISOString(), sections: [] };
  let files = 0;
  let topics = 0;

  for (const [index, section] of (Array.isArray(sections) ? sections : []).entries()) {
    if (syncSectionTopic(localCourse, section, index + 1)) topics += 1;
    const sectionRecord = { id: section.id, name: section.name || '', summary: section.summary || '', modules: [] };
    for (const module of section.modules || []) {
      const moduleRecord = { id: module.id, name: module.name || '', modname: module.modname || '', contents: [] };
      for (const content of module.contents || []) {
        const safeContent = contentWithoutUrl(content);
        if (content.fileurl) {
          const filename = safePathPart(contentFileName(content));
          const destination = path.join(courseDir, safePathPart(section.name), safePathPart(module.name), filename);
          await downloadContentFile(baseUrl, token, content.fileurl, destination);
          const relativePath = path.relative(root, destination);
          safeContent.localPath = relativePath;
          files += 1;
          upsertSyncItem(sourceId, `file:${remoteCourseId}:${module.id}:${content.filename}:${content.fileurl}`, 'content_file', localCourse?.id ?? null, {
            ...safeContent,
            localPath: relativePath,
          });
        }
        moduleRecord.contents.push(safeContent);
      }
      upsertSyncItem(sourceId, `content:${remoteCourseId}:${module.id}`, 'content_module', localCourse?.id ?? null, moduleRecord);
      sectionRecord.modules.push(moduleRecord);
    }
    upsertSyncItem(sourceId, `content-section:${remoteCourseId}:${section.id}`, 'content_section', localCourse?.id ?? null, sectionRecord);
    manifest.sections.push(sectionRecord);
  }

  await mkdir(courseDir, { recursive: true });
  await writeFile(path.join(courseDir, 'contents.json'), JSON.stringify(manifest, null, 2));
  return { sections: manifest.sections.length, files, topics };
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
    const contentSummary = { courses: 0, sections: 0, files: 0, topics: 0, errors: [] };
    for (const course of Array.isArray(courses) ? courses : []) {
      const local = matchLocalCourse(course);
      if (local) {
        localCourses.set(Number(course.id), local);
        db.prepare('UPDATE courses SET external_id = ? WHERE id = ?').run(String(course.id), local.id);
      }
      upsertSyncItem(source.id, `course:${course.id}`, 'course', local?.id ?? null, course);
      try {
        const result = await syncCourseContents(baseUrl, token, source.id, course.id, local);
        contentSummary.courses += 1;
        contentSummary.sections += result.sections;
        contentSummary.files += result.files;
        contentSummary.topics += result.topics;
      } catch (err) {
        contentSummary.errors.push(`${course.shortname || course.fullname || course.id}: ${err.message}`);
      }
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
    `).run(`${courses?.length ?? 0} ders, ${assignments.length} ödev, ${events?.events?.length ?? 0} etkinlik, ${contentSummary.files} içerik dosyası`, source.id);

    return {
      ok: true,
      courses: courses?.length ?? 0,
      matchedCourses: localCourses.size,
      assignments: assignments.length,
      events: events?.events?.length ?? 0,
      content: contentSummary,
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

export function startAybuzemScheduler() {
  const run = async () => {
    if (scheduledSyncRunning) return;
    const status = await getAybuzemStatus();
    if (!status.configured) return;
    scheduledSyncRunning = true;
    try {
      const result = await syncAybuzem();
      console.log(`  AYBÜZEM otomatik senkron: ${result.courses} ders, ${result.content.files} içerik dosyası`);
    } catch (err) {
      console.error(`  AYBÜZEM otomatik senkron başarısız: ${err.message}`);
    } finally {
      scheduledSyncRunning = false;
    }
  };

  void run();
  const timer = setInterval(run, SYNC_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

export function aybuzemToday() {
  return todayISO();
}
