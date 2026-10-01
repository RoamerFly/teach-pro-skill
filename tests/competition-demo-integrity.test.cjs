const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const demo = path.join(root, 'example/competition-demo-zhi-jian-agent');
const read = file => fs.readFileSync(path.join(demo, file), 'utf8');
const pages = ['index.html', 'settings.html', 'practice/entry-assessment.html',
  'reference/teaching-decisions.html', 'reference/resource-learning-center.html',
  ...fs.readdirSync(path.join(demo, 'lessons')).map(file => `lessons/${file}`)];

test('Demo reuses the frozen runtime byte-for-byte', () => {
  for (const file of ['style.css', 'course.js', 'sync.js', 'tutor.js', 'tutor-settings.js']) {
    assert.deepEqual(fs.readFileSync(path.join(demo, 'assets', file)), fs.readFileSync(path.join(root, 'teach-pro/assets', file)), file);
  }
  for (const file of ['serve_course.py', 'tutor_chat.py', 'start-course.cmd', 'start-course.sh', 'start-course.command']) {
    assert.deepEqual(fs.readFileSync(path.join(demo, file)), fs.readFileSync(path.join(root, 'teach-pro/assets', file)), file);
  }
});

test('Demo pages share one independent course identity and theme', () => {
  assert.equal(pages.length, 8);
  for (const page of pages) {
    const source = read(page);
    assert.match(source, /data-course-key="competition-demo-zhi-jian-agent"/, page);
    assert.match(source, /data-visual-theme="systems"/, page);
    assert.match(source, /href="[^"\n]*assets\/demo\.css"/, page);
    assert.equal((source.match(/<h1[ >]/g) || []).length, 1, page);
  }
});

test('Demo starts without learner evidence or model secrets', () => {
  const meta = JSON.parse(read('.teach-course.json'));
  assert.equal(meta.latest_submission_lesson, null);
  assert.equal(meta.entry_assessment.submitted, false);
  assert.equal(meta.demo.synthetic_scenario, true);
  assert.equal(meta.demo.skill_version, '1.1.0-rc.3');
  for (const file of ['learner-submissions', 'learner-chats', '.tutor-settings.json', '__pycache__']) {
    assert.equal(fs.existsSync(path.join(demo, file)), false, file);
  }
  assert.match(read('settings.html'), /name="api_key" type="password"/);
  assert.doesNotMatch(read('settings.html'), /name="api_key"[^>]*value=/);
  assert.doesNotMatch(pages.map(read).join('\n'), /sk-[a-zA-Z0-9]{16,}/);
});

test('Showcase provides assessment and three lessons, not a fabricated fourth', () => {
  assert.equal(fs.readdirSync(path.join(demo, 'lessons')).filter(file => file.endsWith('.html')).length, 3);
  assert.equal((read('practice/entry-assessment.html').match(/data-save-key=/g) || []).length, 6);
  assert.match(read('reference/teaching-decisions.html'), /合成/);
  assert.match(read('reference/teaching-decisions.html'), /回放/);
  assert.match(read('lessons/0001-llm-to-agent-api-call.html'), /2210\.03629/);
});
