import { Plugin } from "@opencode/plugin"
import { createClaudeCollector } from "./collectors/claude/collector.ts"
import { createCodexCollector } from "./collectors/codex.ts"
import { CollectError } from "./diagnostics.ts"
import { hostCodexCredential, hostDiscovery, type HostContext } from "./host.ts"
import { parseOptions } from "./options.ts"
import type { QuotaSnapshot } from "./domain.ts"
import { QuotaRpc } from "./rpc.ts"
import { QuotaService } from "./service.ts"

const TICK_MS = 15_000

interface Registered {
  readonly events: { readonly emit: (name: "updated", data: QuotaSnapshot) => Promise<void> }
  readonly dispose: () => Promise<void>
}

export default Plugin.define({
  id: "opencode-quotabar.server",
  async setup(ctx) {
    const options = parseOptions(ctx.options)
    const host = ctx as unknown as HostContext
    let registration: Registered | undefined

    const service = new QuotaService({
      discovery: hostDiscovery(host),
      ttlMs: options.ttlMs,
      emit: snapshot => void registration?.events.emit("updated", snapshot).catch(() => {}),
      collector(detected) {
        if (!detected.connection) throw new CollectError("not_connected")
        const connectionKey = `${detected.connection.kind}:${detected.connection.id}`
        if (detected.id === "openai") {
          return createCodexCollector({
            connectionKey,
            resolve: hostCodexCredential(host, detected.connection),
            httpTimeoutMs: options.httpTimeoutMs,
            maxOutputBytes: options.maxOutputBytes,
          })
        }
        return createClaudeCollector({
          connectionKey,
          executable: options.claudeExecutable,
          timeoutMs: options.claudeTimeoutMs,
          maxOutputBytes: options.maxOutputBytes,
        })
      },
    })

    registration = (await ctx.rpc.register(QuotaRpc, {
      snapshot: async () => service.snapshot(),
      refresh: async ({ integrationID }) => service.manual(integrationID),
    })) as unknown as Registered

    const timer = setInterval(() => void service.tick().catch(() => {}), TICK_MS)
    const controller = new AbortController()
    void (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        if (event.type === "credential.switched" || event.type === "credential.updated") void service.reconcile().catch(() => {})
      }
    })().catch(() => {})

    return () => {
      clearInterval(timer)
      controller.abort()
      service.dispose()
      void registration?.dispose().catch(() => {})
    }
  },
})
