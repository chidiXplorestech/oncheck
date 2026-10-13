export const MAX_PLAN_INPUT = 25_000;

export function importDraft(intent) {
  const structured = parseStructuredPlans(intent);
  if (structured) return structured;
  return {
    source: 'text_import',
    notice: 'Saved as a draft preview without AI changes. Your full text will be kept in the plan notes. No calendar times have been booked.',
    plans: [{
      title: plainText(intent.split('\n').find(line => line.trim()) || 'Draft plan').slice(0, 100),
      summary: 'Your original draft, ready for you to organise into next actions.',
      category: 'Personal', priority: 'medium', cadence: 'Review and choose next steps', target_date: null,
      tasks: [], schedule: { sessions_per_week: 0, duration_minutes: 30, preferred_time: 'any' },
      assumptions: [], notes: intent,
    }],
  };
}

function plainText(text) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/\*\*|__/g, '').trim();
}

// Import authored lists without asking a model to rewrite or discard their details.
// Paragraphs, tables, formulas and links stay intact in each section's notes.
export function parseStructuredPlans(intent) {
  const sections = [];
  let current;
  for (const line of intent.replace(/\r\n/g, '\n').split('\n')) {
    const heading = line.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/)
      || line.match(/^\s*\*\*([^*]+)\*\*\s*$/);
    if (heading) {
      current = { title: plainText(heading[1]), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      // An introduction is part of the source; don't silently drop it.
      current = { title: 'Plan notes', lines: [line] };
      sections.push(current);
    }
  }
  if (sections.length < 2 || sections.length > 32) return null;
  if (!sections.some(section => section.lines.some(line => /^\s*\d+[.)]\s+/.test(line)))) return null;

  const plans = sections.filter(section => section.lines.join('').trim()).map(section => {
    const tasks = [];
    let task;
    for (const line of section.lines) {
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (numbered) {
        task = { title: plainText(numbered[1]) };
        tasks.push(task);
      } else if (task && line.trim()) {
        task.title += `\n${plainText(line)}`;
      }
    }
    const weekly = /weekly|check.in/i.test(section.title);
    return {
      title: section.title,
      summary: tasks.length ? `${tasks.length} actions from your original plan. Dates and amounts are kept as written.` : 'Reference notes from your original plan, kept in full.',
      category: /invest|budget|financ/i.test(section.title) ? 'Finance' : 'Personal',
      priority: /urgent/i.test(section.lines.join('\n')) ? 'high' : 'medium',
      cadence: weekly ? 'Weekly review' : 'Review and choose next steps',
      target_date: null,
      tasks,
      schedule: { sessions_per_week: 0, duration_minutes: 30, preferred_time: 'any' },
      assumptions: [],
      notes: section.lines.join('\n').trim(),
    };
  });
  if (!plans.length || plans.some(plan => plan.tasks.length > 80)) return null;
  return {
    plans,
    source: 'structured_import',
    notice: 'Imported your sections as written. Review dates and budgets before saving. No calendar times have been booked.',
  };
}

export function validPlan(plan) {
  return plan && typeof plan.title === 'string' && plan.title.trim().length > 0
    && typeof plan.summary === 'string' && typeof plan.category === 'string'
    && ['low', 'medium', 'high'].includes(plan.priority) && typeof plan.cadence === 'string'
    && (plan.target_date === null || (typeof plan.target_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(plan.target_date)))
    && Array.isArray(plan.tasks) && plan.tasks.length <= 80
    && plan.tasks.every(task => task && typeof task.title === 'string' && task.title.trim())
    && Array.isArray(plan.assumptions) && plan.assumptions.every(item => typeof item === 'string')
    && plan.schedule && Number.isInteger(plan.schedule.sessions_per_week)
    && plan.schedule.sessions_per_week >= 0 && plan.schedule.sessions_per_week <= 7
    && Number.isInteger(plan.schedule.duration_minutes) && plan.schedule.duration_minutes >= 15 && plan.schedule.duration_minutes <= 240
    && ['morning', 'afternoon', 'evening', 'any'].includes(plan.schedule.preferred_time)
    && (plan.notes === undefined || typeof plan.notes === 'string');
}
