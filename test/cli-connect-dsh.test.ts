import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeGuideline, guidelineTargets } from "../src/cli/connect/guidelines.js";

describe("writeGuideline for dsh", () => {
  it("writes the memory-usage block into ~/.dsh/AGENTS.md", () => {
    const home = mkdtempSync(join(tmpdir(), "am-dsh-guide-"));
    const prev = process.env.DSH_HOME;
    delete process.env.DSH_HOME; // the host may set it (e.g. running under dsh)
    try {
      expect(Object.keys(guidelineTargets(home))).toContain("dsh");
      const result = writeGuideline("dsh", { cwd: "/tmp", home });
      expect(result.kind).toBe("written");
      expect(result.path).toBe(join(home, ".dsh", "AGENTS.md"));
      expect(existsSync(result.path)).toBe(true);
      expect(readFileSync(result.path, "utf8")).toContain("agentmemory:start");
    } finally {
      if (prev === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = prev;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("honors DSH_HOME when resolving the global guideline path", () => {
    const home = mkdtempSync(join(tmpdir(), "am-dsh-guide2-"));
    const prev = process.env.DSH_HOME;
    process.env.DSH_HOME = join(home, "custom-dsh");
    try {
      const result = writeGuideline("dsh", { cwd: "/tmp", home });
      expect(result.kind).toBe("written");
      expect(result.path).toBe(join(home, "custom-dsh", "AGENTS.md"));
      expect(existsSync(result.path)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = prev;
      rmSync(home, { recursive: true, force: true });
    }
  });
});
