import { MAX_PLAN_INPUT, parseStructuredPlans, validPlan } from '../../shared/planning-input.mjs';

const planSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    category: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    cadence: { type: 'string' },
    target_date: { type: ['string', 'null'] },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
    schedule: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sessions_per_week: { type: 'integer', minimum: 0, maximum: 7 },
        duration_minutes: { type: 'integer', minimum: 15, maximum: 240 },
        preferred_time: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'any'] },
      },
      required: ['sessions_per_week', 'duration_minutes', 'preferred_time'],
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: [
    'title',
    'summary',
    'category',
    'priority',
    'cadence',
    'target_date',
    'tasks',
    'schedule',
    'assumptions',
    'notes',
  ],
};

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function safeContext(value) {
  const context = value && typeof value === 'object' ? value : {};
  return {
    active_goals: Array.isArray(context.active_goals) ? context.active_goals.slice(0, 10) : [],
    existing_blocks: Array.isArray(context.existing_blocks) ? context.existing_blocks.slice(0, 70) : [],
    execution_rules: context.execution_rules && typeof context.execution_rules === 'object'
      ? context.execution_rules
      : {},
    calendar_present: Boolean(context.calendar_present),
  };
}

async function authenticate(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const SUPABASE_URL = Netlify.env.get('VITE_SUPABASE_URL') || 'https://ayizmdoyynptwadnjpdc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || 'sb_publishable_sfp0ZpI3horCqcn-fO0NVQ_-l6meKtQ';
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: authHeader,
    },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  return response.json();
}

function responseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const texts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') texts.push(content.text);
    }
  }
  return texts.join('');
}

export default async (request) => {
  let user;
  try {
    user = await authenticate(request.headers.get('authorization'));
  } catch {
    return json({ code: 'auth_unavailable', error: 'Could not check your session. Your draft is safe; try again shortly.' }, 503);
  }
  if (!user) return json({ error: 'Your ONTRACK session is no longer valid. Please sign in again.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const intent = String(body?.intent || '').trim();
  if (!intent) return json({ error: 'Tell ONTRACK what you want to make happen.' }, 400);
  if (intent.length > MAX_PLAN_INPUT) return json({ error: 'This request is over 25,000 characters. Split it into two parts; your draft is safe.' }, 400);

  const imported = parseStructuredPlans(intent);
  if (imported) return json(imported);

  const apiKey = Netlify.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return json({
      code: 'ai_not_configured',
      error: 'The ONTRACK AI planner is not connected yet.',
    }, 503);
  }

  const context = safeContext(body?.context);
  const currentDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const system = [
    'You are ONTRACK, a restrained personal execution planner.',
    'Turn the user intent into practical plans that can be previewed before application. Return one plan for a single goal, or up to 32 plans for separate goals.',
    'Keep every distinct requested action, named date, link, amount and budget constraint. Use notes for detailed reference text, calculations and qualifications.',
    `Today is ${currentDate} in Europe/London. Keep explicit past dates as written and flag them for review in assumptions; never silently move them.`,
    'Use the supplied current ONTRACK context. Do not pretend you know unavailable calendar details.',
    'Protect existing high-priority commitments. Prefer a realistic small plan over an ambitious overloaded plan.',
    'Do not double-book existing blocks. The client deterministically chooses exact free slots; only specify weekly scheduling need.',
    'If the user does not need recurring time, set sessions_per_week to 0.',
    'Tasks must be concrete next actions. Long authored lists must not be reduced to a handful of generic tasks.',
    'Treat investment figures as user-provided assumptions, not predictions or financial recommendations. Do not invent returns, eligibility or confirmed bookings.',
    'Assumptions should only include material assumptions the user may want to change.',
    'target_date must be YYYY-MM-DD when explicitly given or confidently implied, otherwise null.',
  ].join(' ');

  let openai;
  try {
    openai = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Netlify.env.get('OPENAI_MODEL') || 'gpt-5.4-mini',
      reasoning: { effort: 'low' },
      max_output_tokens: 12_000,
      input: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `User intent:\n${intent}\n\nCurrent ONTRACK context:\n${JSON.stringify(context)}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ontrack_plan_preview',
          strict: true,
          schema: {
            type: 'object', additionalProperties: false,
            properties: { plans: { type: 'array', minItems: 1, maxItems: 32, items: planSchema } },
            required: ['plans'],
          },
        },
      },
    }),
    signal: AbortSignal.timeout(40_000),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return json({ code: timedOut ? 'planner_timeout' : 'planner_unavailable', error: timedOut ? 'Planning took too long. Your draft is safe; try again or import it as written.' : 'The AI planner could not be reached. Try again or import your draft as written.' }, 503);
  }

  const payload = await openai.json().catch(() => ({}));
  if (!openai.ok) {
    const code = payload?.error?.code || 'unknown';
    // Log status and provider code only: never log tokens or personal plan contents.
    console.error('ONTRACK planner OpenAI error', openai.status, code);
    if (code === 'insufficient_quota') return json({ code: 'planner_quota', error: 'The AI planner has reached its service budget. You can still import your draft as written.' }, 503);
    if (openai.status === 429) return json({ code: 'planner_busy', error: 'The AI planner is busy. Try again shortly, or import your draft as written.' }, 503);
    if ([400, 401, 403, 404].includes(openai.status)) return json({ code: 'planner_configuration', error: 'The AI planner needs a service configuration fix. You can still import your draft as written.' }, 503);
    return json({ code: 'planner_unavailable', error: 'The AI planner is temporarily unavailable. Try again or import your draft as written.' }, 502);
  }

  if (payload.status === 'incomplete') return json({ code: 'planner_incomplete', error: 'The AI planner did not finish the whole plan. Try again or import your draft as written.' }, 502);
  if ((payload.output || []).some(item => (item.content || []).some(content => content.type === 'refusal'))) return json({ code: 'planner_refused', error: 'The AI planner could not organise this request. You can still review and import the text as written.' }, 422);

  const output = responseText(payload);
  if (!output) return json({ error: 'The planning engine returned an empty response.' }, 502);

  try {
    const result = JSON.parse(output);
    if (!Array.isArray(result.plans) || !result.plans.length || result.plans.length > 32 || !result.plans.every(validPlan)) throw new Error('Invalid plan shape');
    return json({ plans: result.plans, source: 'ai' });
  } catch {
    return json({ error: 'The planning engine returned an invalid plan.' }, 502);
  }
};

export const config = {
  path: '/api/ontrack-plan',
  method: 'POST',
};
