import { describe, expect, test } from "bun:test"
import { banner, chooseSlashName, isHidden, orderRows, sidebarRows, toggle } from "../src/tui/model.ts"
import { codex, prefs, row, snapshot } from "./tui-helpers.ts"

describe("model", () => {
  test("current provider first, server order otherwise", () => {
    const rows = [codex(), row()]
    expect(orderRows(rows, "claude-code").map(r => r.id)).toEqual(["claude-code", "openai"])
    expect(orderRows(rows, undefined).map(r => r.id)).toEqual(["openai", "claude-code"])
    expect(orderRows(rows, "something-else").map(r => r.id)).toEqual(["openai", "claude-code"])
  })

  test("hidden rows leave the sidebar but never the snapshot", () => {
    const snap = snapshot(codex(), row())
    expect(sidebarRows(snap, prefs({ hidden: ["openai"] }), undefined).map(r => r.id)).toEqual(["claude-code"])
    expect(isHidden(prefs({ hidden: ["openai"] }), "openai")).toBe(true)
    expect(snap.rows).toHaveLength(2)
  })

  test("a failing row is never filtered out because of its failure", () => {
    const snap = snapshot(codex({ state: "error", windows: [], completeness: "empty" }), row({ state: "unavailable", windows: [] }))
    expect(sidebarRows(snap, prefs(), undefined)).toHaveLength(2)
  })

  test("banner describes the service, not the provider", () => {
    expect(banner("ok")).toBeUndefined()
    expect(banner("connecting")).toBeUndefined()
    expect(banner("unavailable")).toContain("server plugin")
    expect(banner("incompatible")).toContain("version")
  })

  test("slash name falls back when /quota is taken, including by alias", () => {
    expect(chooseSlashName([])).toBe("quota")
    expect(chooseSlashName([{ slash: { name: "help" } }])).toBe("quota")
    expect(chooseSlashName([{ slash: { name: "quota" } }])).toBe("subscription-quota")
    expect(chooseSlashName([{ slash: { name: "usage", aliases: ["quota"] } }])).toBe("subscription-quota")
  })

  test("toggle is immutable", () => {
    const original = ["a"]
    expect(toggle(original, "b")).toEqual(["a", "b"])
    expect(toggle(original, "a")).toEqual([])
    expect(toggle(undefined, "a")).toEqual(["a"])
    expect(original).toEqual(["a"])
  })
})
