// Read recording evidence without changing or replaying the model request.
'use strict';
function validateTutorRecord(record, request) {
  const question = record?.messages?.at(-2), answer = record?.messages?.at(-1);
  if (question?.role !== 'user' || question.status !== 'complete' || answer?.role !== 'assistant' || answer.status !== 'complete'
    || answer.reply_to !== question.id || !answer.content?.trim() || question.content !== request.message?.trim()
    || (request.retry_id && question.id !== request.retry_id)) throw new Error('Tutor recording has no complete saved answer for this question');
  return record;
}
async function readTutorResponse(response, page) {
  if (response.status() !== 200) {
    const data = await response.json();
    throw new Error(data.error || `Local request failed: ${response.status()}`);
  }
  if (!response.headers()['content-type']?.includes('application/x-ndjson')) return response.json();
  // Chromium can discard a consumed Fetch stream's CDP response body. Observe completion,
  // then read the actual saved record; never replay the upstream request to collect evidence.
  const slug = new URL(response.url()).pathname.split('/').pop();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) throw new Error('Invalid tutor recording lesson');
  await page.waitForFunction(() => document.querySelector('.tutor-question')?.getAttribute('aria-busy') === 'false', undefined, { timeout: 65000 });
  const record = await page.evaluate(async (lesson) => {
    if (!document.querySelector('.tutor-status')?.hidden) throw new Error('Tutor recording ended with an error');
    const bootstrap = await fetch('/api/tutor/bootstrap').then(response => response.json());
    const response = await fetch('/api/tutor/history/' + lesson, { headers: { 'X-Teach-Token': bootstrap.token }, cache: 'no-store' });
    if (!response.ok) throw new Error('Saved tutor recording is unavailable');
    return response.json();
  }, slug);
  return validateTutorRecord(record, response.request().postDataJSON());
}
module.exports = { validateTutorRecord, readTutorResponse };
