import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DB_PATH,
  HttpError,
  addCourse,
  addMilestone,
  addTopic,
  addTraining,
  createAssessment,
  createStudySession,
  createTask,
  db,
  deleteAssessment,
  deleteCourse,
  deleteMilestone,
  deleteTask,
  deleteTopic,
  deleteTraining,
  exportCsv,
  getBootstrap,
  getCourse,
  getDay,
  getGno,
  getMaterial,
  getStats,
  getStudyResume,
  getStudySession,
  getStudyToday,
  getSummary,
  getTraining,
  importCsv,
  listAssessments,
  listCourses,
  listLogs,
  listMaterials,
  listTasks,
  listTopics,
  listTrainings,
  nowLocalISO,
  saveDay,
  saveMaterialProgress,
  todayISO,
  updateAssessment,
  updateCourse,
  updateMilestone,
  updateSettings,
  updateStudySession,
  updateTask,
  updateTopic,
  updateTraining,
} from './db.js';
import { contentRoot, getAybuzemStatus, saveAybuzemConfig, startAybuzemScheduler, syncAybuzem } from './integrations/aybuzem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 5174;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 1_000_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Gönderilen veri çok büyük.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Geçersiz JSON gövdesi.'));
      }
    });
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'Geçersiz dosya yolu.');
  }
  if (relative === '/' || relative === '') relative = '/index.html';

  const filePath = path.resolve(PUBLIC_DIR, `.${relative}`);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(403, 'Erişim yok.');

  let content;
  try {
    content = await readFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') throw new HttpError(404, 'Sayfa bulunamadı.');
    throw err;
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': content.length,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : content);
}

function matchId(pathname, pattern) {
  const m = pathname.match(pattern);
  return m ? Number(m[1]) : null;
}

