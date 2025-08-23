import { describe, it, expect } from "vitest"
import { getNewTaskDescription } from "../new-task"
import { ToolArgs } from "../types"

describe("getNewTaskDescription", () => {
	it("should show todos parameter as optional when setting is disabled", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: false,
			},
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is shown as optional
		expect(description).toContain("todos: (optional)")
		expect(description).toContain("The initial todo list in markdown checklist format")

		// Should have a simple example without todos in the main example
		expect(description).toContain("Implement a new feature for the application")

		// Should also have an example with optional todos
		expect(description).toContain("Example with optional todos:")

		// Should still have mode and message as required
		expect(description).toContain("mode: (required)")
		expect(description).toContain("message: (required)")
	})

	it("should show todos as required when setting is enabled", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: true,
			},
		}

		const description = getNewTaskDescription(args)

		// Check that todos is marked as required
		expect(description).toContain("todos: (required)")
		expect(description).toContain("and initial todo list")

		// Should not contain any mention of optional for todos
		expect(description).not.toContain("todos: (optional)")
		expect(description).not.toContain("optional initial todo list")

		// Should include todos in the example
		expect(description).toContain("<todos>")
		expect(description).toContain("</todos>")
		expect(description).toContain("Set up auth middleware")
	})

	it("should show todos parameter as optional when settings is undefined", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: undefined,
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is shown as optional by default
		expect(description).toContain("todos: (optional)")
		expect(description).toContain("The initial todo list in markdown checklist format")
	})

	it("should show todos parameter as optional when newTaskRequireTodos is undefined", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {},
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is shown as optional by default
		expect(description).toContain("todos: (optional)")
		expect(description).toContain("The initial todo list in markdown checklist format")
	})

	it("should include todos in main example only when setting is enabled", () => {
		const argsWithSettingOff: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: false,
			},
		}

		const argsWithSettingOn: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: true,
			},
		}

		const descriptionOff = getNewTaskDescription(argsWithSettingOff)
		const descriptionOn = getNewTaskDescription(argsWithSettingOn)

		// When setting is on, should include todos in main example
		expect(descriptionOn).toContain("Implement user authentication")
		expect(descriptionOn).toContain("[ ] Set up auth middleware")

		// When setting is on, should NOT have "Example with optional todos" section
		expect(descriptionOn).not.toContain("Example with optional todos:")

		// When setting is off, main example should NOT include todos in Usage section
		const usagePattern = /<new_task>\s*<mode>.*<\/mode>\s*<message>.*<\/message>\s*<\/new_task>/s
		expect(descriptionOff).toMatch(usagePattern)

		// When setting is off, should have separate "Example with optional todos" section
		expect(descriptionOff).toContain("Example with optional todos:")
		expect(descriptionOff).toContain("[ ] Set up auth middleware")
	})
})
