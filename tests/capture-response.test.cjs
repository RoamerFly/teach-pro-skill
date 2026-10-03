const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateTutorRecord, readTutorResponse } = require('../example/competition-materials/scripts/capture_response.cjs');
const request = { message: '我的问题' };
const record = { messages: [{ role: 'user', id: 'question-id', content: '我的问题', status: 'complete' }, { role: 'assistant', reply_to: 'question-id', content: '中文流式正文', status: 'complete' }] };
test('recording validator accepts only a complete saved answer paired with this question', () => {
  assert.deepEqual(validateTutorRecord(record, request), record);
});
test('recording validator rejects partial, failed, mismatched and unrelated saved answers', () => {
  for (const patch of [{ status: 'incomplete' }, { status: 'failed' }, { reply_to: 'other-id' }, { content: '' }]) {
    const data = structuredClone(record); Object.assign(data.messages[1], patch);
    assert.throws(() => validateTutorRecord(data, request));
  }
  assert.throws(() => validateTutorRecord(record, { message: 'another question' }));
  assert.throws(() => validateTutorRecord(record, { ...request, retry_id: 'other' }));
  assert.throws(() => validateTutorRecord({}, request));
});
test('recording reader keeps JSON for model/test requests and propagates HTTP errors', async () => {
  const response = (status, data, type = 'application/json') => ({ status: () => status, headers: () => ({ 'content-type': type }), json: async () => data,
    url: () => 'http://127.0.0.1:5000/api/tutor/chat-stream/0001-intro', request: () => ({ postDataJSON: () => request }) });
  assert.deepEqual(await readTutorResponse(response(200, { models: [] })), { models: [] });
  let waited = false;
  const page = { waitForFunction: async () => { waited = true; }, evaluate: async () => record };
  assert.deepEqual(await readTutorResponse(response(200, record, 'application/x-ndjson'), page), record); assert.equal(waited, true);
  await assert.rejects(readTutorResponse(response(500, { error: 'local failure' })), /local failure/);
});
