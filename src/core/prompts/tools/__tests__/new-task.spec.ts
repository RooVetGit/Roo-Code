import { describe, it, expect } from "vitest"
import { getNewTaskDescription } from "../new-task"
import { ToolArgs } from "../types"

describe("getNewTaskDescription", () => {
	it("should not show todos parameter at all when experiment is disabled", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: {
				newTaskRequireTodos: false,
			},
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is not mentioned at all
		expect(description).not.toContain("todos:")
		expect(description).not.toContain("todo list")
		expect(description).not.toContain("<todos>")
		expect(description).not.toContain("</todos>")

		// Should have a simple example without todos
		expect(description).toContain("Implement a new feature for the application")

		// Should still have mode and message as required
		expect(description).toContain("mode: (required)")
		expect(description).toContain("message: (required)")
	})

	it("should show todos as required when experiment is enabled", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: {
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

	it("should not show todos parameter when experiments is undefined", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: undefined,
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is not shown by default
		expect(description).not.toContain("todos:")
		expect(description).not.toContain("todo list")
		expect(description).not.toContain("<todos>")
		expect(description).not.toContain("</todos>")
	})

	it("should not show todos parameter when newTaskRequireTodos is undefined", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: {},
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is not shown by default
		expect(description).not.toContain("todos:")
		expect(description).not.toContain("todo list")
		expect(description).not.toContain("<todos>")
		expect(description).not.toContain("</todos>")
	})

	it("should only include todos in example when experiment is enabled", () => {
		const argsWithExperimentOff: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: {
				newTaskRequireTodos: false,
			},
		}

		const argsWithExperimentOn: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: {
				newTaskRequireTodos: true,
			},
		}

		const descriptionOff = getNewTaskDescription(argsWithExperimentOff)
		const descriptionOn = getNewTaskDescription(argsWithExperimentOn)

		// When experiment is off, should NOT include todos in example
		const todosPattern = /<todos>\s*\[\s*\]\s*Set up auth middleware/s
		expect(descriptionOff).not.toMatch(todosPattern)
		expect(descriptionOff).not.toContain("<todos>")

		// When experiment is on, should include todos in example
		expect(descriptionOn).toMatch(todosPattern)
		expect(descriptionOn).toContain("<todos>")
	})
})
