const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../teach-pro');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pages = [
  ['templates/course-index.html', 'index.html'],
  ['templates/entry-assessment.html', 'practice/entry-assessment.html'],
  ['templates/reference.html', 'reference/summary.html'],
  ['templates/lesson.html', 'lessons/0001-intro.html'],
  ['assets/course-settings.html', 'settings.html'],
];

test('every page template has a settings link resolving to the same course root', () => {
  for (const [source, destination] of pages) {
    const html = read(source);
    const sidebar = html.match(/<aside\b[^>]*class="sidebar"[^>]*>([\s\S]*?)<\/aside>/)?.[1];
    assert.ok(sidebar, source);
    const firstNavigation = sidebar.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)?.[0];
    assert.match(firstNavigation, /class="course-settings-nav"/, source);
    const href = firstNavigation.match(/href="([^"]+)"/)[1];
    assert.equal(path.posix.normalize(path.posix.join(path.posix.dirname(destination), href)), 'settings.html');
    assert.doesNotMatch(html, /\{\{(?:SETTINGS_NAV|TUTOR_SCRIPT)_IF_ENABLED\}\}/);
  }
});

test('default lesson script and settings scripts resolve to deployable assets', () => {
  for (const source of ['templates/lesson.html', 'assets/course-settings.html']) {
    const html = read(source);
    const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map((match) => path.posix.basename(match[1]));
    assert.equal(scripts.filter((name) => name === (source.includes('lesson') ? 'tutor.js' : 'tutor-settings.js')).length, 1);
    for (const name of scripts) assert.ok(fs.existsSync(path.join(root, 'assets', name)), name);
  }
  const settings = read('assets/course-settings.html');
  assert.match(settings, /name="api_key" type="password"/);
  assert.doesNotMatch(settings, /name="api_key"[^>]*\bvalue=/);
  assert.doesNotMatch(read('templates/lesson.html'), /name="(?:api_key|base_url)"/);
  assert.ok(fs.existsSync(path.join(root, 'assets/tutor_chat.py')));
});
