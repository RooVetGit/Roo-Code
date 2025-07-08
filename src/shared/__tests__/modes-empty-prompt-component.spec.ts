import { describe, it, expect } from "vitest"
import { getModeSelection, modes } from "../modes"
import type { PromptComponent } from "@roo-code/types"

describe("getModeSelection with empty promptComponent", () => {
	it("should use built-in mode instructions when promptComponent is undefined", () => {
		const architectMode = modes.find((m) => m.slug === "architect")!

		// Test with undefined promptComponent (which is what getPromptComponent returns for empty objects)
		const result = getModeSelection("architect", undefined, [])

		// Should use built-in mode values
		expect(result.roleDefinition).toBe(architectMode.roleDefinition)
		expect(result.baseInstructions).toBe(architectMode.customInstructions)
		expect(result.baseInstructions).toContain("Do some information gathering")
	})

	it("should use built-in mode instructions when promptComponent is null", () => {
		const debugMode = modes.find((m) => m.slug === "debug")!

		// Test with null promptComponent
		const result = getModeSelection("debug", null as any, [])

		// Should use built-in mode values
		expect(result.roleDefinition).toBe(debugMode.roleDefinition)
		expect(result.baseInstructions).toBe(debugMode.customInstructions)
		expect(result.baseInstructions).toContain("Reflect on 5-7 different possible sources")
	})

	it("should use promptComponent when it has actual content", () => {
		// Test with promptComponent that has actual content
		const validPromptComponent: PromptComponent = {
			roleDefinition: "Custom role",
			customInstructions: "Custom instructions",
		}
		const result = getModeSelection("architect", validPromptComponent, [])

		// Should use promptComponent values
		expect(result.roleDefinition).toBe("Custom role")
		expect(result.baseInstructions).toBe("Custom instructions")
	})

	it("should use promptComponent when it has partial content", () => {
		const architectMode = modes.find((m) => m.slug === "architect")!

		// Test with promptComponent that only has customInstructions
		const partialPromptComponent: PromptComponent = {
			customInstructions: "Only custom instructions",
		}
		const result = getModeSelection("architect", partialPromptComponent, [])

		// Should use promptComponent since it has some content
		expect(result.roleDefinition).toBe("") // No roleDefinition in promptComponent
		expect(result.baseInstructions).toBe("Only custom instructions")
	})
})
