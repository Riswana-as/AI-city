import { CityTask, CityEvent } from './types.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * Persists a task to Supabase Postgres (public.tasks) if table exists
 */
export async function persistTaskToSupabase(task: CityTask): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;

  try {
    const payload = {
      id: task.id,
      dept: task.dept,
      text: task.text,
      status: task.status,
      progress: task.progress,
      deliverable: task.deliverable || null,
      err: task.err || null,
      updated_at: new Date().toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    return res.ok;
  } catch (err) {
    // Non-blocking: local in-memory store remains primary
    return false;
  }
}

/**
 * Persists an event to Supabase Postgres (public.events) if table exists
 */
export async function persistEventToSupabase(event: CityEvent): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;

  try {
    const payload = {
      id: event.id,
      task_id: event.task || null,
      dept: event.department || null,
      agent: event.agent || null,
      type: event.type,
      payload: event,
      created_at: new Date(event.ts).toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    return res.ok;
  } catch (err) {
    return false;
  }
}
