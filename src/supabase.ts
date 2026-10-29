import { createClient, RealtimeChannel } from '@supabase/supabase-js';

export const SUPABASE_URL: string = "";
export const SUPABASE_ANON_KEY: string = "";

export const isSupabaseConfigured = false;

export const supabase = null;

export interface SupabaseSyncState {
  isConfigured: boolean;
  connected: boolean;
  realtimeStatus: string;
  tableTasksReady: boolean;
  tableEventsReady: boolean;
  lastSyncTime: number | null;
  syncedTaskCount: number;
  syncedEventCount: number;
  error: string | null;
}

export const syncState: SupabaseSyncState = {
  isConfigured: isSupabaseConfigured,
  connected: false,
  realtimeStatus: isSupabaseConfigured ? 'connecting' : 'unconfigured',
  tableTasksReady: false,
  tableEventsReady: false,
  lastSyncTime: null,
  syncedTaskCount: 0,
  syncedEventCount: 0,
  error: null
};

export const SCHEMA_SQL = `-- Run this in your Supabase SQL Editor if you want to store tasks & events in Postgres:
create table if not exists public.tasks (
  id text primary key,
  dept text not null,
  text text not null,
  status text not null,
  progress float default 0,
  deliverable text,
  err text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "Allow all operations for anon" on public.tasks for all using (true) with check (true);

create table if not exists public.events (
  id text primary key,
  task_id text,
  dept text,
  agent text,
  type text not null,
  payload jsonb,
  created_at timestamptz default now()
);

alter table public.events enable row level security;
create policy "Allow all operations for anon" on public.events for all using (true) with check (true);
`;

let channel: RealtimeChannel | null = null;

export function initSupabase(
  onRemoteEvent: (event: any) => void,
  onRemoteTaskUpsert: (task: any) => void,
  onStatusChange: (state: SupabaseSyncState) => void
) {
  if (!supabase || !isSupabaseConfigured) {
    syncState.isConfigured = false;
    syncState.connected = false;
    syncState.realtimeStatus = 'unconfigured';
    onStatusChange({ ...syncState });
    return;
  }

  // 1. Setup Realtime Channel
  try {
    channel = supabase.channel('ai-city-realtime');

    channel
      .on('broadcast', { event: 'city_event' }, (payload) => {
        if (payload?.payload) {
          onRemoteEvent(payload.payload);
        }
      })
      .on('broadcast', { event: 'task_sync' }, (payload) => {
        if (payload?.payload) {
          onRemoteTaskUpsert(payload.payload);
        }
      })
      .subscribe((status) => {
        syncState.realtimeStatus = status;
        if (status === 'SUBSCRIBED') {
          syncState.connected = true;
          syncState.error = null;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          syncState.connected = false;
        }
        onStatusChange({ ...syncState });
      });
  } catch (err: any) {
    syncState.error = err?.message || 'Realtime subscription error';
    onStatusChange({ ...syncState });
  }

  // 2. Test Tables and Fetch Remote Tasks
  checkAndSyncTables(onRemoteTaskUpsert, onStatusChange);
}

export async function checkAndSyncTables(
  onRemoteTaskUpsert: (task: any) => void,
  onStatusChange: (state: SupabaseSyncState) => void
) {
  if (!supabase || !isSupabaseConfigured) {
    syncState.isConfigured = false;
    syncState.tableTasksReady = false;
    syncState.tableEventsReady = false;
    onStatusChange({ ...syncState });
    return;
  }

  try {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(20);
    if (!error) {
      syncState.tableTasksReady = true;
      syncState.connected = true;
      if (Array.isArray(data)) {
        data.forEach(t => {
          onRemoteTaskUpsert({
            id: t.id,
            dept: t.dept,
            text: t.text,
            status: t.status,
            progress: t.progress,
            deliverable: t.deliverable,
            err: t.err,
            created: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
            agents: []
          });
        });
      }
    } else {
      syncState.tableTasksReady = false;
    }
  } catch {
    syncState.tableTasksReady = false;
  }

  try {
    const { error } = await supabase.from('events').select('id').limit(1);
    syncState.tableEventsReady = !error;
  } catch {
    syncState.tableEventsReady = false;
  }

  syncState.lastSyncTime = Date.now();
  onStatusChange({ ...syncState });
}

export function broadcastEvent(event: any) {
  if (!supabase || !channel || !syncState.connected) return;
  channel.send({
    type: 'broadcast',
    event: 'city_event',
    payload: event
  }).catch(() => {});

  if (syncState.tableEventsReady) {
    supabase.from('events').insert({
      id: event.id,
      task_id: event.task,
      dept: event.department,
      agent: event.agent,
      type: event.type,
      payload: event,
      created_at: new Date(event.ts || Date.now()).toISOString()
    }).then(({ error }) => {
      if (!error) syncState.syncedEventCount++;
    });
  }
}

export function broadcastTask(task: any) {
  if (!supabase || !channel || !syncState.connected) return;
  channel.send({
    type: 'broadcast',
    event: 'task_sync',
    payload: task
  }).catch(() => {});

  if (syncState.tableTasksReady) {
    supabase.from('tasks').upsert({
      id: task.id,
      dept: task.dept,
      text: task.text,
      status: task.status,
      progress: task.progress || 0,
      deliverable: task.deliverable || null,
      err: task.err || null,
      created_at: new Date(task.created || Date.now()).toISOString(),
      updated_at: new Date().toISOString()
    }).then(({ error }) => {
      if (!error) syncState.syncedTaskCount++;
    });
  }
}


