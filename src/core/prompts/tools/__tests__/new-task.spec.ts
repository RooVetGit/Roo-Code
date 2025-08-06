import { describe, it, expect } from "vitest"
import { getNewTaskDescription } from "../new-task"
import { ToolArgs } from "../types"

describe("getNewTaskDescription", () => {
	it("should show todos as optional when experiment is disabled", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: {
				newTaskRequireTodos: false,
			},
		}

		const description = getNewTaskDescription(args)

		// Check that todos is marked as optional
		expect(description).toContain("todos: (optional)")
		expect(description).toContain("optional initial todo list")

		// Should not contain any mention of required
		expect(description).not.toContain("todos: (required)")
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
	})

	it("should default to optional when experiments is undefined", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: undefined,
		}

		const description = getNewTaskDescription(args)

		// Check that todos is marked as optional by default
		expect(description).toContain("todos: (optional)")
		expect(description).toContain("optional initial todo list")
	})

	it("should default to optional when newTaskRequireTodos is undefined", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			experiments: {},
		}

		const description = getNewTaskDescription(args)

		// Check that todos is marked as optional by default
		expect(description).toContain("todos: (optional)")
		expect(description).toContain("optional initial todo list")
	})

	it("should always include the example with todos", () => {
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

		// Both should include the example with todos
		const examplePattern = /<todos>\s*\[\s*\]\s*Set up auth middleware/s
		expect(descriptionOff).toMatch(examplePattern)
		expect(descriptionOn).toMatch(examplePattern)
	})
})
