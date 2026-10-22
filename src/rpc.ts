import { Rpc } from "@opencode/plugin/rpc"
import { z } from "zod"
import { INTEGRATIONS, snapshotSchema } from "./domain.ts"

/** Versioned by id; the snapshot additionally carries its own `version`. */
export const QuotaRpc = Rpc.define({
  id: "opencode-quotabar.v1",
  methods: {
    snapshot: { input: z.object({}), output: snapshotSchema },
    refresh: { input: z.object({ integrationID: z.enum(INTEGRATIONS).optional() }), output: snapshotSchema },
  },
  events: { updated: { schema: snapshotSchema } },
})
