import { getCommandDecisionAlternate } from "../command-validation"

describe("getCommandDecisionAlternate", () => {
	const allowedCommands = ["npm install", "echo"]
	const deniedCommands = ["rm", "sudo"]

	it("should deny a command on the denylist", () => {
		const decision = getCommandDecisionAlternate("rm -rf /", allowedCommands, deniedCommands)
		expect(decision).toBe("auto_deny")
	})

	it("should deny a command on the allowlist", () => {
		const decision = getCommandDecisionAlternate("npm install", allowedCommands, deniedCommands)
		expect(decision).toBe("auto_deny")
	})

	it("should approve a command not on any list", () => {
		const decision = getCommandDecisionAlternate("git status", allowedCommands, deniedCommands)
		expect(decision).toBe("auto_approve")
	})

	it("should deny a command chain if one sub-command is on the denylist", () => {
		const decision = getCommandDecisionAlternate("git status && rm -rf /", allowedCommands, deniedCommands)
		expect(decision).toBe("auto_deny")
	})

	it("should deny a command chain if one sub-command is on the allowlist", () => {
		const decision = getCommandDecisionAlternate("git status && npm install", allowedCommands, deniedCommands)
		expect(decision).toBe("auto_deny")
	})

	it("should approve a command chain if no sub-commands are on any list", () => {
		const decision = getCommandDecisionAlternate("git status && git commit", allowedCommands, deniedCommands)
		expect(decision).toBe("auto_approve")
	})

	it("should approve an empty command", () => {
		const decision = getCommandDecisionAlternate("", allowedCommands, deniedCommands)
		expect(decision).toBe("auto_approve")
	})

	it("should approve a command if both lists are empty", () => {
		const decision = getCommandDecisionAlternate("any command", [], [])
		expect(decision).toBe("auto_approve")
	})

	it("should handle undefined denylist", () => {
		const decision = getCommandDecisionAlternate("npm install", allowedCommands, undefined)
		expect(decision).toBe("auto_deny")
	})

	it("should handle undefined allowlist", () => {
		const decision = getCommandDecisionAlternate("rm -rf /", [], deniedCommands)
		expect(decision).toBe("auto_deny")
	})
})
