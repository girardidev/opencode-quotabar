import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const src = fileURLToPath(new URL("../src/", import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const read = (path: string) => readFileSync(path, "utf8")

describe("boundaries", () => {
  test("the TUI half never spawns processes, reads files or the environment", () => {
    for (const file of files(join(src, "tui"))) {
      const text = read(file)
      expect({ file, hit: /node:child_process|node:fs|node:os|process\.env|Bun\.spawn|fetch\(/.test(text) }).toEqual({ file, hit: false })
    }
  })

  test("nothing reads CLI or OS credential stores", () => {
    const forbidden = /\.claude\/\.credentials|\.credentials\.json|Claude Code-credentials|find-generic-password|keychain|security\s+find|\.ssh|auth\.json/i
    for (const file of files(src)) expect({ file, hit: forbidden.test(read(file)) }).toEqual({ file, hit: false })
  })

  test("the collector never writes a user message or falls back to a model prompt", () => {
    const text = read(join(src, "collectors/claude/transport.ts"))
    expect(text).not.toMatch(/type:\s*["']user["']/)
    expect(text).not.toMatch(/subtype:\s*["'](?!initialize|get_usage)/)
    expect([...text.matchAll(/request\("([a-z_]+)"/g)].map(m => m[1])).toEqual(["initialize", "get_usage", "initialize"])
  })

  test("the process is launched without a shell and polling never uses the model", () => {
    const text = read(join(src, "collectors/claude/transport.ts"))
    expect(text).toContain("shell: false")
    expect(text).not.toMatch(/--bare|--print-prompt|\/usage/)
  })

  test("logging is absent from runtime code so diagnostics cannot leak", () => {
    for (const file of files(src)) expect({ file, hit: /console\.(log|info|warn|error|debug)/.test(read(file)) }).toEqual({ file, hit: false })
  })
})
