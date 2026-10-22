import { describe, expect, test } from "bun:test"
import { connectionKey, discover, type DiscoveryPort } from "../src/discovery.ts"
import { conn } from "./service-harness.ts"

const port = (over: Partial<DiscoveryPort> = {}): DiscoveryPort => ({
  integrations: async () => [],
  providers: async () => [],
  activeConnection: async () => undefined,
  ...over,
})

describe("discover", () => {
  test("detects openai and claude-code by explicit identifiers only", async () => {
    const found = await discover(
      port({
        integrations: async () => [
          { id: "openai", name: "OpenAI" },
          { id: "claude-code", name: "Claude Code" },
          { id: "anthropic", name: "Anthropic" },
          { id: "openrouter", name: "OpenRouter" },
        ],
        activeConnection: async id => conn(`cred_${id}`),
      }),
    )
    expect(found.map(f => f.id)).toEqual(["openai", "claude-code"])
    expect(found.every(f => f.connection)).toBe(true)
  })

  test("keeps a detected integration even without a connection", async () => {
    const found = await discover(port({ integrations: async () => [{ id: "openai", name: "OpenAI" }] }))
    expect(found).toEqual([{ id: "openai", name: "Codex" }])
  })

  test("a provider alone (no integration) is detected but has no connection", async () => {
    let asked = 0
    const found = await discover(
      port({
        providers: async () => [{ id: "claude-code", integrationID: null }],
        activeConnection: async () => (asked++, conn("x")),
      }),
    )
    expect(found).toEqual([{ id: "claude-code", name: "Claude" }])
    expect(asked).toBe(0)
  })

  test("display names do not decide identity", async () => {
    const found = await discover(port({ integrations: async () => [{ id: "my-claude", name: "Claude Code" }], providers: async () => [{ id: "x", integrationID: "my-claude" }] }))
    expect(found).toEqual([])
  })

  test("connectionKey distinguishes accounts and methods", () => {
    expect(connectionKey(undefined)).toBeUndefined()
    expect(connectionKey(conn("a"))).not.toBe(connectionKey(conn("b")))
    expect(connectionKey(conn("a", "oauth"))).not.toBe(connectionKey(conn("a", "key")))
  })
})
