import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import express from 'express';
import { app, server, wss, broadcast } from '../server/server.js';
import { store } from '../server/store.js';

let TEST_PORT = 3199;

describe('AI City Backend Test Suite', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          TEST_PORT = addr.port;
        }
        resolve();
      });
    });
  });

  after(async () => {
    for (const client of wss.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve) => {
      wss.close(() => {
        server.close(() => {
          resolve();
        });
      });
    });
  });

  test('GET /api/health returns 200 and healthy server metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'ai-city-backend');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(typeof body.connections, 'number');
    assert.equal(typeof body.tasksCount, 'number');
  });

  test('POST /api/tasks rejects invalid district with 400', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        district: 'non-existent-zone',
        text: 'Test task prompt'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Validation failed');
    assert.ok(Array.isArray(body.details));
    assert.ok(body.details.some((d: string) => d.includes('Invalid district')));
  });

  test('POST /api/tasks rejects empty text with 400', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        district: 'research',
        text: '   '
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Validation failed');
    assert.ok(body.details.some((d: string) => d.includes('cannot be empty')));
  });

  test('POST /api/tasks accepts valid task, assigns UUID, and returns 201', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        district: 'command',
        text: 'Synchronize district operations',
        fail: false
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.task);
    assert.ok(body.task.id);
    assert.equal(body.task.dept, 'command');
    assert.equal(body.task.status, 'queued');
    assert.equal(body.task.progress, 0);

    assert.ok(body.event);
    assert.equal(body.event.type, 'task.created');
    assert.equal(body.event.task, body.task.id);
  });

  test('WebSocket connection receives welcome handshake and broadcasts task.created', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`);

    // 1. Verify handshake
    const welcomePromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Handshake timed out')), 3000);
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'connection' && msg.event === 'welcome') {
          clearTimeout(timeout);
          resolve(msg);
        }
      });
    });

    const welcomeMsg = await welcomePromise;
    assert.equal(welcomeMsg.type, 'connection');
    assert.ok(welcomeMsg.clientId);

    // 2. Ping-pong test
    const pongPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Pong timed out')), 3000);
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'pong') {
          clearTimeout(timeout);
          resolve(msg);
        }
      });
      ws.send(JSON.stringify({ type: 'ping' }));
    });

    const pongMsg = await pongPromise;
    assert.equal(pongMsg.type, 'pong');
    assert.ok(pongMsg.serverTime);

    // 3. Task broadcast test: when a task is posted, client receives task.created event
    const broadcastPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Broadcast timed out')), 3000);
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'task.created') {
          clearTimeout(timeout);
          resolve(msg);
        }
      });
    });

    await fetch(`http://127.0.0.1:${TEST_PORT}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        district: 'finance',
        text: 'Audit operational expenditure'
      })
    });

    const broadcastMsg = await broadcastPromise;
    assert.equal(broadcastMsg.type, 'task.created');
    assert.equal(broadcastMsg.department, 'finance');
    assert.equal(broadcastMsg.text, 'Audit operational expenditure');

    ws.close();
  });

  test('GET /api/agents returns 42 registered AI agents across 7 districts', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/agents`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.total, 42);
    assert.equal(body.agents.length, 42);
    assert.ok(body.agents.some((a: any) => a.id === 'research-0' && a.role === 'Research manager'));
    assert.ok(body.agents.some((a: any) => a.id === 'finance-1' && a.role === 'Financial analyst'));
  });

  test('POST /api/chat responds in character for agent', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'research-2',
        message: 'What data benchmarks should we track for electric bikes?'
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.agentId, 'research-2');
    assert.equal(body.agentRole, 'Data analyst');
    assert.ok(typeof body.reply === 'string');
    assert.ok(body.reply.length > 20);
  });
});
