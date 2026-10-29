export type DistrictId =
  | 'command'
  | 'research'
  | 'marketing'
  | 'design'
  | 'finance'
  | 'cost'
  | 'content';

export const VALID_DISTRICTS: readonly DistrictId[] = [
  'command',
  'research',
  'marketing',
  'design',
  'finance',
  'cost',
  'content'
] as const;

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'interrupted'
  | 'done'
  | 'failed'
  | 'retried';

export interface CityTask {
  id: string;
  dept: DistrictId;
  text: string;
  status: TaskStatus;
  progress: number;
  fail?: boolean;
  deliverable?: string;
  err?: string;
  created: number;
  updated?: number;
  agents: string[];
}

export interface CityEvent {
  id: string;
  type: string;
  task?: string;
  department?: DistrictId;
  agent?: string;
  to?: string;
  text?: string;
  state?: string;
  progress?: number;
  deliverable?: string;
  target?: string;
  ts: number;
}

export interface CreateTaskInput {
  district?: string;
  department?: string;
  text?: string;
  fail?: boolean;
}

export interface ServerHealthResponse {
  status: 'ok';
  service: string;
  version: string;
  time: string;
  uptime: number;
  connections: number;
  tasksCount: number;
  eventsCount: number;
}
