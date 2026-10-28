import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'data', 'kursu.db');

mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    student_name TEXT NOT NULL DEFAULT 'Ali Haydar Sucu',
    daily_minutes INTEGER NOT NULL DEFAULT 180,
    weekly_minutes INTEGER NOT NULL DEFAULT 1080,
    gno_target REAL NOT NULL DEFAULT 3.51,
    previous_gno REAL NOT NULL DEFAULT 3.12,
    previous_ects INTEGER NOT NULL DEFAULT 129,
    target_ects INTEGER NOT NULL DEFAULT 240,
    grade_scale_json TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    instructor TEXT NOT NULL DEFAULT '',
    ects INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'zorunlu',
    target_grade TEXT,
    final_grade TEXT,
    final_score REAL,
    status TEXT NOT NULL DEFAULT 'aktif',
    color TEXT NOT NULL DEFAULT '#f0b45a',
    is_repeat INTEGER NOT NULL DEFAULT 0,
    replaces_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    grading_type TEXT NOT NULL DEFAULT 'letter',
    external_id TEXT,
    note TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (term_id, code)
  );

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    week INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planlandi',
    weight REAL NOT NULL DEFAULT 1,
    resource TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS days (
    date TEXT PRIMARY KEY,
    mood INTEGER,
    energy INTEGER,
    note TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trainings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'egitim',
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'devam',
    total_hours REAL NOT NULL DEFAULT 0,
    completed_hours REAL NOT NULL DEFAULT 0,
    certificate_url TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL REFERENCES days(date) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    milestone_id INTEGER,
    minutes INTEGER NOT NULL DEFAULT 0,
    activity TEXT NOT NULL DEFAULT 'calisma',
    note TEXT NOT NULL DEFAULT '',
    CHECK ((course_id IS NULL) <> (training_id IS NULL))
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'vize',
    title TEXT NOT NULL,
    date TEXT,
    weight REAL NOT NULL DEFAULT 0,
    score REAL,
    max_score REAL,
    status TEXT NOT NULL DEFAULT 'planlandi',
    note TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'katildi',
    note TEXT NOT NULL DEFAULT '',
    UNIQUE (course_id, date)
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date TEXT,
    planned_hours REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'bekliyor',
    note TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'teslim',
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'acik',
    note TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL DEFAULT '',
    last_sync_at TEXT,
    status TEXT NOT NULL DEFAULT 'bekliyor',
    message TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS sync_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sync_sources(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (source_id, external_id)
  );

  CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);
  CREATE INDEX IF NOT EXISTS idx_logs_course ON logs(course_id);
  CREATE INDEX IF NOT EXISTS idx_topics_course ON topics(course_id);
  CREATE INDEX IF NOT EXISTS idx_assessments_course ON assessments(course_id);
  CREATE INDEX IF NOT EXISTS idx_assessments_date ON assessments(date);
  CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_milestones_training ON milestones(training_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_external ON tasks(source, external_id);
`);

/* --------------------------------------------------------------- helpers */

export const GRADE_SCALE = [
  { grade: 'AA', point: 4.0, min: 90 },
  { grade: 'BA', point: 3.5, min: 80 },
  { grade: 'BB', point: 3.0, min: 70 },
  { grade: 'CB', point: 2.5, min: 65 },
  { grade: 'CC', point: 2.0, min: 60 },
  { grade: 'DC', point: 1.5, min: 55 },
  { grade: 'DD', point: 1.0, min: 50 },
  { grade: 'FD', point: 0.5, min: 40 },
  { grade: 'FF', point: 0.0, min: 0 },
];

const LETTER_GRADES = new Set(GRADE_SCALE.map((g) => g.grade));

export const ACTIVITIES = ['ders', 'calisma', 'odev', 'proje', 'lab', 'tekrar', 'egitim', 'basvuru', 'toplanti', 'okuma'];
export const TASK_KINDS = ['teslim', 'basvuru', 'sinav', 'idari', 'proje', 'okuma'];
export const TOPIC_STATUSES = ['planlandi', 'devam', 'bitti', 'tekrar'];
export const TRAINING_STATUSES = ['planlandi', 'devam', 'bitti', 'iptal'];
export const MILESTONE_STATUSES = ['bekliyor', 'devam', 'bitti'];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

export function startOfWeek(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return todayISO(d);
}

export function isValidDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return todayISO(parseISO(iso)) === iso;
}

export function isValidDateTime(value) {
  if (value === null || value === undefined || value === '') return true;
  const s = String(value);
  if (isValidDate(s)) return true;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) && isValidDate(s.slice(0, 10));
}

function int(value, fallback = 0, min = 0, max = 1_000_000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function num(value, fallback = 0, min = 0, max = 1_000_000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function nullableNum(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function nullableInt(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function text(value, maxLength = 2000) {
  return String(value ?? '').slice(0, maxLength).trim();
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function gradePoint(grade) {
  return GRADE_SCALE.find((g) => g.grade === grade)?.point ?? null;
}

function gradeFromScore(score) {
  if (score === null || score === undefined || !Number.isFinite(Number(score))) return null;
  return GRADE_SCALE.find((g) => Number(score) >= g.min)?.grade ?? 'FF';
}

/* ---------------------------------------------------------------- seed */

const TERM = { name: '2026-2027 GÜZ', start: '2026-09-21', end: '2027-01-15' };

const COURSES = [
  {
    code: 'CENG300', name: 'INDUSTRIAL PRACTICE I', instructor: '', ects: 4,
    category: 'staj', target: null, color: '#a78bfa', grading: 'pass_fail', repeat: 0,
  },
  {
    code: 'CENG301', name: 'DATABASE MANAGEMENT SYSTEMS', instructor: '', ects: 5,
    category: 'zorunlu', target: 'AA', color: '#f0b45a', grading: 'letter', repeat: 0,
  },
  {
    code: 'CENG303', name: 'DESIGN AND ANALYSIS OF ALGORITHMS', instructor: '', ects: 6,
    category: 'zorunlu', target: 'BA', color: '#5aa9f0', grading: 'letter', repeat: 0,
  },
  {
    code: 'CENG305', name: 'OPERATING SYSTEMS', instructor: 'Dr. Gülay Yalçın Alkan', ects: 6,
    category: 'zorunlu', target: 'BA', color: '#63d2a1', grading: 'letter', repeat: 0,
  },
  {
    code: 'CENG327', name: 'INTRODUCTION TO SCIENTIFIC COMPUTING', instructor: 'Doç. Dr. Fahreddin Şükrü Torun', ects: 5,
    category: 'zorunlu', target: 'BA', color: '#f27d7d', grading: 'letter', repeat: 0,
  },
  {
    code: 'CENG441', name: 'DIGITAL IMAGE PROCESSING', instructor: '', ects: 5,
    category: 'secmeli', target: 'BA', color: '#c084fc', grading: 'letter', repeat: 0,
  },
  {
    code: 'EE424', name: 'DIGITAL SYSTEM DESIGN WITH VERILOG', instructor: 'Prof. Dr. Enver Çavuş', ects: 5,
    category: 'secmeli', target: 'AA', color: '#38bdf8', grading: 'letter', repeat: 0,
  },
  {
    code: 'ENGR251', name: 'ENGINEERING ETHICS', instructor: '', ects: 3,
    category: 'secmeli', target: 'AA', color: '#a3e635', grading: 'letter', repeat: 0,
  },
  {
    code: 'MATH101', name: 'CALCULUS I', instructor: '', ects: 6,
    category: 'zorunlu', target: 'AA', color: '#fb923c', grading: 'letter', repeat: 1,
    note: 'Tekrar dersi: DD → AA hedefi. GNO hesabında son deneme esas alınır.',
  },
];

const TOPICS = {
  CENG301: [
    [1, 'DBMS’e giriş, VM ve ortam kurulumu'],
    [2, 'PostgreSQL kurulumu ve mimari'],
    [3, 'Relational model ve relational algebra'],
    [4, 'SQL DDL: tipler, kısıtlar, şema değişiklikleri'],
    [5, 'Temel sorgular, NULL ve aggregation'],
    [6, 'Joins, subqueries ve CTE'],
    [7, 'Transactions, isolation ve MVCC'],
    [8, 'Midterm'],
    [9, 'ER modelleme'],
    [10, 'Normalizasyon: 3NF/BCNF'],
    [11, 'İleri SQL, window functions, index ve performans'],
    [12, 'Backup, restore ve PITR'],
    [13, 'Yüksek erişilebilirlik: streaming replication, Patroni'],
    [14, 'AI destekli SQL ve kapanış'],
  ],
  CENG303: [
    [1, 'Algorithm Analysis and Recursion'],
    [2, 'Sorting Algorithms'],
    [3, 'Divide-and-Conquer'],
    [4, 'Hashing Techniques'],
    [5, 'Binary Search Trees'],
    [6, 'Graph Algorithms I'],
    [7, 'Graph Algorithms II'],
    [8, 'Greedy Algorithms'],
    [9, 'Dynamic Programming I'],
    [10, 'Dynamic Programming II'],
    [11, 'P, NP and NP-Completeness'],
    [12, 'Approximation Algorithms'],
    [13, 'Network Flow Algorithms'],
    [14, 'Amortized and Randomized Algorithms'],
  ],
  CENG305: [
    [1, 'Introduction / Overview'],
    [2, 'Processes, IPC and Socket'],
    [3, 'Processes, IPC and Socket'],
    [4, 'Threads'],
    [5, 'CPU Scheduling'],
    [6, 'Synchronization'],
    [7, 'Midterm-I'],
    [8, 'Deadlocks'],
    [9, 'Memory Management'],
    [10, 'Memory Management'],
    [11, 'File System'],
    [12, 'Secondary Storage'],
    [13, 'Input / Output'],
    [14, 'Protection and Security'],
  ],
  CENG327: [
    [1, 'Overview and Introduction'],
    [2, 'Vectors, Matrices and Multidimensional Arrays'],
    [3, 'Symbolic Computing'],
    [4, 'Data Processing and Analysis'],
    [5, 'Equation Solving'],
    [6, 'High-level Scientific Computing'],
    [7, 'Sparse Matrices and Graphs'],
    [8, 'Optimization: Finding Minima'],
    [9, 'Interpolation'],
    [10, 'Integration'],
    [11, 'Statistics in Python'],
    [12, 'Signal Processing'],
    [13, 'Fourier Transform and FFT'],
    [14, 'Linear and Integer Programming'],
  ],
  EE424: [
    [1, 'HDL + FPGA: starter design'],
    [2, 'Modules + testbench'],
    [3, 'Synthesis + latches'],
    [4, 'Registers + reset'],
    [5, 'FSM + debounce'],
    [6, 'Shifters + LFSR'],
    [7, 'Timing + pipelines'],
    [8, 'BRAM + FIFO'],
    [9, 'Midterm'],
    [10, 'Number formats'],
    [11, 'Fixed-point arithmetic'],
    [12, 'GCD architecture'],
    [13, 'Project work'],
    [14, 'Project presentations'],
  ],
  MATH101: [
    [1, 'Preliminaries'],
    [2, 'Limits and Continuity'],
    [3, 'Differentiation'],
    [4, 'Differentiation Rules and Chain Rule'],
    [5, 'Higher-Order Derivatives, Mean-Value Theorem'],
    [6, 'Transcendental Functions'],
    [7, 'Inverse Trigonometric and Hyperbolic Functions'],
    [8, 'Applications of Differentiation'],
    [9, 'Curve Sketching and Extreme-Value Problems'],
    [10, 'Integration: Sums, Areas, Definite Integral'],
    [11, 'Fundamental Theorem and Substitution'],
    [12, 'Techniques of Integration: By Parts'],
    [13, 'Rational Functions and Inverse Substitutions'],
    [14, 'Improper Integrals'],
  ],
};

const ASSESSMENTS = {
  CENG301: [
    ['vize', 'Midterm', '2026-11-12', 40],
    ['final', 'Final', '2027-01-14', 60],
  ],
  CENG303: [
    ['odev', 'Homework 1', '2026-10-18', 5],
    ['pratik', 'Midterm Practice Exam', '2026-11-04', 15],
    ['vize', 'Midterm Exam', '2026-11-11', 30],
    ['odev', 'Homework 2', '2026-12-06', 5],
    ['pratik', 'Final Practice Exam', '2027-01-06', 15],
    ['final', 'Final Exam', '2027-01-13', 30],
  ],
  CENG305: [
    ['quiz', 'Quiz ortalaması (6 + 1 bonus)', '2026-12-21', 25],
    ['odev', 'Homework ortalaması (3)', '2026-12-14', 15],
    ['vize', 'Midterm-I', '2026-11-02', 30],
    ['final', 'Final', '2027-01-11', 35],
  ],
  CENG327: [
    ['odev', 'Homework', '2026-12-11', 5],
    ['quiz', 'Quiz', '2026-12-04', 10],
    ['proje', 'Grup Projesi', '2027-01-08', 15],
    ['vize', 'Midterm', '2026-11-18', 35],
    ['final', 'Final', '2027-01-13', 35],
  ],
  EE424: [
    ['odev', 'Homework + Quizzes', '2026-12-18', 10],
    ['proje', 'Term Project', '2027-01-08', 30],
    ['vize', 'Midterm', '2026-11-18', 30],
    ['final', 'Final', '2027-01-15', 30],
  ],
  MATH101: [
    ['vize', 'Midterm', '2026-11-14', 40],
    ['final', 'Final', '2027-01-09', 60],
  ],
  CENG441: [
    ['vize', 'Midterm (syllabus bekleniyor)', '2026-11-20', 40],
    ['final', 'Final (syllabus bekleniyor)', '2027-01-12', 60],
  ],
  ENGR251: [
    ['vize', 'Midterm (syllabus bekleniyor)', '2026-11-20', 40],
    ['final', 'Final (syllabus bekleniyor)', '2027-01-12', 60],
  ],
};

const TRAININGS = [
  {
    name: 'Anadolu Logic FPGA Akademisi',
    provider: 'Anadolu Logic',
    category: 'egitim',
    start: '2026-09-01',
    end: '2027-06-30',
    status: 'devam',
    total_hours: 40,
    note: 'FPGA akışı ve Verilog pratiği; EE424 ile paralel yürüyor.',
  },
  {
    name: 'T3 Gemstone Anadolu',
    provider: 'T3 Vakfı',
    category: 'program',
    start: '2026-09-01',
    end: '2027-06-30',
    status: 'devam',
    total_hours: 0,
    note: 'Mehmet Akif Erdem’in grubu; edge AI ve gömülü çalışmalar.',
  },
  {
    name: 'TÜBİTAK 2026-2 Aday Araştırmacı Başvurusu',
    provider: 'TÜBİTAK',
    category: 'basvuru',
    start: '2026-10-01',
    end: '2026-11-04',
    status: 'devam',
    total_hours: 0,
    note: 'Son tarih 04.11.2026 17:00. Hedef ilanlar: SAGE.13 ve BİLGEM.02.',
  },
];

const MILESTONES = {
  'Anadolu Logic FPGA Akademisi': [
    ['Temel mantık ve kombinasyonel devreler', '2026-09-30', 8, 'bitti'],
    ['Sıralı devreler ve FSM', '2026-10-31', 8, 'devam'],
    ['FPGA akışı: sentez, yerleştirme, bitstream', '2026-12-15', 10, 'bekliyor'],
    ['ILA / VIO ile kart üzerinde doğrulama', '2027-02-28', 8, 'bekliyor'],
    ['Kapanış projesi', '2027-06-15', 6, 'bekliyor'],
  ],
  'T3 Gemstone Anadolu': [
    ['GPIO pin haritası ve donanım doğrulama', '2026-10-15', 0, 'bitti'],
    ['Edge AI LLM benchmark test matrisi', '2026-12-20', 0, 'devam'],
    ['Teknik rapor ve GitHub çıktısı', '2027-01-31', 0, 'bekliyor'],
  ],
  'TÜBİTAK 2026-2 Aday Araştırmacı Başvurusu': [
    ['SAGE.13 ilanına göre özgeçmiş', '2026-10-30', 0, 'devam'],
    ['Niyet mektubu / araştırma planı', '2026-11-01', 0, 'bekliyor'],
    ['Referans ve ek belgeler', '2026-11-02', 0, 'bekliyor'],
    ['Başvuru formu', '2026-11-03', 0, 'bekliyor'],
    ['Son kontrol ve gönderim', '2026-11-04T17:00', 0, 'bekliyor'],
  ],
};

const TASKS = [
  ['TÜBİTAK başvurusunu tamamla', 'basvuru', '2026-11-04T17:00', 'yuksek', 'acik', 'TÜBİTAK 2026-2 Aday Araştırmacı Başvurusu'],
  ['MATH101 tekrar planını netleştir', 'idari', '2026-11-01', 'normal', 'acik', null],
  ['EE424 proje kapsamı ve kabul kriterleri', 'proje', '2026-10-09', 'normal', 'bitti', null],
];

function seed() {
  const termCount = db.prepare('SELECT COUNT(*) AS n FROM terms').get().n;
  if (termCount === 0) {
    db.prepare('INSERT INTO terms (name, start_date, end_date, is_active) VALUES (?, ?, ?, 1)')
      .run(TERM.name, TERM.start, TERM.end);
  }

  db.prepare('INSERT OR IGNORE INTO settings (id) VALUES (1)').run();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  if (!settings.grade_scale_json) {
    db.prepare('UPDATE settings SET grade_scale_json = ? WHERE id = 1').run(JSON.stringify(GRADE_SCALE));
  }

  const term = db.prepare('SELECT * FROM terms WHERE is_active = 1 ORDER BY id LIMIT 1').get();
  const courseCount = db.prepare('SELECT COUNT(*) AS n FROM courses').get().n;
  if (courseCount === 0) {
    const insertCourse = db.prepare(`
      INSERT INTO courses (term_id, code, name, instructor, ects, category, target_grade,
                           color, is_repeat, grading_type, note, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    COURSES.forEach((c, i) => {
      insertCourse.run(
        term.id, c.code, c.name, c.instructor, c.ects, c.category, c.target,
        c.color, c.repeat ?? 0, c.grading, c.note ?? '', i * 10,
      );
    });
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM topics').get().n === 0) {
    const insertTopic = db.prepare(`
      INSERT INTO topics (course_id, week, title, status, sort_order)
      VALUES (?, ?, ?, 'planlandi', ?)
    `);
    for (const [code, list] of Object.entries(TOPICS)) {
      const course = db.prepare('SELECT id FROM courses WHERE code = ?').get(code);
      if (!course) continue;
      list.forEach(([week, title], i) => insertTopic.run(course.id, week, title, i));
    }
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM assessments').get().n === 0) {
    const insertAssessment = db.prepare(`
      INSERT INTO assessments (course_id, type, title, date, weight, status, sort_order)
      VALUES (?, ?, ?, ?, ?, 'planlandi', ?)
    `);
    for (const [code, list] of Object.entries(ASSESSMENTS)) {
      const course = db.prepare('SELECT id FROM courses WHERE code = ?').get(code);
      if (!course) continue;
      list.forEach(([type, title, date, weight], i) => {
        insertAssessment.run(course.id, type, title, date, weight, i);
      });
    }
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM trainings').get().n === 0) {
    const insertTraining = db.prepare(`
      INSERT INTO trainings (name, provider, category, start_date, end_date, status, total_hours, note, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    TRAININGS.forEach((t, i) => {
      insertTraining.run(t.name, t.provider, t.category, t.start, t.end, t.status, t.total_hours, t.note, i * 10);
    });
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM milestones').get().n === 0) {
    const insertMilestone = db.prepare(`
      INSERT INTO milestones (training_id, title, due_date, planned_hours, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const [name, list] of Object.entries(MILESTONES)) {
      const training = db.prepare('SELECT id FROM trainings WHERE name = ?').get(name);
      if (!training) continue;
      list.forEach(([title, due, hours, status], i) => {
        insertMilestone.run(training.id, title, due, hours, status, i);
      });
    }
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n === 0) {
    const insertTask = db.prepare(`
      INSERT INTO tasks (title, kind, due_date, priority, status, training_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const [title, kind, due, priority, status, trainingName] of TASKS) {
      const training = trainingName
        ? db.prepare('SELECT id FROM trainings WHERE name = ?').get(trainingName)
        : null;
      insertTask.run(title, kind, due, priority, status, training?.id ?? null);
    }
  }

  db.prepare('INSERT OR IGNORE INTO sync_sources (name, base_url, status) VALUES (?, ?, ?)')
    .run('AYBÜZEM', 'https://aybuzem.aybu.edu.tr', 'bekliyor');
}

seed();

/* ------------------------------------------------------------- settings */

export function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

export function updateSettings(patch) {
  const current = getSettings();
  const next = {
    student_name: text(patch.student_name ?? current.student_name, 60) || 'Ali Haydar Sucu',
    daily_minutes: int(patch.daily_minutes ?? current.daily_minutes, 180, 0, 1440),
    weekly_minutes: int(patch.weekly_minutes ?? current.weekly_minutes, 1080, 0, 10080),
    gno_target: num(patch.gno_target ?? current.gno_target, 3.51, 0, 4),
    previous_gno: num(patch.previous_gno ?? current.previous_gno, 3.12, 0, 4),
    previous_ects: int(patch.previous_ects ?? current.previous_ects, 129, 0, 400),
    target_ects: int(patch.target_ects ?? current.target_ects, 240, 1, 400),
  };
  db.prepare(`
    UPDATE settings
       SET student_name = ?, daily_minutes = ?, weekly_minutes = ?,
           gno_target = ?, previous_gno = ?, previous_ects = ?, target_ects = ?
     WHERE id = 1
  `).run(
    next.student_name, next.daily_minutes, next.weekly_minutes,
    next.gno_target, next.previous_gno, next.previous_ects, next.target_ects,
  );
  return getSettings();
}

export function getTerm() {
  return db.prepare('SELECT * FROM terms WHERE is_active = 1 ORDER BY id LIMIT 1').get()
    ?? db.prepare('SELECT * FROM terms ORDER BY id DESC LIMIT 1').get();
}

export function listTerms() {
  return db.prepare('SELECT * FROM terms ORDER BY start_date DESC').all();
}

/* -------------------------------------------------------------- courses */

function assessmentStats(courseId) {
  const rows = db.prepare('SELECT * FROM assessments WHERE course_id = ? ORDER BY sort_order, date, id').all(courseId);
  const scored = rows.filter((r) => r.score !== null && r.max_score !== null && r.max_score > 0);
  const weightScored = scored.reduce((sum, r) => sum + r.weight, 0);
  const weightTotal = rows.reduce((sum, r) => sum + r.weight, 0);
  const earned = scored.reduce((sum, r) => sum + r.weight * (r.score / r.max_score), 0);
  const percent = weightScored > 0 ? round1((earned / weightScored) * 100) : null;
  const allScored = rows.length > 0 && rows.every((r) => r.score !== null && r.max_score !== null && r.max_score > 0);
  const finalScore = allScored ? round1(earned) : null;
  return {
    rows,
    weightTotal: round1(weightTotal),
    weightScored: round1(weightScored),
    earned: round2(earned),
    percent,
    finalScore,
    allScored,
  };
}

function courseRow(course, weekStart, weekEnd, today) {
  const stats = assessmentStats(course.id);
  const projectedScore = course.final_score ?? stats.finalScore ?? stats.percent;
  const projectedGrade = course.final_grade
    ?? (projectedScore !== null ? gradeFromScore(projectedScore) : null);
  const topicTotal = db.prepare('SELECT COUNT(*) AS n FROM topics WHERE course_id = ?').get(course.id).n;
  const topicDone = db.prepare("SELECT COUNT(*) AS n FROM topics WHERE course_id = ? AND status = 'bitti'").get(course.id).n;
  const weekMinutes = db.prepare(`
    SELECT COALESCE(SUM(minutes), 0) AS n FROM logs
     WHERE course_id = ? AND date BETWEEN ? AND ?
  `).get(course.id, weekStart, weekEnd).n;
  const totalMinutes = db.prepare('SELECT COALESCE(SUM(minutes), 0) AS n FROM logs WHERE course_id = ?').get(course.id).n;
  const lastLog = db.prepare('SELECT MAX(date) AS d FROM logs WHERE course_id = ?').get(course.id).d;
  const next = db.prepare(`
    SELECT id, title, date, type FROM assessments
     WHERE course_id = ? AND date IS NOT NULL AND date >= ?
     ORDER BY date, id LIMIT 1
  `).get(course.id, today);
  const daysSince = lastLog ? Math.max(0, Math.round((parseISO(today) - parseISO(lastLog)) / 86400000)) : null;
  return {
    ...course,
    week_minutes: weekMinutes,
    total_minutes: totalMinutes,
    last_log_date: lastLog,
    days_since_log: daysSince,
    topic_total: topicTotal,
    topic_done: topicDone,
    topic_progress: topicTotal ? Math.round((topicDone / topicTotal) * 100) : 0,
    next_assessment: next ?? null,
    assessment: {
      weight_total: stats.weightTotal,
      weight_scored: stats.weightScored,
      percent: stats.percent,
      final_score: stats.finalScore,
      all_scored: stats.allScored,
    },
    projected_score: projectedScore,
    projected_grade: projectedGrade,
    grade_point: projectedGrade ? gradePoint(projectedGrade) : null,
    risk: course.grading_type === 'letter' && (!lastLog || daysSince >= 5),
  };
}

export function listCourses() {
  const term = getTerm();
  if (!term) return [];
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  return db.prepare('SELECT * FROM courses WHERE term_id = ? ORDER BY sort_order, code').all(term.id)
    .map((c) => courseRow(c, weekStart, weekEnd, today));
}

export function getCourse(id) {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(Number(id));
  if (!course) throw new HttpError(404, 'Ders bulunamadı.');
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const row = courseRow(course, weekStart, weekEnd, today);
  row.topics = listTopics(course.id);
  row.assessments = listAssessments(course.id);
  row.recent_logs = db.prepare(`
    SELECT l.*, t.title AS topic_title
      FROM logs l LEFT JOIN topics t ON t.id = l.topic_id
     WHERE l.course_id = ? ORDER BY l.date DESC, l.id DESC LIMIT 30
  `).all(course.id);
  return row;
}

export function addCourse(payload) {
  const term = getTerm();
  if (!term) throw new HttpError(400, 'Önce bir dönem oluştur.');
  const code = text(payload.code, 20).toUpperCase();
  const name = text(payload.name, 120);
  if (!code || !name) throw new HttpError(400, 'Ders kodu ve adı zorunlu.');
  const exists = db.prepare('SELECT id FROM courses WHERE term_id = ? AND lower(code) = lower(?)').get(term.id, code);
  if (exists) throw new HttpError(409, 'Bu ders kodu zaten kayıtlı.');
  const info = db.prepare(`
    INSERT INTO courses (term_id, code, name, instructor, ects, category, target_grade,
                         color, is_repeat, grading_type, note, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    term.id, code, name, text(payload.instructor, 80),
    int(payload.ects, 0, 0, 30),
    oneOf(payload.category, ['zorunlu', 'secmeli', 'staj', 'diger'], 'zorunlu'),
    LETTER_GRADES.has(payload.target_grade) ? payload.target_grade : null,
    text(payload.color, 20) || '#f0b45a',
    payload.is_repeat ? 1 : 0,
    oneOf(payload.grading_type, ['letter', 'pass_fail'], 'letter'),
    text(payload.note, 1000),
    (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM courses').get().n || 0) + 10,
  );
  return getCourse(Number(info.lastInsertRowid));
}

export function updateCourse(id, payload) {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(Number(id));
  if (!course) throw new HttpError(404, 'Ders bulunamadı.');
  const next = {
    name: text(payload.name ?? course.name, 120) || course.name,
    instructor: text(payload.instructor ?? course.instructor, 80),
    ects: int(payload.ects ?? course.ects, course.ects, 0, 30),
    category: oneOf(payload.category ?? course.category, ['zorunlu', 'secmeli', 'staj', 'diger'], course.category),
    target_grade: payload.target_grade === undefined
      ? course.target_grade
      : (LETTER_GRADES.has(payload.target_grade) ? payload.target_grade : null),
    final_grade: payload.final_grade === undefined
      ? course.final_grade
      : (LETTER_GRADES.has(payload.final_grade) ? payload.final_grade : null),
    final_score: payload.final_score === undefined ? course.final_score : nullableNum(payload.final_score, 0, 200),
    status: oneOf(payload.status ?? course.status, ['aktif', 'birakildi', 'tamamlandi'], course.status),
    color: text(payload.color ?? course.color, 20) || course.color,
    grading_type: oneOf(payload.grading_type ?? course.grading_type, ['letter', 'pass_fail'], course.grading_type),
    note: text(payload.note ?? course.note, 1000),
  };
  db.prepare(`
    UPDATE courses SET name = ?, instructor = ?, ects = ?, category = ?, target_grade = ?,
                       final_grade = ?, final_score = ?, status = ?, color = ?,
                       grading_type = ?, note = ?
     WHERE id = ?
  `).run(
    next.name, next.instructor, next.ects, next.category, next.target_grade,
    next.final_grade, next.final_score, next.status, next.color,
    next.grading_type, next.note, course.id,
  );
  return getCourse(course.id);
}

export function deleteCourse(id) {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(Number(id));
  if (!course) throw new HttpError(404, 'Ders bulunamadı.');
  const logs = db.prepare('SELECT COUNT(*) AS n FROM logs WHERE course_id = ?').get(course.id).n;
  if (logs > 0) throw new HttpError(409, 'Bu derse ait kayıtlar var, silinemez. Dersi “bırakıldı” olarak işaretleyebilirsin.');
  db.prepare('DELETE FROM courses WHERE id = ?').run(course.id);
}

/* --------------------------------------------------------------- topics */

export function listTopics(courseId) {
  return db.prepare('SELECT * FROM topics WHERE course_id = ? ORDER BY sort_order, week, id').all(Number(courseId));
}

export function addTopic(courseId, payload) {
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(Number(courseId));
  if (!course) throw new HttpError(404, 'Ders bulunamadı.');
  const title = text(payload.title, 200);
  if (!title) throw new HttpError(400, 'Konu adı boş olamaz.');
  const order = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM topics WHERE course_id = ?').get(course.id).n || 0) + 10;
  const info = db.prepare(`
    INSERT INTO topics (course_id, week, title, status, weight, resource, note, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    course.id, int(payload.week, 0, 0, 60), title,
    oneOf(payload.status, TOPIC_STATUSES, 'planlandi'),
    num(payload.weight, 1, 0, 100), text(payload.resource, 300), text(payload.note, 500), order,
  );
  return db.prepare('SELECT * FROM topics WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function updateTopic(id, payload) {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(Number(id));
  if (!topic) throw new HttpError(404, 'Konu bulunamadı.');
  db.prepare(`
    UPDATE topics SET week = ?, title = ?, status = ?, weight = ?, resource = ?, note = ?
     WHERE id = ?
  `).run(
    int(payload.week ?? topic.week, topic.week, 0, 60),
    text(payload.title ?? topic.title, 200) || topic.title,
    oneOf(payload.status ?? topic.status, TOPIC_STATUSES, topic.status),
    num(payload.weight ?? topic.weight, topic.weight, 0, 100),
    text(payload.resource ?? topic.resource, 300),
    text(payload.note ?? topic.note, 500),
    topic.id,
  );
  return db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id);
}

export function deleteTopic(id) {
  const info = db.prepare('DELETE FROM topics WHERE id = ?').run(Number(id));
  if (info.changes === 0) throw new HttpError(404, 'Konu bulunamadı.');
}

/* ---------------------------------------------------------- assessments */

export function listAssessments(courseId = null) {
  const rows = courseId
    ? db.prepare(`
        SELECT a.*, c.code AS course_code, c.name AS course_name
          FROM assessments a JOIN courses c ON c.id = a.course_id
         WHERE a.course_id = ? ORDER BY a.sort_order, a.date, a.id
      `).all(Number(courseId))
    : db.prepare(`
        SELECT a.*, c.code AS course_code, c.name AS course_name
          FROM assessments a JOIN courses c ON c.id = a.course_id
         ORDER BY a.date IS NULL, a.date, a.id
      `).all();
  return rows.map((r) => ({
    ...r,
    contribution: r.score !== null && r.max_score ? round2(r.weight * (r.score / r.max_score)) : null,
    percent: r.score !== null && r.max_score ? round1((r.score / r.max_score) * 100) : null,
  }));
}

export function createAssessment(payload) {
  const courseId = Number(payload.course_id);
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) throw new HttpError(404, 'Ders bulunamadı.');
  const title = text(payload.title, 120);
  if (!title) throw new HttpError(400, 'Değerlendirme adı boş olamaz.');
  if (payload.date && !isValidDate(payload.date)) throw new HttpError(400, 'Geçersiz tarih.');
  const order = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM assessments WHERE course_id = ?').get(courseId).n || 0) + 10;
  const info = db.prepare(`
    INSERT INTO assessments (course_id, type, title, date, weight, score, max_score, status, note, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    courseId, text(payload.type, 30) || 'vize', title,
    payload.date || null, num(payload.weight, 0, 0, 200),
    nullableNum(payload.score, 0, 1000), nullableNum(payload.max_score, 0, 1000),
    oneOf(payload.status, ['planlandi', 'girildi', 'aciklandi'], 'planlandi'),
    text(payload.note, 500), order,
  );
  return db.prepare('SELECT * FROM assessments WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function updateAssessment(id, payload) {
  const row = db.prepare('SELECT * FROM assessments WHERE id = ?').get(Number(id));
  if (!row) throw new HttpError(404, 'Değerlendirme bulunamadı.');
  if (payload.date && !isValidDate(payload.date)) throw new HttpError(400, 'Geçersiz tarih.');
  db.prepare(`
    UPDATE assessments SET type = ?, title = ?, date = ?, weight = ?, score = ?,
                           max_score = ?, status = ?, note = ?
     WHERE id = ?
  `).run(
    text(payload.type ?? row.type, 30) || row.type,
    text(payload.title ?? row.title, 120) || row.title,
    payload.date === undefined ? row.date : (payload.date || null),
    num(payload.weight ?? row.weight, row.weight, 0, 200),
    payload.score === undefined ? row.score : nullableNum(payload.score, 0, 1000),
    payload.max_score === undefined ? row.max_score : nullableNum(payload.max_score, 0, 1000),
    oneOf(payload.status ?? row.status, ['planlandi', 'girildi', 'aciklandi'], row.status),
    text(payload.note ?? row.note, 500),
    row.id,
  );
  return db.prepare('SELECT * FROM assessments WHERE id = ?').get(row.id);
}

export function deleteAssessment(id) {
  const info = db.prepare('DELETE FROM assessments WHERE id = ?').run(Number(id));
  if (info.changes === 0) throw new HttpError(404, 'Değerlendirme bulunamadı.');
}

/* ----------------------------------------------------------------- days */

export function getDay(date) {
  if (!isValidDate(date)) throw new HttpError(400, 'Geçersiz tarih.');
  const day = db.prepare('SELECT * FROM days WHERE date = ?').get(date);
  const logs = db.prepare(`
    SELECT l.*, c.code AS course_code, c.name AS course_name, c.color AS course_color,
           t.name AS training_name, t.category AS training_category,
           tp.title AS topic_title, m.title AS milestone_title
      FROM logs l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN trainings t ON t.id = l.training_id
      LEFT JOIN topics tp ON tp.id = l.topic_id
      LEFT JOIN milestones m ON m.id = l.milestone_id
     WHERE l.date = ?
     ORDER BY l.id
  `).all(date);
  return {
    date,
    mood: day?.mood ?? null,
    energy: day?.energy ?? null,
    note: day?.note ?? '',
    logs,
    exists: Boolean(day),
  };
}

export function saveDay(date, payload) {
  if (!isValidDate(date)) throw new HttpError(400, 'Geçersiz tarih.');
  const mood = nullableInt(payload.mood, 1, 5);
  const energy = nullableInt(payload.energy, 1, 5);
  const note = text(payload.note, 2000);

  const courses = new Map(db.prepare('SELECT id FROM courses').all().map((r) => [r.id, r]));
  const trainings = new Map(db.prepare('SELECT id FROM trainings').all().map((r) => [r.id, r]));
  const topics = new Map(db.prepare('SELECT id, course_id FROM topics').all().map((r) => [r.id, r]));
  const milestones = new Map(db.prepare('SELECT id, training_id FROM milestones').all().map((r) => [r.id, r]));

  const rows = [];
  for (const raw of Array.isArray(payload.logs) ? payload.logs.slice(0, 100) : []) {
    const courseId = raw?.course_id ? Number(raw.course_id) : null;
    const trainingId = raw?.training_id ? Number(raw.training_id) : null;
    if ((courseId === null) === (trainingId === null)) continue;
    if (courseId !== null && !courses.has(courseId)) continue;
    if (trainingId !== null && !trainings.has(trainingId)) continue;
    const topicId = raw?.topic_id ? Number(raw.topic_id) : null;
    if (topicId !== null) {
      const topic = topics.get(topicId);
      if (!topic) continue;
      if (courseId !== null && topic.course_id !== courseId) continue;
    }
    const milestoneId = raw?.milestone_id ? Number(raw.milestone_id) : null;
    if (milestoneId !== null) {
      const milestone = milestones.get(milestoneId);
      if (!milestone) continue;
      if (trainingId !== null && milestone.training_id !== trainingId) continue;
    }
    const minutes = int(raw.minutes, 0, 0, 1440);
    const logNote = text(raw.note, 500);
    if (minutes === 0 && !logNote) continue;
    rows.push([
      date, courseId, trainingId, topicId, milestoneId, minutes,
      oneOf(raw.activity, ACTIVITIES, 'calisma'), logNote,
    ]);
  }

  return transaction(() => {
    if (mood === null && energy === null && note === '' && rows.length === 0) {
      db.prepare('DELETE FROM days WHERE date = ?').run(date);
      return getDay(date);
    }

    db.prepare(`
      INSERT INTO days (date, mood, energy, note, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(date) DO UPDATE SET
        mood = excluded.mood,
        energy = excluded.energy,
        note = excluded.note,
        updated_at = excluded.updated_at
    `).run(date, mood, energy, note);

    db.prepare('DELETE FROM logs WHERE date = ?').run(date);
    const insert = db.prepare(`
      INSERT INTO logs (date, course_id, training_id, topic_id, milestone_id, minutes, activity, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of rows) insert.run(...row);
    return getDay(date);
  });
}

export function listLogs(from, to) {
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'Geçersiz tarih aralığı.');
  return db.prepare(`
    SELECT l.*, c.code AS course_code, c.name AS course_name,
           t.name AS training_name, tp.title AS topic_title, m.title AS milestone_title,
           d.mood, d.energy, d.note AS day_note
      FROM logs l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN trainings t ON t.id = l.training_id
      LEFT JOIN topics tp ON tp.id = l.topic_id
      LEFT JOIN milestones m ON m.id = l.milestone_id
      LEFT JOIN days d ON d.date = l.date
     WHERE l.date BETWEEN ? AND ?
     ORDER BY l.date DESC, l.id DESC
  `).all(from, to);
}

/* ---------------------------------------------------------------- stats */

function currentStreak(today) {
  const active = new Set(
    db.prepare(`
      SELECT date FROM days
       WHERE note <> '' OR mood IS NOT NULL OR energy IS NOT NULL
          OR EXISTS (SELECT 1 FROM logs l WHERE l.date = days.date AND l.minutes > 0)
    `).all().map((r) => r.date),
  );
  let cursor = active.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function rangeTotals(start, end) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS entries
      FROM logs WHERE date BETWEEN ? AND ?
  `).get(start, end);
  return { minutes: row.minutes, entries: row.entries };
}

export function getStats(days = 30) {
  const span = Math.min(365, Math.max(1, int(days, 30, 1, 365)));
  const today = todayISO();
  const start = addDays(today, -(span - 1));

  const byDate = new Map(
    db.prepare(`
      SELECT date, COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS entries
        FROM logs WHERE date BETWEEN ? AND ? GROUP BY date
    `).all(start, today).map((r) => [r.date, r]),
  );
  const moodByDate = new Map(
    db.prepare('SELECT date, mood, energy, note FROM days WHERE date BETWEEN ? AND ?')
      .all(start, today).map((r) => [r.date, r]),
  );

  const series = [];
  for (let i = 0; i < span; i += 1) {
    const date = addDays(start, i);
    const row = byDate.get(date);
    const mood = moodByDate.get(date);
    series.push({
      date,
      minutes: row?.minutes ?? 0,
      entries: row?.entries ?? 0,
      mood: mood?.mood ?? null,
      energy: mood?.energy ?? null,
      note: mood?.note ?? '',
    });
  }

  const totalMinutes = series.reduce((sum, d) => sum + d.minutes, 0);
  const activeDays = series.filter((d) => d.minutes > 0 || d.note || d.mood != null).length;
  const moodValues = series.map((d) => d.mood).filter((m) => m != null);

  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);

  const byCourse = db.prepare(`
    SELECT c.id, c.code, c.name, c.color, c.ects,
           COALESCE(SUM(l.minutes), 0) AS minutes,
           COUNT(DISTINCT l.date) AS days
      FROM courses c
      LEFT JOIN logs l ON l.course_id = c.id AND l.date BETWEEN ? AND ?
     GROUP BY c.id
     HAVING minutes > 0
     ORDER BY minutes DESC, c.code
  `).all(start, today);

  const byTraining = db.prepare(`
    SELECT t.id, t.name, t.category,
           COALESCE(SUM(l.minutes), 0) AS minutes,
           COUNT(DISTINCT l.date) AS days
      FROM trainings t
      LEFT JOIN logs l ON l.training_id = t.id AND l.date BETWEEN ? AND ?
     GROUP BY t.id
     HAVING minutes > 0
     ORDER BY minutes DESC, t.name
  `).all(start, today);

  return {
    today,
    range: {
      days: span,
      start,
      end: today,
      minutes: totalMinutes,
      activeDays,
      avgMinutes: Math.round(totalMinutes / span),
      perActiveDayMinutes: activeDays ? Math.round(totalMinutes / activeDays) : 0,
      moodAvg: moodValues.length ? round1(moodValues.reduce((a, b) => a + b, 0) / moodValues.length) : null,
    },
    week: { start: weekStart, end: weekEnd, ...rangeTotals(weekStart, weekEnd) },
    lastWeek: { start: prevStart, end: prevEnd, ...rangeTotals(prevStart, prevEnd) },
    streak: currentStreak(today),
    series,
    courses: byCourse,
    trainings: byTraining,
  };
}

/* ---------------------------------------------------------------- tasks */

function taskRows(where = '', params = []) {
  return db.prepare(`
    SELECT t.*, c.code AS course_code, c.name AS course_name,
           tr.name AS training_name
      FROM tasks t
      LEFT JOIN courses c ON c.id = t.course_id
      LEFT JOIN trainings tr ON tr.id = t.training_id
      ${where}
     ORDER BY t.due_date IS NULL, t.due_date, t.id
  `).all(...params);
}

export function listTasks(from = null, to = null) {
  if (from && to) {
    if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'Geçersiz tarih aralığı.');
    return taskRows('WHERE substr(t.due_date, 1, 10) BETWEEN ? AND ?', [from, to]);
  }
  return taskRows();
}

export function createTask(payload) {
  const title = text(payload.title, 160);
  if (!title) throw new HttpError(400, 'Görev adı boş olamaz.');
  if (payload.due_date && !isValidDateTime(payload.due_date)) throw new HttpError(400, 'Geçersiz tarih.');
  const courseId = payload.course_id ? Number(payload.course_id) : null;
  const trainingId = payload.training_id ? Number(payload.training_id) : null;
  if (courseId && !db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId)) {
    throw new HttpError(404, 'Ders bulunamadı.');
  }
  if (trainingId && !db.prepare('SELECT id FROM trainings WHERE id = ?').get(trainingId)) {
    throw new HttpError(404, 'Eğitim bulunamadı.');
  }
  const info = db.prepare(`
    INSERT INTO tasks (course_id, training_id, title, kind, due_date, priority, status, note, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')
  `).run(
    courseId, trainingId, title,
    oneOf(payload.kind, TASK_KINDS, 'teslim'),
    payload.due_date || null,
    oneOf(payload.priority, ['dusuk', 'normal', 'yuksek'], 'normal'),
    oneOf(payload.status, ['acik', 'bitti', 'iptal'], 'acik'),
    text(payload.note, 1000),
  );
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function updateTask(id, payload) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(id));
  if (!task) throw new HttpError(404, 'Görev bulunamadı.');
  if (payload.due_date && !isValidDateTime(payload.due_date)) throw new HttpError(400, 'Geçersiz tarih.');
  db.prepare(`
    UPDATE tasks SET title = ?, kind = ?, due_date = ?, priority = ?, status = ?, note = ?
     WHERE id = ?
  `).run(
    text(payload.title ?? task.title, 160) || task.title,
    oneOf(payload.kind ?? task.kind, TASK_KINDS, task.kind),
    payload.due_date === undefined ? task.due_date : (payload.due_date || null),
    oneOf(payload.priority ?? task.priority, ['dusuk', 'normal', 'yuksek'], task.priority),
    oneOf(payload.status ?? task.status, ['acik', 'bitti', 'iptal'], task.status),
    text(payload.note ?? task.note, 1000),
    task.id,
  );
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
}

export function deleteTask(id) {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(Number(id));
  if (info.changes === 0) throw new HttpError(404, 'Görev bulunamadı.');
}

/* ------------------------------------------------------------ trainings */

export function listTrainings() {
  return db.prepare('SELECT * FROM trainings ORDER BY sort_order, start_date, name').all().map((t) => {
    const total = db.prepare('SELECT COUNT(*) AS n FROM milestones WHERE training_id = ?').get(t.id).n;
    const done = db.prepare("SELECT COUNT(*) AS n FROM milestones WHERE training_id = ? AND status = 'bitti'").get(t.id).n;
    const minutes = db.prepare('SELECT COALESCE(SUM(minutes), 0) AS n FROM logs WHERE training_id = ?').get(t.id).n;
    const lastLog = db.prepare('SELECT MAX(date) AS d FROM logs WHERE training_id = ?').get(t.id).d;
    return {
      ...t,
      milestone_total: total,
      milestone_done: done,
      progress: total ? Math.round((done / total) * 100) : 0,
      logged_minutes: minutes,
      last_log_date: lastLog,
    };
  });
}

export function getTraining(id) {
  const training = db.prepare('SELECT * FROM trainings WHERE id = ?').get(Number(id));
  if (!training) throw new HttpError(404, 'Eğitim bulunamadı.');
  const milestones = db.prepare('SELECT * FROM milestones WHERE training_id = ? ORDER BY sort_order, due_date, id').all(training.id);
  const done = milestones.filter((m) => m.status === 'bitti').length;
  const minutes = db.prepare('SELECT COALESCE(SUM(minutes), 0) AS n FROM logs WHERE training_id = ?').get(training.id).n;
  return {
    ...training,
    milestones,
    milestone_total: milestones.length,
    milestone_done: done,
    progress: milestones.length ? Math.round((done / milestones.length) * 100) : 0,
    logged_minutes: minutes,
  };
}

export function addTraining(payload) {
  const name = text(payload.name, 160);
  if (!name) throw new HttpError(400, 'Eğitim adı boş olamaz.');
  const info = db.prepare(`
    INSERT INTO trainings (name, provider, category, start_date, end_date, status,
                           total_hours, completed_hours, certificate_url, note, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, text(payload.provider, 100),
    oneOf(payload.category, ['egitim', 'program', 'basvuru', 'kurs', 'proje'], 'egitim'),
    payload.start_date || null, payload.end_date || null,
    oneOf(payload.status, TRAINING_STATUSES, 'devam'),
    num(payload.total_hours, 0, 0, 10000), num(payload.completed_hours, 0, 0, 10000),
    text(payload.certificate_url, 500), text(payload.note, 1000),
    (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM trainings').get().n || 0) + 10,
  );
  return getTraining(Number(info.lastInsertRowid));
}

export function updateTraining(id, payload) {
  const t = db.prepare('SELECT * FROM trainings WHERE id = ?').get(Number(id));
  if (!t) throw new HttpError(404, 'Eğitim bulunamadı.');
  db.prepare(`
    UPDATE trainings SET name = ?, provider = ?, category = ?, start_date = ?, end_date = ?,
                         status = ?, total_hours = ?, completed_hours = ?, certificate_url = ?, note = ?
     WHERE id = ?
  `).run(
    text(payload.name ?? t.name, 160) || t.name,
    text(payload.provider ?? t.provider, 100),
    oneOf(payload.category ?? t.category, ['egitim', 'program', 'basvuru', 'kurs', 'proje'], t.category),
    payload.start_date === undefined ? t.start_date : (payload.start_date || null),
    payload.end_date === undefined ? t.end_date : (payload.end_date || null),
    oneOf(payload.status ?? t.status, TRAINING_STATUSES, t.status),
    num(payload.total_hours ?? t.total_hours, t.total_hours, 0, 10000),
    num(payload.completed_hours ?? t.completed_hours, t.completed_hours, 0, 10000),
    text(payload.certificate_url ?? t.certificate_url, 500),
    text(payload.note ?? t.note, 1000),
    t.id,
  );
  return getTraining(t.id);
}

export function deleteTraining(id) {
  const t = db.prepare('SELECT * FROM trainings WHERE id = ?').get(Number(id));
  if (!t) throw new HttpError(404, 'Eğitim bulunamadı.');
  const logs = db.prepare('SELECT COUNT(*) AS n FROM logs WHERE training_id = ?').get(t.id).n;
  if (logs > 0) throw new HttpError(409, 'Bu eğitime ait kayıtlar var, silinemez.');
  db.prepare('DELETE FROM trainings WHERE id = ?').run(t.id);
}

/* ----------------------------------------------------------- milestones */

export function addMilestone(trainingId, payload) {
  const training = db.prepare('SELECT id FROM trainings WHERE id = ?').get(Number(trainingId));
  if (!training) throw new HttpError(404, 'Eğitim bulunamadı.');
  const title = text(payload.title, 200);
  if (!title) throw new HttpError(400, 'Milestone adı boş olamaz.');
  if (payload.due_date && !isValidDateTime(payload.due_date)) throw new HttpError(400, 'Geçersiz tarih.');
  const order = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM milestones WHERE training_id = ?').get(training.id).n || 0) + 10;
  const info = db.prepare(`
    INSERT INTO milestones (training_id, title, due_date, planned_hours, status, note, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    training.id, title, payload.due_date || null,
    num(payload.planned_hours, 0, 0, 10000),
    oneOf(payload.status, MILESTONE_STATUSES, 'bekliyor'),
    text(payload.note, 500), order,
  );
  return db.prepare('SELECT * FROM milestones WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function updateMilestone(id, payload) {
  const m = db.prepare('SELECT * FROM milestones WHERE id = ?').get(Number(id));
  if (!m) throw new HttpError(404, 'Milestone bulunamadı.');
  if (payload.due_date && !isValidDateTime(payload.due_date)) throw new HttpError(400, 'Geçersiz tarih.');
  db.prepare(`
    UPDATE milestones SET title = ?, due_date = ?, planned_hours = ?, status = ?, note = ?
     WHERE id = ?
  `).run(
    text(payload.title ?? m.title, 200) || m.title,
    payload.due_date === undefined ? m.due_date : (payload.due_date || null),
    num(payload.planned_hours ?? m.planned_hours, m.planned_hours, 0, 10000),
    oneOf(payload.status ?? m.status, MILESTONE_STATUSES, m.status),
    text(payload.note ?? m.note, 500),
    m.id,
  );
  return db.prepare('SELECT * FROM milestones WHERE id = ?').get(m.id);
}

export function deleteMilestone(id) {
  const info = db.prepare('DELETE FROM milestones WHERE id = ?').run(Number(id));
  if (info.changes === 0) throw new HttpError(404, 'Milestone bulunamadı.');
}

/* ------------------------------------------------------------------ gno */

export function getGno() {
  const settings = getSettings();
  const courses = listCourses();
  const rows = courses.map((c) => {
    const grade = c.final_grade ?? c.projected_grade ?? c.target_grade;
    const source = c.final_grade ? 'final' : c.projected_grade ? 'projeksiyon' : 'hedef';
    const point = c.grading_type === 'letter' ? gradePoint(grade) : null;
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      ects: c.ects,
      target_grade: c.target_grade,
      final_grade: c.final_grade,
      projected_grade: c.projected_grade,
      grade,
      source,
      point,
      grading_type: c.grading_type,
      contribution: point !== null ? round2(c.ects * point) : 0,
    };
  });

  const letterRows = rows.filter((r) => r.grading_type === 'letter' && r.ects > 0 && r.point !== null);
  const termEcts = letterRows.reduce((sum, r) => sum + r.ects, 0);
  const termPoints = letterRows.reduce((sum, r) => sum + r.contribution, 0);
  const termGpa = termEcts ? round2(termPoints / termEcts) : null;

  const previousEcts = settings.previous_ects;
  const previousPoints = settings.previous_gno * previousEcts;
  const cumulativeEcts = previousEcts + termEcts;
  const cumulativePoints = previousPoints + termPoints;
  const cumulativeGno = cumulativeEcts ? round2(cumulativePoints / cumulativeEcts) : null;

  const targetEcts = settings.target_ects;
  const remainingEcts = Math.max(0, targetEcts - cumulativeEcts);
  const requiredAverage = remainingEcts > 0
    ? round2((settings.gno_target * targetEcts - cumulativePoints) / remainingEcts)
    : null;

  const completedRows = rows.filter((r) => r.grading_type === 'letter' && r.final_grade && r.point !== null);
  const completedEcts = completedRows.reduce((sum, r) => sum + r.ects, 0);
  const completedPoints = completedRows.reduce((sum, r) => sum + r.contribution, 0);
  const completedGpa = completedEcts ? round2(completedPoints / completedEcts) : null;

  const repeatCourse = courses.find((c) => c.is_repeat && c.code === 'MATH101')
    ?? courses.find((c) => c.is_repeat);
  let repeatScenario = null;
  if (repeatCourse) {
    const row = rows.find((r) => r.id === repeatCourse.id);
    const currentContribution = row?.contribution ?? 0;
    const basePoints = cumulativePoints - currentContribution;
    const ddPoint = gradePoint('DD');
    const aaPoint = gradePoint('AA');
    repeatScenario = {
      code: repeatCourse.code,
      name: repeatCourse.name,
      ects: repeatCourse.ects,
      current_grade: row?.grade ?? null,
      current_point: row?.point ?? null,
      dd_gno: cumulativeEcts ? round2((basePoints + repeatCourse.ects * ddPoint) / cumulativeEcts) : null,
      aa_gno: cumulativeEcts ? round2((basePoints + repeatCourse.ects * aaPoint) / cumulativeEcts) : null,
      delta_points: round2(repeatCourse.ects * (aaPoint - ddPoint)),
    };
  }

  return {
    settings: {
      gno_target: settings.gno_target,
      previous_gno: settings.previous_gno,
      previous_ects: previousEcts,
      target_ects: targetEcts,
    },
    rows,
    term: { ects: termEcts, points: round2(termPoints), gpa: termGpa },
    completed: { ects: completedEcts, points: round2(completedPoints), gpa: completedGpa },
    cumulative: { ects: cumulativeEcts, points: round2(cumulativePoints), gno: cumulativeGno },
    target: {
      ects: targetEcts,
      remaining_ects: remainingEcts,
      required_average: requiredAverage,
      feasible: requiredAverage !== null && requiredAverage <= 4.0,
    },
    repeat_scenario: repeatScenario,
    scale: GRADE_SCALE,
  };
}

/* -------------------------------------------------------------- summary */

function upcomingItems(from, to) {
  const assessments = db.prepare(`
    SELECT a.id, a.title, a.type, a.date AS due_date, a.weight,
           c.code AS course_code, c.name AS course_name
      FROM assessments a JOIN courses c ON c.id = a.course_id
     WHERE a.date BETWEEN ? AND ?
  `).all(from, to).map((r) => ({ ...r, kind: 'sinav', source: 'assessment' }));

  const tasks = db.prepare(`
    SELECT t.id, t.title, t.kind, t.due_date, t.priority, t.status,
           c.code AS course_code, tr.name AS training_name
      FROM tasks t
      LEFT JOIN courses c ON c.id = t.course_id
      LEFT JOIN trainings tr ON tr.id = t.training_id
     WHERE substr(t.due_date, 1, 10) BETWEEN ? AND ?
       AND t.status = 'acik'
  `).all(from, to).map((r) => ({ ...r, source: 'task' }));

  const milestones = db.prepare(`
    SELECT m.id, m.title, m.due_date, m.status, m.planned_hours,
           tr.name AS training_name
      FROM milestones m JOIN trainings tr ON tr.id = m.training_id
     WHERE substr(m.due_date, 1, 10) BETWEEN ? AND ?
       AND m.status <> 'bitti'
  `).all(from, to).map((r) => ({ ...r, kind: 'milestone', source: 'milestone' }));

  return [...assessments, ...tasks, ...milestones]
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
}

export function getSummary(date = todayISO()) {
  if (!isValidDate(date)) throw new HttpError(400, 'Geçersiz tarih.');
  const today = todayISO();
  const stats = getStats(30);
  const day = getDay(date);
  const week = stats.week;
  const settings = getSettings();
  const gno = getGno();
  const upcoming = upcomingItems(today, addDays(today, 14));

  const risks = [];
  for (const c of listCourses()) {
    if (c.status !== 'aktif') continue;
    if (c.category === 'staj' || c.grading_type === 'pass_fail') continue;
    if (c.days_since_log === null) {
      risks.push({ level: 'high', text: `${c.code} için henüz kayıt yok.`, course: c.code });
    } else if (c.days_since_log >= 5) {
      risks.push({ level: 'medium', text: `${c.code} ${c.days_since_log} gündür dokunulmadı.`, course: c.code });
    }
    if (c.next_assessment && c.next_assessment.date <= addDays(today, 7)) {
      risks.push({ level: 'high', text: `${c.code} · ${c.next_assessment.title} ${c.next_assessment.date} tarihinde.`, course: c.code });
    }
  }
  for (const t of listTasks()) {
    if (t.status === 'acik' && t.due_date && t.due_date.slice(0, 10) < today) {
      risks.push({ level: 'high', text: `Gecikmiş görev: ${t.title}`, task: t.id });
    }
  }

  const next = upcoming[0] ?? null;
  return {
    date,
    today,
    day,
    settings,
    stats,
    week,
    upcoming,
    risks: risks.slice(0, 12),
    next,
    gno,
  };
}

/* ---------------------------------------------------------------- export */

function csvCell(value) {
  const s = String(value ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/* --------------------------------------------------------------- import */

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeValue(value) {
  return normalizeHeader(value).replace(/_/g, '');
}

function parseDelimited(text) {
  const firstLine = String(text).split(/\r?\n/).find((line) => line.trim()) || '';
  const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
  return rows;
}

function decodeHtml(value) {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .trim();
}

function parseHtmlTable(text) {
  const table = String(text).match(/<table\b[\s\S]*?<\/table>/i)?.[0] ?? String(text);
  return [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((row) => [...row[0].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((cell) => decodeHtml(cell[2])))
    .filter((cells) => cells.length > 0);
}

function parseImportRows(text) {
  const source = String(text ?? '').trim();
  if (!source) throw new HttpError(400, 'İçe aktarılacak veri boş.');
  const rows = /<table\b/i.test(source) ? parseHtmlTable(source) : parseDelimited(source);
  if (rows.length < 2) throw new HttpError(400, 'En az bir başlık ve bir veri satırı gerekir.');
  const header = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells, index) => {
    const row = { __row: index + 2 };
    header.forEach((key, i) => {
      if (key) row[key] = String(cells[i] ?? '').trim();
    });
    return row;
  });
}

function importLogs(rows) {
  const courses = new Map(db.prepare('SELECT id, code FROM courses').all().map((r) => [r.code.toUpperCase(), r.id]));
  const trainings = new Map(db.prepare('SELECT id, name FROM trainings').all().map((r) => [r.name.toLocaleLowerCase('tr'), r.id]));
  const topics = db.prepare('SELECT id, course_id, title FROM topics').all();
  const milestones = db.prepare('SELECT id, training_id, title FROM milestones').all();
  const groups = new Map();
  const errors = [];
  let imported = 0;

  for (const row of rows) {
    const date = String(row.tarih || '');
    if (!isValidDate(date)) {
      errors.push(`Satır ${row.__row}: geçersiz tarih.`);
      continue;
    }
    const kind = normalizeValue(row.tur || '');
    const courseCode = String(row.kod || '').trim().toUpperCase();
    const trainingName = String(row.ad || '').trim().toLocaleLowerCase('tr');
    const courseId = kind === 'egitim' ? null : courses.get(courseCode) ?? null;
    const trainingId = kind === 'egitim' ? trainings.get(trainingName) ?? null : null;
    if (kind === 'egitim' && !trainingId) {
      errors.push(`Satır ${row.__row}: eğitim bulunamadı (${row.ad || '—'}).`);
      continue;
    }
    if (kind !== 'egitim' && !courseId) {
      errors.push(`Satır ${row.__row}: ders bulunamadı (${row.kod || '—'}).`);
      continue;
    }

    const topicTitle = String(row.konu || '').trim().toLocaleLowerCase('tr');
    const topic = courseId && topicTitle
      ? topics.find((t) => t.course_id === courseId && t.title.toLocaleLowerCase('tr') === topicTitle)
      : null;
    const milestone = trainingId && topicTitle
      ? milestones.find((m) => m.training_id === trainingId && m.title.toLocaleLowerCase('tr') === topicTitle)
      : null;
    const minutes = int(row.dakika, 0, 0, 1440);
    const note = text(row.not, 500);
    if (minutes === 0 && !note) {
      errors.push(`Satır ${row.__row}: dakika veya not yok.`);
      continue;
    }

    const log = {
      course_id: courseId,
      training_id: trainingId,
      topic_id: topic?.id ?? null,
      milestone_id: milestone?.id ?? null,
      minutes,
      activity: oneOf(normalizeValue(row.aktivite), ACTIVITIES, 'calisma'),
      note,
    };
    if (!groups.has(date)) {
      groups.set(date, {
        mood: nullableInt(row.ruh_hali, 1, 5),
        energy: nullableInt(row.enerji, 1, 5),
        note: text(row.gun_notu, 2000),
        logs: [],
      });
    }
    const group = groups.get(date);
    if (group.mood === null) group.mood = nullableInt(row.ruh_hali, 1, 5);
    if (group.energy === null) group.energy = nullableInt(row.enerji, 1, 5);
    if (!group.note) group.note = text(row.gun_notu, 2000);
    group.logs.push(log);
    imported += 1;
  }

  const logKey = (log) => [
    log.course_id ?? '', log.training_id ?? '', log.topic_id ?? '', log.milestone_id ?? '',
    log.activity ?? '', log.minutes ?? 0, log.note ?? '',
  ].join('|');

  for (const [date, group] of groups) {
    const existing = getDay(date);
    const merged = [];
    const seen = new Set();
    for (const log of [...(existing.logs || []), ...group.logs]) {
      const key = logKey(log);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(log);
    }
    saveDay(date, {
      mood: group.mood ?? existing.mood,
      energy: group.energy ?? existing.energy,
      note: group.note || existing.note,
      logs: merged,
    });
  }

  return { kind: 'logs', imported, days: groups.size, skipped: errors.length, errors: errors.slice(0, 20) };
}

function importAssessments(rows) {
  const courses = new Map(db.prepare('SELECT id, code FROM courses').all().map((r) => [r.code.toUpperCase(), r.id]));
  const existing = listAssessments();
  const errors = [];
  let imported = 0;
  let updated = 0;

  for (const row of rows) {
    const courseId = courses.get(String(row.kod || '').trim().toUpperCase());
    const title = text(row.baslik, 120);
    if (!courseId || !title) {
      errors.push(`Satır ${row.__row}: ders kodu veya başlık eksik.`);
      continue;
    }
    const date = String(row.tarih || '');
    if (date && !isValidDate(date)) {
      errors.push(`Satır ${row.__row}: geçersiz tarih.`);
      continue;
    }
    const payload = {
      course_id: courseId,
      type: normalizeValue(row.tur) || 'vize',
      title,
      date: date || null,
      weight: num(row.agirlik, 0, 0, 200),
      score: row.puan === '' ? null : nullableNum(row.puan, 0, 1000),
      max_score: row.maks === '' ? null : nullableNum(row.maks, 0, 1000),
      status: oneOf(normalizeValue(row.durum), ['planlandi', 'girildi', 'aciklandi'], row.puan !== '' ? 'girildi' : 'planlandi'),
      note: text(row.not, 500),
    };
    const match = existing.find((a) => a.course_id === courseId && a.title.toLocaleLowerCase('tr') === title.toLocaleLowerCase('tr'));
    if (match) {
      updateAssessment(match.id, payload);
      updated += 1;
    } else {
      const created = createAssessment(payload);
      existing.push(created);
      imported += 1;
    }
  }

  return { kind: 'assessments', imported, updated, skipped: errors.length, errors: errors.slice(0, 20) };
}

function importTasks(rows) {
  const courses = new Map(db.prepare('SELECT id, code FROM courses').all().map((r) => [r.code.toUpperCase(), r.id]));
  const trainings = new Map(db.prepare('SELECT id, name FROM trainings').all().map((r) => [r.name.toLocaleLowerCase('tr'), r.id]));
  const existing = listTasks();
  const errors = [];
  let imported = 0;
  let updated = 0;

  for (const row of rows) {
    const title = text(row.gorev, 160);
    if (!title) {
      errors.push(`Satır ${row.__row}: görev adı eksik.`);
      continue;
    }
    const due = String(row.tarih || '');
    if (due && !isValidDateTime(due)) {
      errors.push(`Satır ${row.__row}: geçersiz tarih.`);
      continue;
    }
    const payload = {
      title,
      kind: oneOf(normalizeValue(row.tur), TASK_KINDS, 'teslim'),
      due_date: due || null,
      priority: oneOf(normalizeValue(row.oncelik), ['dusuk', 'normal', 'yuksek'], 'normal'),
      status: oneOf(normalizeValue(row.durum), ['acik', 'bitti', 'iptal'], 'acik'),
      course_id: courses.get(String(row.ders || '').trim().toUpperCase()) ?? null,
      training_id: trainings.get(String(row.egitim || '').trim().toLocaleLowerCase('tr')) ?? null,
      note: text(row.not, 1000),
    };
    const match = existing.find((t) => t.title.toLocaleLowerCase('tr') === title.toLocaleLowerCase('tr')
      && String(t.due_date || '') === String(due || ''));
    if (match) {
      updateTask(match.id, payload);
      updated += 1;
    } else {
      const created = createTask(payload);
      existing.push(created);
      imported += 1;
    }
  }

  return { kind: 'tasks', imported, updated, skipped: errors.length, errors: errors.slice(0, 20) };
}

export function importCsv(kind, text) {
  if (!['logs', 'assessments', 'tasks'].includes(kind)) {
    throw new HttpError(400, 'Geçersiz içe aktarma türü.');
  }
  const rows = parseImportRows(text);
  if (kind === 'assessments') return importAssessments(rows);
  if (kind === 'tasks') return importTasks(rows);
  return importLogs(rows);
}

export function exportCsv(kind = 'logs') {
  let lines;
  if (kind === 'assessments') {
    lines = ['ders;kod;tur;baslik;tarih;agirlik;puan;maks;puan_yuzdesi;durum;not'];
    for (const r of listAssessments()) {
      lines.push([
        r.course_name, r.course_code, r.type, r.title, r.date ?? '', r.weight,
        r.score ?? '', r.max_score ?? '', r.percent ?? '', r.status, r.note,
      ].map(csvCell).join(';'));
    }
  } else if (kind === 'tasks') {
    lines = ['gorev;tur;tarih;oncelik;durum;ders;egitim;not'];
    for (const r of listTasks()) {
      lines.push([
        r.title, r.kind, r.due_date ?? '', r.priority, r.status,
        r.course_code ?? '', r.training_name ?? '', r.note,
      ].map(csvCell).join(';'));
    }
  } else {
    lines = ['tarih;tur;kod;ad;konu;aktivite;dakika;not;ruh_hali;enerji;gun_notu'];
    for (const r of listLogs('2000-01-01', '2100-12-31')) {
      lines.push([
        r.date, r.course_id ? 'ders' : 'egitim',
        r.course_code ?? '', r.course_name ?? r.training_name ?? '',
        r.topic_title ?? r.milestone_title ?? '', r.activity, r.minutes, r.note,
        r.mood ?? '', r.energy ?? '', r.day_note,
      ].map(csvCell).join(';'));
    }
  }
  return '\uFEFF' + lines.join('\r\n');
}

/* ------------------------------------------------------------- bootstrap */

export function getBootstrap() {
  return {
    settings: getSettings(),
    term: getTerm(),
    terms: listTerms(),
    courses: listCourses(),
    trainings: listTrainings(),
    topics: db.prepare('SELECT * FROM topics ORDER BY course_id, sort_order, week, id').all(),
    milestones: db.prepare('SELECT * FROM milestones ORDER BY training_id, sort_order, due_date, id').all(),
    assessments: listAssessments(),
    tasks: listTasks(),
    today: todayISO(),
    dbPath: DB_PATH,
    gradeScale: GRADE_SCALE,
    activities: ACTIVITIES,
    taskKinds: TASK_KINDS,
    topicStatuses: TOPIC_STATUSES,
    trainingStatuses: TRAINING_STATUSES,
    milestoneStatuses: MILESTONE_STATUSES,
  };
}
