# @agentmemory/dsh — agentmemory for DeepSeek Harness

A cordis plugin that connects agentmemory's long-term memory to DeepSeek Harness (dsh). It registers sessions on start, injects recalled context into the first step, captures user messages and tool calls, bridges compaction summaries into the memory store, and summarizes sessions on dispose — mirroring the official agentmemory hooks for Claude Code on dsh's event stream.

| agentmemory hook (Claude Code) | This plugin (dsh event) | Form |
|---|---|---|
| SessionStart | `session/created` → `POST /agentmemory/session/start` | injecting (await + timeout + fail silent) |
| SessionStart stdout injection | `agent/pre-step` (step 1) middleware → first-step batch fold | injecting |
| UserPromptSubmit | `session/event` (`user/message`) → `/observe prompt_submit` | telemetry (fire-and-forget) |
| PreToolUse (matcher) | `session/event` (`tool/call`) → `/observe post_tool_use` (filters `mcp__agentmemory__*` self-calls) | telemetry |
| Notification | `session/event` (`approval/asked`) → `/observe notification` (allowlisted fields) | telemetry |
| Stop / SessionEnd | `session/disposed` → `POST /agentmemory/session/end` | telemetry (30s, tracked) |
| PreCompact | `compaction/summary` → `POST /agentmemory/remember` (compaction bridge) | telemetry |

## Install

Prerequisite: the agentmemory daemon is running (`npx @agentmemory/agentmemory`, REST `http://localhost:3111`).

### 1. MCP bridge (tools, optional but recommended)

Append the `mcp-agentmemory` entry from `install/cordis.patch.yml` to `~/.dsh/profiles/<profile>/cordis.patch.yml` (HMR hot-reloads it — no restart). dsh agents then get `mcp__agentmemory__*` tools.

### 2. Plugin (auto-capture)

The scoped package is not published yet. Install it from a local checkout:

```bash
cd /path/to/agentmemory/plugin/dsh
npm install
npm run build
npm pack
dsh plugin --profile web add /path/to/agentmemory/plugin/dsh/agentmemory-dsh-0.1.0.tgz
```

Replace `web` with the profile you run (for example, `headless`). This integration is verified with `@deepseek-ai/dsh@0.2.1-rc.2`.

Then append to that profile's `cordis.patch.yml` (defaults shown; override as needed):

```yaml
- insert:
    - id: agentmemory-capture
      name: '@agentmemory/dsh'
      config:
        url: !!js process.env.AGENTMEMORY_URL || 'http://localhost:3111'
        secret: !!js process.env.AGENTMEMORY_SECRET || ''
        agentId: dsh                 # per-agent memory isolation
        injectInstructions: true     # inject memory-tool guidance on first turn
        injectContext: true          # inject recalled project context on first turn
        injectMaxChars: 6000         # injection budget (≈2k tokens)
        observeToolCalls: true       # capture tool calls as observations
        compactionBridge: true       # persist compaction summaries as memories
        summarizeOnDispose: true     # LLM summary on session dispose
```

Use the distinct `agentmemory-capture` ID shown above; an existing MCP entry may already use `agentmemory`. Rename an older native entry if it uses that ID. Do not enable the native plugin and the optional Claude Code hooks bridge together, which would capture events twice.

Set `AGENTMEMORY_SECRET` to the daemon's bearer secret before launching dsh. Restart dsh after installing the dependency; adding the package alone does not activate the plugin without the patch entry.

### 3. Behavior guidance (optional)

- Global guidance: `install/AGENTS.md` → `~/.dsh/AGENTS.md` (auto-injected into every session)
- Memory skill: `install/skills/agentmemory-sync/` → `~/.dsh/skills/agentmemory-sync/`

## Verify

1. The first turn of a new session should show injected recalled context/guidance.
2. `curl "${AGENTMEMORY_URL:-http://localhost:3111}/agentmemory/sessions" -H "Authorization: Bearer $AGENTMEMORY_SECRET"` lists the dsh sessions.
3. After ending a session, `curl "${AGENTMEMORY_URL:-http://localhost:3111}/agentmemory/smart-search" -H "Authorization: Bearer $AGENTMEMORY_SECRET" -H 'Content-Type: application/json' -d '{"query":"<what you did>"}'` recalls the new memory.

## Development

```bash
npm run build    # tsdown → lib/index.js (zero runtime dependencies)
npm test         # vitest: REST client, real event shapes, injection, capture and teardown
```

Injecting handlers await bounded requests; telemetry handlers do not block the agent loop. Plugin teardown waits for pending requests and completes tracked sessions; forced termination can interrupt requests. REST failures never throw into Cordis; `AGENTMEMORY_DSH_DEBUG=1` logs network errors.

## Config

| Field | Default | Description |
|---|---|---|
| `url` | `http://localhost:3111` | agentmemory REST base URL |
| `secret` | empty | Daemon bearer secret, supplied through the configuration environment reference |
| `agentId` | `dsh` | memory owner agent; isolation key under `AGENTMEMORY_AGENT_SCOPE=isolated` |
| `injectInstructions` | `true` | inject memory-tool guidance on the first turn |
| `injectContext` | `true` | inject `/context` recalled project context on the first turn |
| `injectMaxChars` | `6000` | total injection budget in characters |
| `observeToolCalls` | `true` | `tool/call` → `post_tool_use` observations |
| `compactionBridge` | `true` | `compaction/summary` → `/remember` |
| `summarizeOnDispose` | `true` | `session/disposed` → `/session/end` (LLM summary) |

## Build artifacts

`lib/index.js` and the generated `lib/index.d.ts` are committed alongside the source. After changing `src/index.ts`, run `npm run build` and commit the new `lib/`.

## Limitations

- Event payload fields follow the running dsh version (`session/created`/`disposed` carry the session object; `agent/pre-step` is middleware; `session/event` stream events are `{type, data}`).
- Current Harness approval events use the session stream. The direct `approval/asked` listener remains for older hosts that supply `sessionId`.
- The plugin only bridges REST; the MCP tools still need step 1's bridge.
