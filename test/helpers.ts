import { mkdtempSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { TransportOptions } from "../src/collectors/claude/transport.ts"
import type { Clock } from "../src/options.ts"

export const FAKE_CLAUDE = fileURLToPath(new URL("./fixtures/fake-claude.ts", import.meta.url))

export interface FakeRun {
  options: TransportOptions
  log: string
  pidFile: string
  records(): Array<Record<string, any>>
  pid(): number | undefined
}

export function fakeRun(scenario: string, overrides: Partial<TransportOptions> = {}, extraEnv: NodeJS.ProcessEnv = {}): FakeRun {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-test-"))
  const log = join(dir, "log.jsonl")
  const pidFile = join(dir, "pid")
  const controller = new AbortController()
  return {
    log,
    pidFile,
    options: {
      executable: FAKE_CLAUDE,
      timeoutMs: 10_000,
      maxOutputBytes: 1_048_576,
      signal: controller.signal,
      graceMs: 200,
      env: { ...process.env, FAKE_CLAUDE_SCENARIO: scenario, FAKE_CLAUDE_LOG: log, FAKE_CLAUDE_PID: pidFile, ...extraEnv },
      ...overrides,
    },
    records: () =>
      existsSync(log)
        ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
        : [],
    pid: () => (existsSync(pidFile) ? Number(readFileSync(pidFile, "utf8")) : undefined),
  }
}

export function alive(pid: number | undefined): boolean {
  if (pid === undefined) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Manually advanced clock for deterministic scheduling tests. */
export class TestClock implements Clock {
  constructor(
    public time = 1_800_000_000_000,
    public randomValue = 0.5,
  ) {}
  now() {
    return this.time
  }
  random() {
    return this.randomValue
  }
  advance(ms: number) {
    this.time += ms
  }
}

export const SECRETS = ["sk-ant-SECRET-key", "oauth-ACCESS-secret", "person@example.test", "acct-PRIVATE-id"]