async function serveMaterialFile(req, res, id) {
  const material = getMaterial(id);
  if (!material.local_path) throw new HttpError(404, 'Materyal dosyası yok.');

  const root = path.resolve(contentRoot());
  const filePath = path.resolve(root, material.local_path);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    throw new HttpError(403, 'Materyal yolu içerik klasörünün dışında.');
  }

  let info;
  try {
    info = await stat(filePath);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') throw new HttpError(404, 'Materyal dosyası bulunamadı.');
    throw err;
  }
  if (!info.isFile()) throw new HttpError(404, 'Materyal dosyası değil.');

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`,
  };
  // İndirilen HTML materyalleri Kürsü API'sine erişemesin.
  if (ext === '.html' || ext === '.htm') {
    headers['Content-Security-Policy'] = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
  }

  const range = req.headers.range;
  if (typeof range === 'string' && range.startsWith('bytes=')) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      return res.end();
    }
    let start = m[1] === '' ? null : Number(m[1]);
    let end = m[2] === '' ? null : Number(m[2]);
    if (start === null && end !== null) {
      start = Math.max(0, info.size - end);
      end = info.size - 1;
    } else {
      start = start ?? 0;
      end = end ?? info.size - 1;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= info.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      return res.end();
    }
    end = Math.min(end, info.size - 1);
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${info.size}`,
      'Content-Length': end - start + 1,
    });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(filePath, { start, end }).pipe(res);
  }

  res.writeHead(200, {
    ...headers,
    'Content-Length': info.size,
  });
  if (req.method === 'HEAD') return res.end();
  return createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;
  const params = url.searchParams;

  if (pathname === '/api/bootstrap' && method === 'GET') {
    return sendJson(res, 200, getBootstrap());
  }

  if (pathname === '/api/summary' && method === 'GET') {
    return sendJson(res, 200, getSummary(params.get('date') || todayISO()));
  }

  if (pathname === '/api/stats' && method === 'GET') {
    return sendJson(res, 200, getStats(Number(params.get('days')) || 30));
  }

  if (pathname === '/api/gno' && method === 'GET') {
    return sendJson(res, 200, getGno());
  }

  if (pathname === '/api/settings' && method === 'PUT') {
    return sendJson(res, 200, updateSettings(await readJson(req)));
  }

  /* ---------------------------------------------------------------- days */
  if (pathname === '/api/days' && method === 'GET') {
    const to = params.get('to') || todayISO();
    const from = params.get('from') || to;
    return sendJson(res, 200, listLogs(from, to));
  }

  const dayMatch = pathname.match(/^\/api\/days\/(\d{4}-\d{2}-\d{2})$/);
  if (dayMatch) {
    const date = dayMatch[1];
    if (method === 'GET') return sendJson(res, 200, getDay(date));
    if (method === 'PUT') return sendJson(res, 200, saveDay(date, await readJson(req)));
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  /* ------------------------------------------------------------- courses */
  if (pathname === '/api/courses' && method === 'GET') {
    return sendJson(res, 200, listCourses());
  }
  if (pathname === '/api/courses' && method === 'POST') {
    return sendJson(res, 201, addCourse(await readJson(req)));
  }

  const courseId = matchId(pathname, /^\/api\/courses\/(\d+)$/);
  if (courseId !== null) {
    if (method === 'GET') return sendJson(res, 200, getCourse(courseId));
    if (method === 'PUT') return sendJson(res, 200, updateCourse(courseId, await readJson(req)));
    if (method === 'DELETE') {
      deleteCourse(courseId);
      res.writeHead(204);
      return res.end();
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  const courseTopics = matchId(pathname, /^\/api\/courses\/(\d+)\/topics$/);
  if (courseTopics !== null) {
    if (method === 'GET') return sendJson(res, 200, listTopics(courseTopics));
    if (method === 'POST') return sendJson(res, 201, addTopic(courseTopics, await readJson(req)));
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  const courseMaterials = matchId(pathname, /^\/api\/courses\/(\d+)\/materials$/);
  if (courseMaterials !== null) {
    if (method === 'GET') return sendJson(res, 200, listMaterials(courseMaterials));
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  /* ------------------------------------------------------------ materials */
  const materialFile = matchId(pathname, /^\/api\/materials\/(\d+)\/file$/);
  if (materialFile !== null) {
    if (method === 'GET' || method === 'HEAD') return serveMaterialFile(req, res, materialFile);
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  const materialProgress = matchId(pathname, /^\/api\/materials\/(\d+)\/progress$/);
  if (materialProgress !== null) {
    if (method === 'PUT' || method === 'POST') {
      return sendJson(res, 200, saveMaterialProgress(materialProgress, await readJson(req)));
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  const materialId = matchId(pathname, /^\/api\/materials\/(\d+)$/);
  if (materialId !== null) {
    if (method === 'GET') return sendJson(res, 200, getMaterial(materialId));
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  /* -------------------------------------------------------------- topics */
  if (pathname === '/api/topics' && method === 'GET') {
    const course = Number(params.get('course_id'));
    if (!course) throw new HttpError(400, 'course_id gerekli.');
    return sendJson(res, 200, listTopics(course));
  }
  const topicId = matchId(pathname, /^\/api\/topics\/(\d+)$/);
  if (topicId !== null) {
    if (method === 'PUT') return sendJson(res, 200, updateTopic(topicId, await readJson(req)));
    if (method === 'DELETE') {
      deleteTopic(topicId);
      res.writeHead(204);
      return res.end();
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  /* --------------------------------------------------------------- study */
  if (pathname === '/api/study/resume' && method === 'GET') {
    return sendJson(res, 200, getStudyResume(params.get('course') || params.get('course_id')));
  }

  if (pathname === '/api/study/today' && method === 'GET') {
    return sendJson(res, 200, getStudyToday(params.get('date') || todayISO()));
  }

  if (pathname === '/api/study/sessions' && method === 'POST') {
    return sendJson(res, 201, createStudySession(await readJson(req)));
  }

  const studySessionClose = matchId(pathname, /^\/api\/study\/sessions\/(\d+)\/close$/);
  if (studySessionClose !== null) {
    if (method === 'POST' || method === 'PATCH') {
      const payload = await readJson(req);
      return sendJson(res, 200, updateStudySession(studySessionClose, {
        ...payload,
        ended_at: payload.ended_at || nowLocalISO(),
      }));
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  const studySessionId = matchId(pathname, /^\/api\/study\/sessions\/(\d+)$/);
  if (studySessionId !== null) {
    if (method === 'GET') return sendJson(res, 200, getStudySession(studySessionId));
    if (method === 'PATCH' || method === 'PUT') {
      return sendJson(res, 200, updateStudySession(studySessionId, await readJson(req)));
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  /* --------------------------------------------------------- assessments */
  if (pathname === '/api/assessments' && method === 'GET') {
    const course = params.get('course_id');
    return sendJson(res, 200, listAssessments(course ? Number(course) : null));
  }
  if (pathname === '/api/assessments' && method === 'POST') {
    return sendJson(res, 201, createAssessment(await readJson(req)));
  }
  const assessmentId = matchId(pathname, /^\/api\/assessments\/(\d+)$/);
  if (assessmentId !== null) {
    if (method === 'PUT') return sendJson(res, 200, updateAssessment(assessmentId, await readJson(req)));
    if (method === 'DELETE') {
      deleteAssessment(assessmentId);
      res.writeHead(204);
      return res.end();
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  /* --------------------------------------------------------------- tasks */
  if (pathname === '/api/tasks' && method === 'GET') {
    return sendJson(res, 200, listTasks(params.get('from'), params.get('to')));
  }
  if (pathname === '/api/tasks' && method === 'POST') {
    return sendJson(res, 201, createTask(await readJson(req)));
  }
  const taskId = matchId(pathname, /^\/api\/tasks\/(\d+)$/);
  if (taskId !== null) {
    if (method === 'PUT') return sendJson(res, 200, updateTask(taskId, await readJson(req)));
    if (method === 'DELETE') {
      deleteTask(taskId);
      res.writeHead(204);
      return res.end();
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  /* ----------------------------------------------------------- trainings */
  if (pathname === '/api/trainings' && method === 'GET') {
    return sendJson(res, 200, listTrainings());
  }
  if (pathname === '/api/trainings' && method === 'POST') {
    return sendJson(res, 201, addTraining(await readJson(req)));
  }
  const trainingId = matchId(pathname, /^\/api\/trainings\/(\d+)$/);
  if (trainingId !== null) {
    if (method === 'GET') return sendJson(res, 200, getTraining(trainingId));
    if (method === 'PUT') return sendJson(res, 200, updateTraining(trainingId, await readJson(req)));
    if (method === 'DELETE') {
      deleteTraining(trainingId);
      res.writeHead(204);
      return res.end();
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  const trainingMilestones = matchId(pathname, /^\/api\/trainings\/(\d+)\/milestones$/);
  if (trainingMilestones !== null && method === 'POST') {
    return sendJson(res, 201, addMilestone(trainingMilestones, await readJson(req)));
  }

  const milestoneId = matchId(pathname, /^\/api\/milestones\/(\d+)$/);
  if (milestoneId !== null) {
    if (method === 'PUT') return sendJson(res, 200, updateMilestone(milestoneId, await readJson(req)));
    if (method === 'DELETE') {
      deleteMilestone(milestoneId);
      res.writeHead(204);
      return res.end();
    }
    throw new HttpError(405, 'Desteklenmeyen metot.');
  }

  /* ------------------------------------------------------------- aybuzem */
  if (pathname === '/api/aybuzem/status' && method === 'GET') {
    return sendJson(res, 200, getAybuzemStatus());
  }
  if (pathname === '/api/aybuzem/config' && method === 'POST') {
    return sendJson(res, 200, saveAybuzemConfig(await readJson(req)));
  }
  if (pathname === '/api/aybuzem/sync' && method === 'POST') {
    return sendJson(res, 200, await syncAybuzem());
  }

  /* -------------------------------------------------------------- import */
  if (pathname === '/api/import' && method === 'POST') {
    const payload = await readJson(req);
    return sendJson(res, 200, importCsv(payload.kind || 'logs', payload.text || ''));
  }

  /* -------------------------------------------------------------- export */
  if (pathname === '/api/export.csv' && method === 'GET') {
    const kind = params.get('kind') || 'logs';
    const csv = exportCsv(kind);
    const names = { logs: 'gunluk-kayitlar', assessments: 'degerlendirmeler', tasks: 'gorevler' };
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kursu-${names[kind] ?? 'veri'}-${todayISO()}.csv"`,
      'Content-Length': Buffer.byteLength(csv),
      'Cache-Control': 'no-store',
    });
    return res.end(csv);
  }

  throw new HttpError(404, 'API yolu bulunamadı.');
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(req, res, url.pathname);
    } else {
      throw new HttpError(405, 'Desteklenmeyen metot.');
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: err.message || 'Sunucu hatası.' });
    else res.end();
  } finally {
    if (!url.pathname.startsWith('/api/')) {
      console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
    }
  }
});

const stopAybuzemScheduler = startAybuzemScheduler();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} zaten kullanımda. Başka bir port için: PORT=5175 npm start\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Kürsü paneli çalışıyor');
  console.log(`  → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  Veritabanı: ${DB_PATH}`);
  console.log('');
});

function shutdown() {
  stopAybuzemScheduler();
  server.close(() => {
    try {
      db.close();
    } catch {
      /* zaten kapalı */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
