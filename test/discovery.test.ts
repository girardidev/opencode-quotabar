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
    expect(found).toEqual([{ id: "openai", name: "Codex", connectionRequired: true }])
  })

  test("a provider alone (no integration) is detected but has no connection", async () => {
    let asked = 0
    const found = await discover(
      port({
        providers: async () => [{ id: "claude-code", integrationID: null }],
        activeConnection: async () => (asked++, conn("x")),
      }),
    )
    expect(found).toEqual([{ id: "claude-code", name: "Claude", connectionRequired: false }])
    expect(asked).toBe(0)
  })

  test("the anthropic provider enrolls the connection-free Claude row", async () => {
    const found = await discover(
      port({
        integrations: async () => [{ id: "anthropic", name: "Anthropic" }],
        providers: async () => [{ id: "anthropic", integrationID: "anthropic" }],
        activeConnection: async () => undefined,
      }),
    )
    expect(found).toEqual([{ id: "claude-code", name: "Claude", connectionRequired: false }])
  })

  test("an available anthropic integration without a provider in use is not detected", async () => {
    const found = await discover(
      port({
        integrations: async () => [
          { id: "anthropic", name: "Anthropic" },
          { id: "openrouter", name: "OpenRouter" },
        ],
        providers: async () => [{ id: "opencode", integrationID: "opencode" }],
        activeConnection: async id => conn(`cred_${id}`),
      }),
    )
    expect(found).toEqual([])
  })

  test("claude-code and the anthropic provider together yield one row using the claude-code connection", async () => {
    const found = await discover(
      port({
        integrations: async () => [{ id: "claude-code", name: "Claude Code" }],
        providers: async () => [
          { id: "anthropic", integrationID: "anthropic" },
          { id: "claude-code", integrationID: "claude-code" },
        ],
        activeConnection: async id => conn(`cred_${id}`),
      }),
    )
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ id: "claude-code", connectionRequired: false, connection: { id: "cred_claude-code" } })
  })

  test("unrelated providers are not detected", async () => {
    const found = await discover(port({ providers: async () => [{ id: "openrouter", integrationID: "openrouter" }] }))
    expect(found).toEqual([])
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
