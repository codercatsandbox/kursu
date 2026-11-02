import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';

const testDb = `/tmp/kursu-test-${process.pid}.sqlite`;
process.env.DB_PATH = testDb;
for (const suffix of ['', '-wal', '-shm']) rmSync(`${testDb}${suffix}`, { force: true });

const {
  db,
  getBootstrap,
  getCourse,
  getDay,
  getGno,
  getStats,
  getSummary,
  createAssessment,
  importCsv,
  listTasks,
  saveDay,
  updateAssessment,
  upsertExternalCourse,
  exportCsv,
} = await import('../db.js');

after(() => {
  try {
    db.close();
  } catch {
    /* zaten kapalı */
  }
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${testDb}${suffix}`, { force: true });
});

test('seed 2026-2027 Güz derslerini ve 45 AKTS toplamını oluşturur', () => {
  const boot = getBootstrap();
  assert.equal(boot.term.name, '2026-2027 GÜZ');
  assert.equal(boot.term.start_date, '2026-09-21');
  assert.equal(boot.term.end_date, '2027-01-15');
  assert.equal(boot.courses.length, 9);
  assert.equal(boot.courses.reduce((sum, c) => sum + c.ects, 0), 45);
  assert.equal(boot.assessments.length, 28);
  assert.equal(boot.trainings.length, 0);
  const midterms = boot.assessments
    .filter((assessment) => assessment.type === 'vize')
    .map((assessment) => assessment.date);
  assert.ok(midterms.every((date) => date >= '2026-11-14'));
});

test('GNO başlangıç bilgileri boş ve ders projeksiyonu kullanılabilir', () => {
  const gno = getGno();
  assert.equal(gno.settings.previous_gno, 0);
  assert.equal(gno.settings.previous_ects, 0);
  assert.equal(gno.term.ects, 41);
  assert.equal(gno.repeat_scenario.code, 'MATH101');
  assert.equal(gno.repeat_scenario.ects, 6);
});

test('günlük kayıt ders ve eğitim loglarını birlikte saklar', () => {
  const boot = getBootstrap();
  const course = boot.courses.find((c) => c.code === 'CENG301');
  const topic = boot.topics.find((t) => t.course_id === course.id);

  const saved = saveDay('2026-10-28', {
    mood: 4,
    energy: 3,
    note: 'Test günü.',
    logs: [
      { course_id: course.id, topic_id: topic.id, minutes: 90, activity: 'ders' },
    ],
  });

  assert.equal(saved.exists, true);
  assert.equal(saved.mood, 4);
  assert.equal(saved.note, 'Test günü.');
  assert.equal(saved.logs.length, 1);
  assert.equal(saved.logs.reduce((sum, l) => sum + l.minutes, 0), 90);
  assert.equal(getDay('2026-10-28').logs.length, 1);
  assert.ok(getStats(30).range.minutes >= 90);
  assert.equal(getSummary('2026-10-28').day.note, 'Test günü.');
});

test('değerlendirme puanı ders projeksiyonunu ve GNO kaynağını günceller', () => {
  const boot = getBootstrap();
  const course = boot.courses.find((c) => c.code === 'CENG301');
  const midterm = boot.assessments.find((a) => a.course_id === course.id && a.type === 'vize');

  updateAssessment(midterm.id, { score: 45, max_score: 50, status: 'girildi' });
  const detail = getCourse(course.id);
  assert.equal(detail.assessment.percent, 90);
  assert.equal(detail.projected_grade, 'AA');

  const row = getGno().rows.find((r) => r.code === 'CENG301');
  assert.equal(row.source, 'projeksiyon');
  assert.equal(row.grade, 'AA');
});

test('CENG327 quizleri Salı günüyle ve beş kayıtla sınırlıdır', () => {
  const boot = getBootstrap();
  const course = boot.courses.find((course) => course.code === 'CENG327');

  assert.throws(
    () => createAssessment({ course_id: course.id, type: 'quiz', title: 'Cuma Quiz', date: '2026-12-04' }),
    /Salı günü/,
  );

  for (let index = 0; index < 4; index += 1) {
    createAssessment({
      course_id: course.id,
      type: 'quiz',
      title: `Salı Quiz ${index + 2}`,
      date: `2027-01-${String(index * 7 + 5).padStart(2, '0')}`,
    });
  }
  assert.throws(
    () => createAssessment({ course_id: course.id, type: 'quiz', title: 'Altıncı Quiz', date: '2027-02-02' }),
    /en fazla 5 quiz/,
  );
});

test('CENG305 quizleri iki haftada bir Pazartesiye denk gelir', () => {
  const boot = getBootstrap();
  const course = boot.courses.find((course) => course.code === 'CENG305');

  createAssessment({ course_id: course.id, type: 'quiz', title: 'Quiz 09.11', date: '2026-11-09' });
  createAssessment({ course_id: course.id, type: 'quiz', title: 'Quiz 23.11', date: '2026-11-23' });
  assert.throws(
    () => createAssessment({ course_id: course.id, type: 'quiz', title: 'Quiz 16.11', date: '2026-11-16' }),
    /iki haftada bir Pazartesi/,
  );
});

test('CENG441 quizleri üç haftada bir Cuma gününe denk gelir', () => {
  const boot = getBootstrap();
  const course = boot.courses.find((course) => course.code === 'CENG441');
  const firstQuiz = boot.assessments.find((assessment) => assessment.course_id === course.id && assessment.type === 'quiz');

  assert.equal(firstQuiz.date, '2026-10-23');
  createAssessment({ course_id: course.id, type: 'quiz', title: 'Quiz 13.11', date: '2026-11-13' });
  assert.throws(
    () => createAssessment({ course_id: course.id, type: 'quiz', title: 'Quiz 06.11', date: '2026-11-06' }),
    /üç haftada bir Cuma/,
  );
});

test('AYBÜZEM dersi lokal karşılığı yoksa normal ders kaydı oluşturur', () => {
  const first = upsertExternalCourse({ external_id: '18682', name: 'ÖMP EĞİTİM 2025 GÜZ' });
  assert.equal(first.code, 'AYB-18682');
  assert.equal(first.name, 'ÖMP EĞİTİM 2025 GÜZ');
  assert.equal(first.external_id, '18682');

  const second = upsertExternalCourse({ external_id: '18682', name: 'Değişmemeli' });
  assert.equal(second.id, first.id);
});

test('CSV dışa aktarma başlıkları ve kayıtları üretir', () => {
  const logs = exportCsv('logs');
  assert.match(logs, /^﻿?tarih;tur;kod;ad;konu;aktivite;dakika/);
  assert.match(logs, /CENG301/);

  const assessments = exportCsv('assessments');
  assert.match(assessments, /^﻿?ders;kod;tur;baslik;tarih;agirlik/);
  assert.match(assessments, /CENG301/);

  const tasks = exportCsv('tasks');
  assert.match(tasks, /^﻿?gorev;tur;tarih;oncelik;durum/);
});

test('CSV ve HTML tablo içe aktarma veriyi birleştirir', () => {
  const boot = getBootstrap();
  const course = boot.courses.find((c) => c.code === 'CENG301');
  const topic = boot.topics.find((t) => t.course_id === course.id);

  const logs = importCsv('logs', [
    'tarih;tur;kod;ad;konu;aktivite;dakika;not;ruh_hali;enerji;gun_notu',
    `2026-10-29;ders;CENG301;;${topic.title};ders;30;import;4;3;import günü`,
  ].join('\n'));
  assert.equal(logs.imported, 1);
  assert.equal(logs.days, 1);
  assert.equal(getDay('2026-10-29').logs.length, 1);

  const assessments = importCsv('assessments', [
    'ders;kod;tur;baslik;tarih;agirlik;puan;maks;durum;not',
    'DATABASE MANAGEMENT SYSTEMS;CENG301;quiz;CSV Quiz;2026-12-03;10;8;10;girildi;import',
  ].join('\n'));
  assert.equal(assessments.imported, 1);
  const quiz = getCourse(course.id).assessments.find((a) => a.title === 'CSV Quiz');
  assert.equal(quiz.percent, 80);

  const html = importCsv('assessments', '<table><tr><th>Ders</th><th>Kod</th><th>Tür</th><th>Başlık</th><th>Tarih</th><th>Ağırlık</th><th>Puan</th><th>Maks</th><th>Durum</th></tr><tr><td>DATABASE MANAGEMENT SYSTEMS</td><td>CENG301</td><td>quiz</td><td>HTML Quiz</td><td>2026-12-04</td><td>10</td><td>9</td><td>10</td><td>girildi</td></tr></table>');
  assert.equal(html.imported, 1);
  assert.equal(getCourse(course.id).assessments.find((a) => a.title === 'HTML Quiz').percent, 90);

  const tasks = importCsv('tasks', [
    'gorev;tur;tarih;oncelik;durum;ders;egitim;not',
    'CSV görevi;teslim;2026-11-15T12:00;normal;acik;CENG301;;import',
  ].join('\n'));
  assert.equal(tasks.imported, 1);
  assert.equal(listTasks().filter((t) => t.title === 'CSV görevi').length, 1);
});
