---
name: agentmemory-sync
description: Sync with the agentmemory long-term memory at task start/end. Use when starting a new task, recalling past work, finishing a task, needing cross-session context, or reviewing what was done.
---
# agentmemory memory sync

1. At task start: call mcp__agentmemory__memory_recall with the task keywords and the stable project identifier used by the session, format=compact, to bring relevant history into context.
2. During the task: when you learn something durable (decision/fix/preference/convention), call mcp__agentmemory__memory_save immediately (type=fact, concepts: 2-5 keywords).
3. At task end: call mcp__agentmemory__memory_save with a short outcome summary (type=fact), and confirm the session is registered via mcp__agentmemory__memory_sessions.
4. For large handoffs: call mcp__agentmemory__memory_smart_search with expandIds to recover full results, or use mcp__agentmemory__memory_lesson_save/mcp__agentmemory__memory_lesson_recall for lessons.
