import { describe, expect, test } from "bun:test"
import { detailsCommands } from "../src/tui/keys.ts"

function api(ids: string[], selected?: string) {
  const calls: string[] = []
  let current = selected
  const commands = detailsCommands({
    ids: () => ids,
    selected: () => current,
    select: id => ((current = id), void calls.push(`select:${id}`)),
    refresh: id => void calls.push(`refresh:${id ?? "all"}`),
    toggleHidden: id => void calls.push(`hide:${id}`),
    close: () => void calls.push("close"),
  })
  const press = (key: string) => commands.filter(c => c.bind === key).forEach(c => c.run())
  return { calls, press, commands }
}

describe("details keyboard", () => {
  test("every action is reachable from the keyboard", () => {
    const { commands } = api(["a", "b"])
    expect(commands.map(c => c.bind)).toEqual(["escape", "down", "j", "up", "k", "return", "r", "h"])
  })

  test("navigation wraps in both directions", () => {
    const { press, calls } = api(["a", "b", "c"], "a")
    press("down")
    press("j")
    press("down")
    press("up")
    press("k")
    expect(calls).toEqual(["select:b", "select:c", "select:a", "select:c", "select:b"])
  })

  test("enter refreshes the selection, r refreshes everything, h toggles visibility", () => {
    const { press, calls } = api(["a", "b"], "b")
    press("return")
    press("r")
    press("h")
    press("escape")
    expect(calls).toEqual(["refresh:b", "refresh:all", "hide:b", "close"])
  })

  test("no rows is a no-op for selection actions", () => {
    const { press, calls } = api([])
    press("down")
    press("return")
    press("h")
    expect(calls).toEqual([])
  })
})
