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
  importCsv,
  listTasks,
  saveDay,
  updateAssessment,
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
  assert.equal(boot.assessments.length, 27);
  assert.equal(boot.trainings.length, 3);
});

test('GNO varsayımları ve MATH101 DD → AA senaryosu hesaplanır', () => {
  const gno = getGno();
  assert.equal(gno.settings.previous_gno, 3.12);
  assert.equal(gno.settings.previous_ects, 129);
  assert.equal(gno.term.ects, 41);
  assert.equal(gno.cumulative.ects, 164);
  assert.equal(gno.cumulative.gno, 3.35);
  assert.equal(gno.repeat_scenario.code, 'MATH101');
  assert.equal(gno.repeat_scenario.ects, 6);
  assert.equal(gno.repeat_scenario.delta_points, 18);
  assert.ok(gno.repeat_scenario.aa_gno > gno.repeat_scenario.dd_gno);
  assert.equal(gno.target.remaining_ects, 76);
  assert.equal(gno.target.required_average, 3.85);
  assert.equal(gno.target.remaining_ects_from_now, 117);
  assert.equal(gno.target.required_average_from_now, 3.81);
  assert.equal(gno.target.extra_ects_at_maximum, 0);
});

test('günlük kayıt ders ve eğitim loglarını birlikte saklar', () => {
  const boot = getBootstrap();
  const course = boot.courses.find((c) => c.code === 'CENG301');
  const topic = boot.topics.find((t) => t.course_id === course.id);
  const training = boot.trainings.find((t) => t.name.includes('FPGA'));
  const milestone = boot.milestones.find((m) => m.training_id === training.id);

  const saved = saveDay('2026-10-28', {
    mood: 4,
    energy: 3,
    note: 'Test günü.',
    logs: [
      { course_id: course.id, topic_id: topic.id, minutes: 90, activity: 'ders' },
      { training_id: training.id, milestone_id: milestone.id, minutes: 45, activity: 'egitim' },
    ],
  });

  assert.equal(saved.exists, true);
  assert.equal(saved.mood, 4);
  assert.equal(saved.note, 'Test günü.');
  assert.equal(saved.logs.length, 2);
  assert.equal(saved.logs.reduce((sum, l) => sum + l.minutes, 0), 135);
  assert.equal(getDay('2026-10-28').logs.length, 2);
  assert.ok(getStats(30).range.minutes >= 135);
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
  const training = boot.trainings.find((t) => t.name.includes('FPGA'));
  const milestone = boot.milestones.find((m) => m.training_id === training.id);

  const logs = importCsv('logs', [
    'tarih;tur;kod;ad;konu;aktivite;dakika;not;ruh_hali;enerji;gun_notu',
    `2026-10-29;ders;CENG301;;${topic.title};ders;30;import;4;3;import günü`,
    `2026-10-29;egitim;;${training.name};${milestone.title};egitim;20;;;;`,
  ].join('\n'));
  assert.equal(logs.imported, 2);
  assert.equal(logs.days, 1);
  assert.equal(getDay('2026-10-29').logs.length, 2);

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
