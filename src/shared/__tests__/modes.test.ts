import { describe, it, expect } from "vitest"
import { getAllModesInfo } from "../modes"
import { ModeConfig } from "@roo-code/types"

describe("getAllModesInfo", () => {
	it("should return slug and name for all built-in modes", () => {
		const modesInfo = getAllModesInfo()

		// Should have multiple modes
		expect(modesInfo.length).toBeGreaterThan(0)

		// Each mode should have slug and name
		modesInfo.forEach((mode) => {
			expect(mode).toHaveProperty("slug")
			expect(mode).toHaveProperty("name")
			expect(typeof mode.slug).toBe("string")
			expect(typeof mode.name).toBe("string")
			expect(mode.slug).toBeTruthy()
			expect(mode.name).toBeTruthy()
		})

		// Check that we have some expected built-in modes
		const slugs = modesInfo.map((m) => m.slug)
		expect(slugs).toContain("code")
		expect(slugs).toContain("architect")
		expect(slugs).toContain("ask")
	})

	it("should include custom modes when provided", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "custom-test",
				name: "Custom Test Mode",
				roleDefinition: "Test role",
				groups: ["read"],
			},
		]

		const modesInfo = getAllModesInfo(customModes)

		// Should include the custom mode
		const customMode = modesInfo.find((m) => m.slug === "custom-test")
		expect(customMode).toBeDefined()
		expect(customMode?.name).toBe("Custom Test Mode")
	})

	it("should override built-in modes with custom modes of the same slug", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "code",
				name: "Custom Code Mode",
				roleDefinition: "Custom role",
				groups: ["read"],
			},
		]

		const modesInfo = getAllModesInfo(customModes)

		// Should have the custom mode name for the code slug
		const codeMode = modesInfo.find((m) => m.slug === "code")
		expect(codeMode).toBeDefined()
		expect(codeMode?.name).toBe("Custom Code Mode")

		// Should not have duplicate entries
		const codeModes = modesInfo.filter((m) => m.slug === "code")
		expect(codeModes.length).toBe(1)
	})
})
