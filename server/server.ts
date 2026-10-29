import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response, NextFunction } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { store } from './store.js';
import { ServerHealthResponse } from './types.js';
import { AGENT_CATALOG, getAgentById } from './agents.js';
import { executeDepartmentTask, chatWithAgent } from './orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// 1. Core HTTP Middlewares
app.use(express.json());

// CORS & Security headers for local/dev proxy
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// 2. WebSocket Server on /ws
const wss = new WebSocketServer({ server, path: '/ws' });

interface CityClientWs extends WebSocket {
  id?: string;
  isAlive?: boolean;
}

export function broadcast(payload: unknown) {
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws: CityClientWs, req) => {
  const clientId = randomUUID();
  ws.id = clientId;
  ws.isAlive = true;

  // Connection Handshake
  const handshake = {
    type: 'connection',
    event: 'welcome',
    clientId,
    serverTime: Date.now(),
    message: 'Connected to AI City WebSocket Server',
    counts: store.getCounts()
  };
  ws.send(JSON.stringify(handshake));

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
      }
    } catch {
      // Ignore unparseable raw messages
    }
  });

  ws.on('close', () => {
    ws.isAlive = false;
  });
});

// Heartbeat interval to prune dead connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client: CityClientWs) => {
    if (client.isAlive === false) {
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, 30000);
heartbeatInterval.unref();

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// 3. API Routes

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  const counts = store.getCounts();
  const response: ServerHealthResponse = {
    status: 'ok',
    service: 'ai-city-backend',
    version: '1.0.0',
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    connections: wss.clients.size,
    tasksCount: counts.tasksCount,
    eventsCount: counts.eventsCount
  };
  res.json(response);
});

// Get all tasks
app.get('/api/tasks', (_req: Request, res: Response) => {
  res.json({
    tasks: store.getTasks()
  });
});

// Get single task by ID
app.get('/api/tasks/:id', (req: Request, res: Response) => {
  const task = store.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const events = store.getEvents(100).filter(e => e.task === task.id);
  return res.json({ task, events });
});

// Get catalog of all 42 agents
app.get('/api/agents', (_req: Request, res: Response) => {
  res.json({
    total: AGENT_CATALOG.length,
    agents: AGENT_CATALOG
  });
});

// Get specific agent by ID
app.get('/api/agents/:id', (req: Request, res: Response) => {
  const agent = getAgentById(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  return res.json({ agent });
});

// Direct conversational chat with any AI agent ("like ChatGPT")
app.post('/api/chat', async (req: Request, res: Response) => {
  const { agentId, message, history } = req.body || {};
  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message string is required' });
  }

  try {
    const result = await chatWithAgent(agentId, message, history || []);
    return res.json({
      success: true,
      agentId,
      agentName: result.agent.name,
      agentRole: result.agent.role,
      district: result.agent.deptName,
      reply: result.reply
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Chat completion failed'
    });
  }
});

// Submit a new task
app.post('/api/tasks', (req: Request, res: Response) => {
  const validation = store.validateTaskInput(req.body || {});
  if (!validation.valid || !validation.dept || !validation.text) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.errors
    });
  }

  // Create authoritative task and task.created event
  const { task, event } = store.createTask(
    validation.dept,
    validation.text,
    validation.fail ?? false
  );

  // Broadcast event to all connected WebSocket clients
  broadcast(event);

  // Trigger real multi-agent Gemini orchestration pipeline asynchronously
  executeDepartmentTask(
    task.id,
    task.dept,
    task.text,
    task.fail ?? false,
    broadcast
  ).catch((err) => {
    console.error(`[AI City Server] Orchestrator background failure on ${task.id}:`, err);
  });

  return res.status(201).json({
    success: true,
    task,
    event
  });
});

// 4. Vite Dev Integration or Production Static Serving
async function startServer() {
  if (!isProduction) {
    // Dynamic import of Vite in development to avoid bundling issues
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: PORT,
        host: HOST
      },
      appType: 'spa',
      root: rootDir
    });

    // Mount Vite middleware for serving frontend files and HMR
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`[AI City Backend] Server listening on http://${HOST}:${PORT}`);
    console.log(`[AI City Backend] WebSocket ready at ws://${HOST}:${PORT}/ws`);
    console.log(`[AI City Backend] Environment: ${isProduction ? 'production' : 'development'}`);
  });
}

// Start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[AI City Backend] Failed to start server:', err);
    process.exit(1);
  });
}

export { app, server, wss, startServer };
