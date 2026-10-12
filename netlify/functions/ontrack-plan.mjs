const SUPABASE_URL = Netlify.env.get('VITE_SUPABASE_URL') || 'https://ayizmdoyynptwadnjpdc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || 'sb_publishable_sfp0ZpI3horCqcn-fO0NVQ_-l6meKtQ';
const OPENAI_MODEL = Netlify.env.get('OPENAI_MODEL') || 'gpt-5.4-mini';

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
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: authHeader,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

function responseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export default async (request) => {
  const user = await authenticate(request.headers.get('authorization'));
  if (!user) return json({ error: 'Your ONTRACK session is no longer valid. Please sign in again.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const intent = String(body?.intent || '').trim();
  if (!intent) return json({ error: 'Tell ONTRACK what you want to make happen.' }, 400);
  if (intent.length > 1200) return json({ error: 'Keep this plan request under 1,200 characters.' }, 400);

  const apiKey = Netlify.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return json({
      code: 'ai_not_configured',
      error: 'The ONTRACK AI planner is not connected yet.',
    }, 503);
  }

  const context = safeContext(body?.context);
  const system = [
    'You are ONTRACK, a restrained personal execution planner.',
    'Turn the user intent into one practical plan that can be previewed before application.',
    'Use the supplied current ONTRACK context. Do not pretend you know unavailable calendar details.',
    'Protect existing high-priority commitments. Prefer a realistic small plan over an ambitious overloaded plan.',
    'Do not double-book existing blocks. The client deterministically chooses exact free slots; only specify weekly scheduling need.',
    'If the user does not need recurring time, set sessions_per_week to 0.',
    'Tasks must be concrete next actions, normally 2 to 6 items.',
    'Assumptions should only include material assumptions the user may want to change.',
    'target_date must be YYYY-MM-DD when explicitly given or confidently implied, otherwise null.',
  ].join(' ');

  const openai = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: 'low' },
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
          schema: planSchema,
        },
      },
    }),
  });

  const payload = await openai.json().catch(() => ({}));
  if (!openai.ok) {
    console.error('ONTRACK planner OpenAI error', openai.status, payload?.error?.code || 'unknown');
    return json({ error: 'The planning engine could not complete this request.' }, 502);
  }

  const output = responseText(payload);
  if (!output) return json({ error: 'The planning engine returned an empty response.' }, 502);

  try {
    return json({ plan: JSON.parse(output) });
  } catch {
    return json({ error: 'The planning engine returned an invalid plan.' }, 502);
  }
};

export const config = {
  path: '/api/ontrack-plan',
  method: 'POST',
};
