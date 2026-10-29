import { randomUUID } from 'node:crypto';
import {
  CityEvent,
  CityTask,
  CreateTaskInput,
  DistrictId,
  VALID_DISTRICTS
} from './types.js';

class CityStore {
  private tasks = new Map<string, CityTask>();
  private events: CityEvent[] = [];
  private readonly maxEvents = 300;

  public validateTaskInput(input: CreateTaskInput): {
    valid: boolean;
    errors: string[];
    dept?: DistrictId;
    text?: string;
    fail?: boolean;
  } {
    const errors: string[] = [];
    const rawDept = (input.district || input.department || '').trim().toLowerCase() as DistrictId;
    const rawText = (input.text || '').trim();

    if (!rawDept) {
      errors.push('District is required');
    } else if (!VALID_DISTRICTS.includes(rawDept)) {
      errors.push(`Invalid district "${rawDept}". Must be one of: ${VALID_DISTRICTS.join(', ')}`);
    }

    if (!rawText) {
      errors.push('Task text cannot be empty');
    } else if (rawText.length > 500) {
      errors.push('Task text cannot exceed 500 characters');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      errors: [],
      dept: rawDept,
      text: rawText,
      fail: Boolean(input.fail)
    };
  }

  public createTask(dept: DistrictId, text: string, fail: boolean = false): { task: CityTask; event: CityEvent } {
    const tid = randomUUID();
    const now = Date.now();

    const task: CityTask = {
      id: tid,
      dept,
      text,
      status: 'queued',
      progress: 0,
      fail,
      created: now,
      updated: now,
      agents: []
    };

    const event: CityEvent = {
      id: randomUUID(),
      type: 'task.created',
      task: tid,
      department: dept,
      text,
      ts: now
    };

    this.tasks.set(tid, task);
    this.addEvent(event);

    return { task, event };
  }

  public addEvent(event: CityEvent): CityEvent {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    return event;
  }

  public getTask(id: string): CityTask | undefined {
    return this.tasks.get(id);
  }

  public getTasks(): CityTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.created - a.created);
  }

  public getEvents(limit: number = 70): CityEvent[] {
    return this.events.slice(-limit);
  }

  public updateTask(id: string, updates: Partial<CityTask>): CityTask | undefined {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;
    const updated: CityTask = {
      ...existing,
      ...updates,
      updated: Date.now()
    };
    this.tasks.set(id, updated);
    return updated;
  }

  public getCounts(): { tasksCount: number; eventsCount: number } {
    return {
      tasksCount: this.tasks.size,
      eventsCount: this.events.length
    };
  }
}

export const store = new CityStore();
