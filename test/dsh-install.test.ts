import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

describe("dsh installer", () => {
  it("uses a distinct native plugin ID alongside an existing MCP entry", () => {
    const home = mkdtempSync(join(tmpdir(), "dsh-install-id-"));
    const profile = join(home, "profiles", "web");
    mkdirSync(profile, { recursive: true });
    writeFileSync(join(profile, "package.json"), "{}");
    writeFileSync(join(profile, "cordis.patch.yml"), "- insert:\n    - id: agentmemory\n      name: '@deepseek-ai/dsh-mcp-client'\n");
    try {
      const result = spawnSync(process.execPath, [resolve("scripts/dsh-install.cjs")], {
        env: { ...process.env, DSH_HOME: home, DSH_PROFILE: "web", AGENTMEMORY_URL: "http://127.0.0.1:1" },
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(join(profile, "cordis.patch.yml"), "utf8")).toContain("id: agentmemory-capture");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("preserves a user's memory skill on repeated installation", () => {
    const home = mkdtempSync(join(tmpdir(), "dsh-install-"));
    const skill = join(home, "skills", "agentmemory-sync", "SKILL.md");
    mkdirSync(join(home, "skills", "agentmemory-sync"), { recursive: true });
    writeFileSync(skill, "User's custom memory rules\n");
    try {
      const result = spawnSync(process.execPath, [resolve("scripts/dsh-install.cjs"), "--no-plugin"], {
        env: { ...process.env, DSH_HOME: home, AGENTMEMORY_URL: "http://127.0.0.1:1" },
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(skill, "utf8")).toBe("User's custom memory rules\n");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
