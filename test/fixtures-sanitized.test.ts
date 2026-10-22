import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url))

/** Fixtures may only contain synthetic identities (example.test) and no token-shaped strings. */
const FORBIDDEN: Array<[string, RegExp]> = [
  ["bearer token", /Bearer\s+[A-Za-z0-9._-]{12,}/],
  ["anthropic key", /sk-ant-(?!SECRET-key)[A-Za-z0-9_-]{8,}/],
  ["jwt", /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ["real email", /[\w.+-]+@(?!example\.test)[\w-]+\.[a-z]{2,}/i],
  ["uuid account id", /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i],
]

describe("fixtures", () => {
  for (const file of readdirSync(dir)) {
    test(`${file} is sanitized`, () => {
      const text = readFileSync(`${dir}${file}`, "utf8")
      for (const [name, pattern] of FORBIDDEN) expect({ name, match: pattern.test(text) }).toEqual({ name, match: false })
    })
  }
})
