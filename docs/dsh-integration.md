# AgentMemory for DeepSeek Harness

## Background

dsh (DeepSeek Harness) is a cordis-based agent harness with no long-term memory: session transcripts and compaction summaries stay per-session and are not semantically retrievable. The integration uses AgentMemory's REST lifecycle endpoints (`/session/start`, `/observe`, `/context`, `/session/end`, `/remember`) and MCP server (`@agentmemory/mcp`).

## Architecture (four layers)

| Layer | What | Where |
|---|---|---|
| L1 MCP bridge | `mcp__agentmemory__*` tools via `@deepseek-ai/dsh-mcp-client` (stdio → `@agentmemory/mcp` shim, proxies to the daemon; reduced local fallback when unreachable) | `~/.dsh/profiles/<p>/cordis.patch.yml` entry, written by `agentmemory connect dsh` |
| L2 Behavior guidance | memory-usage guideline injected into every session (`~/.dsh/AGENTS.md`, read by dsh-agent-instructions) + `agentmemory-sync` skill (`~/.dsh/skills/`) | `src/cli/connect/guidelines.ts` + adapter |
| L3 Auto-capture plugin | `@agentmemory/dsh` cordis plugin: session lifecycle → REST | `plugin/dsh/` |
| L4 Deep collaboration | per-agent isolation (`agentId`), compaction bridge, team memory | plugin config / future |

## Event mapping: agentmemory hooks ↔ dsh events

The native plugin maps Harness lifecycle events to the AgentMemory API:

| agentmemory hook (Claude Code) | dsh event | Form |
|---|---|---|
| SessionStart | `session/created` → `POST /agentmemory/session/start` | injecting (await + timeout + fail silent) |
| SessionStart stdout injection | `agent/pre-step` (step 1) middleware → first-step batch fold (idempotent per session) | injecting |
| UserPromptSubmit | `session/event` (`user/message`) → `/observe prompt_submit` | telemetry (fire-and-forget) |
| PreToolUse (matcher) | `session/event` (`tool/call`) → `/observe post_tool_use` (`mcp__agentmemory__*` self-calls filtered) | telemetry |
| Notification | `session/event` (`approval/asked`) → `/observe notification` (allowlisted fields) | telemetry |
| Stop / SessionEnd | `session/disposed` → `POST /agentmemory/session/end` | telemetry (30s, promise-tracked) |
| PreCompact | `session/event` (`compaction/summary`) → `POST /agentmemory/remember` (compaction bridge) | telemetry |

Verified with `@deepseek-ai/dsh@0.2.1-rc.2`: session lifecycle handlers receive a session object; `agent/pre-step(payload, next)` is middleware; `session/event(session, event)` carries `user/message`, `tool/call`, `approval/asked`, and `compaction/summary`. Tool arguments are JSON strings and compaction summaries are content-block arrays. Synthetic user messages are excluded from prompt capture.

## Design contract (same as the official hooks)

- Injecting handlers **await + time out + fail silently**; they never throw into cordis (`signal.aborted` returns the unmodified decision).
- Telemetry handlers are **fire-and-forget** and never block the agent loop; plugin teardown waits for pending requests and completes tracked sessions. Forced termination can still interrupt requests.
- Project resolution (`git rev-parse`) is cached per cwd — no child process per event; per-session `{cwd, project}` captured at `session/created`.
- Zero runtime dependencies: the plugin is a thin REST bridge (Node built-ins only), so dsh `file:` consumers need no build step; `lib/` is committed (repo convention, cf. `plugin/scripts/*.mjs`).

## Install and verify

Follow [the plugin installation guide](../plugin/dsh/README.md) to build and install the local package into the profile you run. The scoped `@agentmemory/dsh` package is not published yet. The MCP bridge supplies tools; the native plugin supplies automatic capture. Avoid enabling the Claude Code hooks bridge alongside the native plugin, which would duplicate capture. Native entries use `id: agentmemory-capture`; rename an older native `id: agentmemory` entry before adding the current MCP adapter. Reinstalling preserves an existing native entry and does not rename it automatically.

Set `AGENTMEMORY_URL` and `AGENTMEMORY_SECRET` before launching Harness. MCP subprocesses scrub secret-like environment variables, so the configuration explicitly forwards the secret using `!!js process.env.AGENTMEMORY_SECRET`. Configuration files contain the variable reference, never the credential.

Start a new session, save a distinctive fact using `mcp__agentmemory__memory_save`, then recall it using `mcp__agentmemory__memory_recall`. Verify session completion and observations through the authenticated API examples in the plugin guide. A successful CLI exit alone does not confirm plugin activation: inspect Harness startup warnings for missing packages.

## Verification

The native plugin was exercised in the real Harness CLI with a local scripted model endpoint and real AgentMemory daemons on iii 0.22 and 0.24.6. Checks covered MCP save/recall, first-step injection, prompt capture, approval events, compaction persistence, and normal process shutdown. Model inference was scripted; the host, Cordis lifecycle, MCP transport, and daemon were real.

Run `npm test`, `npm run typecheck`, and `npm run build` from `plugin/dsh`. The generated package must contain `lib/index.js` and `lib/index.d.ts`; install the packed archive for a final host smoke test.

## Installer

`scripts/dsh-install.cjs` applies L1+L2 and declares the L3 plugin dependency idempotently (`--dry-run` preview, `--no-plugin` for config-only).
