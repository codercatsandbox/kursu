import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'kursu.db');
const STATE_DIR = path.join(os.homedir(), '.local', 'state');
const STATE_PATH = process.env.KURSU_BILDIRIM_STATE || path.join(STATE_DIR, 'kursu-bildirim.json');
const ICON = path.join(os.homedir(), '.local', 'share', 'icons', 'kursu.png');
const CLOSED_STATUSES = new Set(['bitti', 'tamamlandi', 'girildi', 'iptal', 'gecildi', 'yapildi']);

function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if (!state.notified || typeof state.notified !== 'object') state.notified = {};
    return state;
  } catch {
    return { notified: {} };
  }
}

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function writeState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  state.notified = state.notified || {};
  const cutoff = localISODate(new Date(Date.now() - 14 * 86400000));
  for (const [key, value] of Object.entries(state.notified)) {
    if (String(value) < cutoff) delete state.notified[key];
  }
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function sendNotification(title, body, urgency = 'normal', dryRun = false) {
  if (dryRun) {
    console.log(`[dry-run] ${title}\n${body}\n`);
    return true;
  }
  const args = ['-a', 'Kürsü', '-u', urgency];
  if (fs.existsSync(ICON)) args.push('-i', ICON);
  args.push(title, body);
  const result = spawnSync('/usr/bin/notify-send', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error(`  notify-send hatası: ${result.error?.message || result.stderr || `kod ${result.status}`}`);
    return false;
  }
  return true;
}

function openDb() {
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

export function notifyNewMaterials({ dryRun = false } = {}) {
  const db = openDb();
  const max = Number(db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM materials').get().id);
  const state = readState();

  if (!Number.isInteger(state.lastMaterialId)) {
    if (!dryRun) {
      state.lastMaterialId = max;
      writeState(state);
    }
    db.close();
    return { ok: true, notified: 0, reason: 'ilk çalıştırma' };
  }

  const rows = db.prepare(`
    SELECT m.id, m.title, COALESCE(c.code, 'Ders') AS code
      FROM materials m
      LEFT JOIN courses c ON c.id = m.course_id
     WHERE m.id > ?
     ORDER BY m.id
  `).all(state.lastMaterialId);
  db.close();

  if (!rows.length) return { ok: true, notified: 0 };

  const byCourse = new Map();
  for (const row of rows) {
    byCourse.set(row.code, (byCourse.get(row.code) || 0) + 1);
  }
  const summary = [...byCourse.entries()].map(([code, count]) => `${code} (${count})`).join(', ');
  const titles = rows.slice(0, 4).map((row) => `• ${row.code} · ${row.title}`).join('\n');
  const more = rows.length > 4 ? `\n… ve ${rows.length - 4} dosya daha` : '';
  const body = `${summary}\n${titles}${more}`;
  const title = `Kürsü · ${rows.length} yeni dosya`;

  if (!sendNotification(title, body, 'normal', dryRun)) {
    return { ok: false, notified: 0, reason: 'bildirim gönderilemedi' };
  }
  if (!dryRun) {
    state.lastMaterialId = max;
    writeState(state);
  }
  return { ok: true, notified: rows.length };
}

function formatDate(date) {
  const dateText = date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  if (!hasTime) return dateText;
  return `${dateText} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

function relativeDays(days) {
  if (days === 0) return 'bugün';
  if (days === 1) return 'yarın';
  return `${days} gün sonra`;
}

export function notifyDeadlines({ dryRun = false, days = 3 } = {}) {
  const db = openDb();
  const modifier = `+${Math.max(0, Number(days) || 3)} days`;
  const assessments = db.prepare(`
    SELECT a.id, a.title, a.date, a.status, c.code
      FROM assessments a
      LEFT JOIN courses c ON c.id = a.course_id
     WHERE a.date IS NOT NULL
       AND date(a.date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', ?)
     ORDER BY a.date
  `).all(modifier);
  const tasks = db.prepare(`
    SELECT t.id, t.title, t.due_date, t.status, c.code
      FROM tasks t
      LEFT JOIN courses c ON c.id = t.course_id
     WHERE t.due_date IS NOT NULL
       AND date(t.due_date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', ?)
     ORDER BY t.due_date
  `).all(modifier);
  db.close();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = [];

  for (const row of assessments) {
    if (CLOSED_STATUSES.has(String(row.status).toLowerCase())) continue;
    const date = new Date(row.date);
    if (Number.isNaN(date.getTime())) continue;
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const diff = Math.round((dateOnly - today) / 86400000);
    if (diff < 0 || diff > days) continue;
    const isoDate = localISODate(date);
    items.push({ key: `assessment:${row.id}:${isoDate}`, kind: 'Sınav', title: row.title, code: row.code, date, diff });
  }

  for (const row of tasks) {
    if (CLOSED_STATUSES.has(String(row.status).toLowerCase())) continue;
    const date = new Date(row.due_date);
    if (Number.isNaN(date.getTime())) continue;
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const diff = Math.round((dateOnly - today) / 86400000);
    if (diff < 0 || diff > days) continue;
    const isoDate = localISODate(date);
    items.push({ key: `task:${row.id}:${isoDate}`, kind: 'Teslim', title: row.title, code: row.code, date, diff });
  }

  const state = readState();
  const todayISO = localISODate();
  const todayItems = [];
  const upcomingItems = [];
  for (const item of items) {
    const last = state.notified[item.key];
    if (item.diff === 0 && last !== todayISO) todayItems.push(item);
    if (item.diff > 0 && !last) upcomingItems.push(item);
  }

  const included = [...todayItems, ...upcomingItems];
  if (!included.length) return { ok: true, notified: 0 };

  const lines = [];
  if (todayItems.length) {
    lines.push('Bugün:');
    for (const item of todayItems) {
      lines.push(`• ${item.code ? `${item.code} · ` : ''}${item.title} · ${formatDate(item.date)}`);
    }
  }
  if (upcomingItems.length) {
    if (lines.length) lines.push('');
    lines.push('Yaklaşan:');
    for (const item of upcomingItems) {
      lines.push(`• ${item.code ? `${item.code} · ` : ''}${item.title} · ${formatDate(item.date)} (${relativeDays(item.diff)})`);
    }
  }
  const title = todayItems.length
    ? `Kürsü · Bugün ${todayItems.length} tarih`
    : `Kürsü · ${upcomingItems.length} yaklaşan tarih`;
  const urgency = todayItems.length ? 'critical' : 'normal';
  const body = lines.slice(0, 16).join('\n') + (lines.length > 16 ? '\n…' : '');

  if (!sendNotification(title, body, urgency, dryRun)) {
    return { ok: false, notified: 0, reason: 'bildirim gönderilemedi' };
  }
  if (!dryRun) {
    for (const item of included) state.notified[item.key] = todayISO;
    writeState(state);
  }
  return { ok: true, notified: included.length, today: todayItems.length, upcoming: upcomingItems.length };
}
