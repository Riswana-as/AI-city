# AI City

A living 3D AI-workforce city (Three.js). Single-file app.

## Run
Open `index.html` in a browser. It needs internet for Three.js (cdnjs r128) and the Sora font.
For a local server: `python3 -m http.server 8000` then visit http://localhost:8000

## Notes
- The orchestrator is a browser-side simulation that emits the real event schema
  (task.created, agent.handoff, task.failed, ...). It produces no AI output.
- Connect a real backend from the console: `AICity.connect("wss://your-server/ws")`
  The server should send JSON events with: type, task, department, agent, to, text, progress.
- Events and tasks persist in localStorage.
- World Mode: Auto follows your local clock, or pick Morning / Day / Evening / Night.
