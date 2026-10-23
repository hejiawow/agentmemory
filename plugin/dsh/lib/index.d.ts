//#region src/index.d.ts
type AnyListener = (...args: any[]) => unknown;
interface PluginLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}
interface PluginContext {
  on(event: string, listener: AnyListener): void;
  effect(callback: () => void | (() => void | Promise<void>), label?: string): void;
  logger: PluginLogger;
}
interface SessionLike {
  id: string;
  header?: {
    cwd?: string;
  };
}
interface SessionEvent {
  type: string;
  seq?: number;
  data: any;
}
interface AgentmemoryConfig {
  url: string;
  secret: string;
  agentId: string;
  injectInstructions: boolean;
  injectContext: boolean;
  injectMaxChars: number;
  observeToolCalls: boolean;
  compactionBridge: boolean;
  summarizeOnDispose: boolean;
}
interface RestClient {
  post<T>(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<T | null>;
  fire(path: string, body: Record<string, unknown>, timeoutMs?: number): void;
}
declare function makeRestClient(url: string, secret: string, debug?: boolean): RestClient;
declare function resolveProjectName(cwd: string, env?: Record<string, string | undefined>): string;
declare function isAgentmemoryTool(name: string): boolean;
declare function eventTextContent(content: unknown): string;
declare function userMessagePrompt(event: SessionEvent, maxChars: number): string | null;
declare function toolCallObservation(event: SessionEvent, maxChars: number): Record<string, unknown> | null;
declare function compactionSummary(event: SessionEvent, maxChars: number): string | null;
declare const name = "agentmemory";
declare function apply(ctx: PluginContext, rawConfig?: Partial<AgentmemoryConfig>): void;
//#endregion
export { AgentmemoryConfig, PluginContext, RestClient, SessionEvent, SessionLike, apply, compactionSummary, eventTextContent, isAgentmemoryTool, makeRestClient, name, resolveProjectName, toolCallObservation, userMessagePrompt };