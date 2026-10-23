const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname,'..');
const demo = path.join(repo,'example/competition-demo-rc12');
test('rc.12 showcase exposes three formal lessons and one independent supplement',()=>{
 const home=fs.readFileSync(path.join(demo,'index.html'),'utf8');
 assert(home.includes('data-course-section="formal"'));assert(home.includes('data-course-section="supplement"'));
 const lessons=fs.readdirSync(path.join(demo,'lessons')).filter(f=>f.endsWith('.html'));
 assert.equal(lessons.length,4);
 let formal=0,supplement=0;
 for(const file of lessons){const html=fs.readFileSync(path.join(demo,'lessons',file),'utf8');assert(html.includes('data-course-key="competition-demo-rc12"'));assert(!html.includes('0001-s01-runtime-checks.html'));if(html.includes('data-lesson-kind="formal"'))formal++;if(html.includes('data-lesson-kind="supplement"')){supplement++;assert(html.includes('data-related-lesson="0002"'));assert(html.includes('lesson-0002-s01-evidence'));}}
 assert.equal(formal,3);assert.equal(supplement,1);
 assert.equal(JSON.parse(fs.readFileSync(path.join(demo,'.teach-course.json'),'utf8')).demo.skill_version,'1.1.0-rc.14');
 for(const file of ['learner-submissions','learner-chats','.tutor-settings.json'])assert(!fs.existsSync(path.join(demo,file)));
});
test('rc.12 showcase copies current runtime exactly and keeps masked key default',()=>{
 for(const file of ['style.css','course.js','sync.js','tutor.js','tutor-settings.js','tutor-markdown.js'])assert.deepEqual(fs.readFileSync(path.join(demo,'assets',file)),fs.readFileSync(path.join(repo,'teach-pro/assets',file)));
 for(const file of ['serve_course.py','tutor_chat.py','credential_store.py','start-course.cmd','start-course.sh','start-course.command'])assert.deepEqual(fs.readFileSync(path.join(demo,file)),fs.readFileSync(path.join(repo,'teach-pro/assets',file)));
 const settings=fs.readFileSync(path.join(demo,'settings.html'),'utf8');assert(settings.includes('name="api_key" type="password"'));assert(settings.includes('name="remember_key" type="checkbox" checked'));
});
