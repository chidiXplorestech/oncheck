import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/ontrack-plan.mjs';
import { MAX_PLAN_INPUT, parseStructuredPlans, validPlan } from '../shared/planning-input.mjs';

const authored = `**Near-term plan**\n${Array.from({ length: 14 }, (_, i) => `${i + 1}. **Action ${i + 1}:** Review the next step, confirm the date and budget, and keep the full original detail.`).join('\n')}\n\n**Long-term plan**\n${Array.from({ length: 10 }, (_, i) => `${i + 1}. Goal ${i + 1}: Practise consistently and review progress towards 11 January 2027.`).join('\n')}\n\n**Investment notes**\nMonthly contribution: £50. Assumed growth: 5%. Fees excluded.\n| Time | Amount |\n| 12 months | £600 |\n\\[B = P\\times((1+r)^n-1)/r\\]\n\n**Weekly check-in**\nReview progress once a week and budgets once a month.`;
const plan = { title: 'Learn Python', summary: 'Practise weekly.', category: 'Learning', priority: 'medium', cadence: 'Weekly', target_date: null, tasks: [{ title: 'Work through a Python exercise' }], schedule: { sessions_per_week: 1, duration_minutes: 120, preferred_time: 'evening' }, assumptions: [], notes: '' };

function setup(t, provider, env = {}) {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'test-user' });
    return provider(url, options);
  });
  globalThis.Netlify = { env: { get: key => ({ OPENAI_API_KEY: 'test-key', ...env })[key] } };
  t.after(() => { delete globalThis.Netlify; });
}
const request = intent => new Request('http://localhost/api/ontrack-plan', { method: 'POST', headers: { authorization: 'Bearer test-session', 'content-type': 'application/json' }, body: JSON.stringify({ intent }) });

test('authored multi-section text retains all 24 numbered actions and reference notes', () => {
  assert.ok(authored.length > 1200);
  const result = parseStructuredPlans(authored);
  assert.equal(result.plans.length, 4);
  assert.equal(result.plans[0].tasks.length, 14);
  assert.equal(result.plans[1].tasks.length, 10);
  assert.match(result.plans[2].notes, /Fees excluded/);
  assert.match(result.plans[2].notes, /\\times/);
  assert.equal(result.plans[1].tasks[9].title, 'Goal 10: Practise consistently and review progress towards 11 January 2027.');
  assert.ok(result.plans.every(plan => plan.schedule.sessions_per_week === 0));
});

test('structured import works without an AI key and never sends the text to the provider', async t => {
  setup(t, () => { assert.fail('AI should not be called for authored structured text'); }, { OPENAI_API_KEY: undefined });
  const response = await handler(request(authored));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).plans.length, 4);
});

test('unauthenticated import is rejected before reading or importing a plan', async t => {
  setup(t, () => assert.fail('AI called'));
  const response = await handler(new Request('http://localhost/api/ontrack-plan', { method: 'POST', body: JSON.stringify({ intent: authored }) }));
  assert.equal(response.status, 401);
});

test('input cap is explicit rather than silently truncating', async t => {
  setup(t, () => assert.fail('AI called'));
  const response = await handler(request('x'.repeat(MAX_PLAN_INPUT + 1)));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /25,000/);
});

test('AI accepts long freeform input and validates a complete multi-plan response', async t => {
  const intent = 'I want to learn Python and practise through projects. '.repeat(40);
  setup(t, (_url, options) => {
    const body = JSON.parse(options.body);
    assert.ok(body.input[1].content.includes(intent.trim()));
    assert.match(body.input[0].content, /Europe\/London/);
    assert.equal(body.text.format.schema.properties.plans.maxItems, 32);
    return Response.json({ status: 'completed', output_text: JSON.stringify({ plans: [plan, { ...plan, title: 'Build a project' }] }) });
  });
  const response = await handler(request(intent));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).plans.length, 2);
});

for (const [name, payload, status, code] of [
  ['quota', { error: { code: 'insufficient_quota' } }, 429, 'planner_quota'],
  ['busy', { error: { code: 'rate_limit_exceeded' } }, 429, 'planner_busy'],
  ['configuration', { error: { code: 'model_not_found' } }, 404, 'planner_configuration'],
  ['provider down', {}, 500, 'planner_unavailable'],
  ['incomplete response', { status: 'incomplete', output_text: JSON.stringify({ plans: [plan] }) }, 200, 'planner_incomplete'],
  ['refusal', { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }, 200, 'planner_refused'],
]) {
  test(`${name} produces a useful recoverable error`, async t => {
    setup(t, () => Response.json(payload, { status }));
    const response = await handler(request('Make space for Python each week.'));
    assert.ok(response.status >= 400);
    const result = await response.json();
    assert.equal(result.code, code);
    assert.match(result.error, /import/i);
  });
}

test('provider timeout is handled without losing the draft', async t => {
  setup(t, () => { throw new DOMException('timeout', 'TimeoutError'); });
  const response = await handler(request('Learn Python'));
  assert.equal((await response.json()).code, 'planner_timeout');
});

test('malformed and missing schedule fields do not reach the preview', async t => {
  setup(t, () => Response.json({ output_text: JSON.stringify({ plans: [{ title: 'Invalid' }] }) }));
  const response = await handler(request('Learn Python'));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /invalid plan/);
});

test('calendar dates must exist, including leap-year dates', () => {
  assert.equal(Boolean(validPlan({ ...plan, target_date: '2027-02-31' })), false);
  assert.equal(Boolean(validPlan({ ...plan, target_date: '2027-02-29' })), false);
  assert.equal(Boolean(validPlan({ ...plan, target_date: '2028-02-29' })), true);
});
