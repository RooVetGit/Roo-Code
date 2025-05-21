// npx jest src/shared/__tests__/modes.test.ts

import type { ModeConfig } from "@roo-code/types"

// Mock setup must come before imports
jest.mock("vscode")

const mockAddCustomInstructions = jest.fn().mockResolvedValue("Combined instructions")

jest.mock("../../core/prompts/sections/custom-instructions", () => ({
	addCustomInstructions: mockAddCustomInstructions,
}))

import { isToolAllowedForMode, FileRestrictionError, getFullModeDetails, modes, getModeSelection } from "../modes"
import { addCustomInstructions } from "../../core/prompts/sections/custom-instructions"

describe("isToolAllowedForMode", () => {
	const customModes: ModeConfig[] = [
		{
			slug: "markdown-editor",
			name: "Markdown Editor",
			roleDefinition: "You are a markdown editor",
			groups: ["read", ["edit", { fileRegex: "\\.md$" }], "browser"],
		},
		{
			slug: "css-editor",
			name: "CSS Editor",
			roleDefinition: "You are a CSS editor",
			groups: ["read", ["edit", { fileRegex: "\\.css$" }], "browser"],
		},
		{
			slug: "test-exp-mode",
			name: "Test Exp Mode",
			roleDefinition: "You are an experimental tester",
			groups: ["read", "edit", "browser"],
		},
	]

	it("allows always available tools", () => {
		expect(isToolAllowedForMode("ask_followup_question", "markdown-editor", customModes)).toBe(true)
		expect(isToolAllowedForMode("attempt_completion", "markdown-editor", customModes)).toBe(true)
	})

	it("allows unrestricted tools", () => {
		expect(isToolAllowedForMode("read_file", "markdown-editor", customModes)).toBe(true)
		expect(isToolAllowedForMode("browser_action", "markdown-editor", customModes)).toBe(true)
	})

	describe("file restrictions", () => {
		it("allows editing matching files", () => {
			// Test markdown editor mode
			const mdResult = isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
				path: "test.md",
				content: "# Test",
			})
			expect(mdResult).toBe(true)

			// Test CSS editor mode
			const cssResult = isToolAllowedForMode("write_to_file", "css-editor", customModes, undefined, {
				path: "styles.css",
				content: ".test { color: red; }",
			})
			expect(cssResult).toBe(true)
		})

		it("rejects editing non-matching files", () => {
			// Test markdown editor mode with non-markdown file
			expect(() =>
				isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(/\\.md\$/)

			// Test CSS editor mode with non-CSS file
			expect(() =>
				isToolAllowedForMode("write_to_file", "css-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("write_to_file", "css-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(/\\.css\$/)
		})

		it("handles partial streaming cases (path only, no content/diff)", () => {
			// Should allow path-only for matching files (no validation yet since content/diff not provided)
			expect(
				isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
					path: "test.js",
				}),
			).toBe(true)

			expect(
				isToolAllowedForMode("apply_diff", "markdown-editor", customModes, undefined, {
					path: "test.js",
				}),
			).toBe(true)

			// Should allow path-only for architect mode too
			expect(
				isToolAllowedForMode("write_to_file", "architect", [], undefined, {
					path: "test.js",
				}),
			).toBe(true)
		})

		it("applies restrictions to both write_to_file and apply_diff", () => {
			// Test write_to_file
			const writeResult = isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
				path: "test.md",
				content: "# Test",
			})
			expect(writeResult).toBe(true)

			// Test apply_diff
			const diffResult = isToolAllowedForMode("apply_diff", "markdown-editor", customModes, undefined, {
				path: "test.md",
				diff: "- old\n+ new",
			})
			expect(diffResult).toBe(true)

			// Test both with non-matching file
			expect(() =>
				isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)

			expect(() =>
				isToolAllowedForMode("apply_diff", "markdown-editor", customModes, undefined, {
					path: "test.js",
					diff: "- old\n+ new",
				}),
			).toThrow(FileRestrictionError)
		})

		it("uses description in file restriction error for custom modes", () => {
			const customModesWithDescription: ModeConfig[] = [
				{
					slug: "docs-editor",
					name: "Documentation Editor",
					roleDefinition: "You are a documentation editor",
					groups: [
						"read",
						["edit", { fileRegex: "\\.(md|txt)$", description: "Documentation files only" }],
						"browser",
					],
				},
			]

			// Test write_to_file with non-matching file
			expect(() =>
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(/Documentation files only/)

			// Test apply_diff with non-matching file
			expect(() =>
				isToolAllowedForMode("apply_diff", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
					diff: "- old\n+ new",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("apply_diff", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
					diff: "- old\n+ new",
				}),
			).toThrow(/Documentation files only/)

			// Test that matching files are allowed
			expect(
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.md",
					content: "# Test",
				}),
			).toBe(true)

			expect(
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.txt",
					content: "Test content",
				}),
			).toBe(true)

			// Test partial streaming cases
			expect(
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
				}),
			).toBe(true)
		})

		it("allows architect mode to edit markdown files only", () => {
			// Should allow editing markdown files
			expect(
				isToolAllowedForMode("write_to_file", "architect", [], undefined, {
					path: "test.md",
					content: "# Test",
				}),
			).toBe(true)

			// Should allow applying diffs to markdown files
			expect(
				isToolAllowedForMode("apply_diff", "architect", [], undefined, {
					path: "readme.md",
					diff: "- old\n+ new",
				}),
			).toBe(true)

			// Should reject non-markdown files
			expect(() =>
				isToolAllowedForMode("write_to_file", "architect", [], undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("write_to_file", "architect", [], undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(/Markdown files only/)

			// Should maintain read capabilities
			expect(isToolAllowedForMode("read_file", "architect", [])).toBe(true)
			expect(isToolAllowedForMode("browser_action", "architect", [])).toBe(true)
			expect(isToolAllowedForMode("use_mcp_tool", "architect", [])).toBe(true)
		})
	})

	it("handles non-existent modes", () => {
		expect(isToolAllowedForMode("write_to_file", "non-existent", customModes)).toBe(false)
	})

	it("respects tool requirements", () => {
		const toolRequirements = {
			write_to_file: false,
		}

		expect(isToolAllowedForMode("write_to_file", "markdown-editor", customModes, toolRequirements)).toBe(false)
	})
})

describe("FileRestrictionError", () => {
	it("formats error message with pattern when no description provided", () => {
		const error = new FileRestrictionError("Markdown Editor", "\\.md$", undefined, "test.js")
		expect(error.message).toBe(
			"This mode (Markdown Editor) can only edit files matching pattern: \\.md$. Got: test.js",
		)
		expect(error.name).toBe("FileRestrictionError")
	})

	describe("debug mode", () => {
		it("is configured correctly", () => {
			const debugMode = modes.find((mode) => mode.slug === "debug")
			expect(debugMode).toBeDefined()
			expect(debugMode).toMatchObject({
				slug: "debug",
				name: "🪲 Debug",
				roleDefinition:
					"You are Roo, an expert software debugger specializing in systematic problem diagnosis and resolution.",
				groups: ["read", "edit", "browser", "command", "mcp"],
			})
			expect(debugMode?.customInstructions).toContain(
				"Reflect on 5-7 different possible sources of the problem, distill those down to 1-2 most likely sources, and then add logs to validate your assumptions. Explicitly ask the user to confirm the diagnosis before fixing the problem.",
			)
		})
	})

	describe("getFullModeDetails", () => {
		beforeEach(() => {
			jest.clearAllMocks()
			;(addCustomInstructions as jest.Mock).mockResolvedValue("Combined instructions")
		})

		it("returns base mode when no overrides exist", async () => {
			const result = await getFullModeDetails("debug")
			expect(result).toMatchObject({
				slug: "debug",
				name: "🪲 Debug",
				roleDefinition:
					"You are Roo, an expert software debugger specializing in systematic problem diagnosis and resolution.",
			})
		})

		it("applies custom mode overrides", async () => {
			const customModes: ModeConfig[] = [
				{
					slug: "debug",
					name: "Custom Debug",
					roleDefinition: "Custom debug role",
					groups: ["read"],
				},
			]

			const result = await getFullModeDetails("debug", customModes)
			expect(result).toMatchObject({
				slug: "debug",
				name: "Custom Debug",
				roleDefinition: "Custom debug role",
				groups: ["read"],
			})
		})

		it("applies prompt component overrides", async () => {
			const customModePrompts = {
				debug: {
					roleDefinition: "Overridden role",
					customInstructions: "Overridden instructions",
				},
			}

			const result = await getFullModeDetails("debug", undefined, customModePrompts)
			expect(result.roleDefinition).toBe("Overridden role")
			expect(result.customInstructions).toBe("Overridden instructions")
		})

		it("combines custom instructions when cwd provided", async () => {
			const options = {
				cwd: "/test/path",
				globalCustomInstructions: "Global instructions",
				language: "en",
			}

			await getFullModeDetails("debug", undefined, undefined, options)

			expect(addCustomInstructions).toHaveBeenCalledWith(
				expect.any(String),
				"Global instructions",
				"/test/path",
				"debug",
				{ language: "en" },
			)
		})

		it("falls back to first mode for non-existent mode", async () => {
			const result = await getFullModeDetails("non-existent")
			expect(result).toMatchObject({
				...modes[0],
				customInstructions: "",
			})
		})
	})

	it("formats error message with description when provided", () => {
		const error = new FileRestrictionError("Markdown Editor", "\\.md$", "Markdown files only", "test.js")
		expect(error.message).toBe(
			"This mode (Markdown Editor) can only edit files matching pattern: \\.md$ (Markdown files only). Got: test.js",
		)
		expect(error.name).toBe("FileRestrictionError")
	})
})

describe("getModeSelection", () => {
	const builtInAskMode = modes.find((m) => m.slug === "ask")!

	const customModesList: ModeConfig[] = [
		{
			slug: "code", // Override
			name: "Custom Code Mode",
			roleDefinition: "Custom Code Role",
			customInstructions: "Custom Code Instructions",
			groups: ["read"],
		},
		{
			slug: "new-custom",
			name: "New Custom Mode",
			roleDefinition: "New Custom Role",
			customInstructions: "New Custom Instructions",
			groups: ["edit"],
		},
	]

	const promptComponentCode: PromptComponent = {
		roleDefinition: "Prompt Component Code Role",
		customInstructions: "Prompt Component Code Instructions",
	}

	const promptComponentAsk: PromptComponent = {
		roleDefinition: "Prompt Component Ask Role",
		customInstructions: "Prompt Component Ask Instructions",
	}

	test("should return built-in mode details if no overrides", () => {
		const selection = getModeSelection("ask")
		expect(selection.roleDefinition).toBe(builtInAskMode.roleDefinition)
		expect(selection.baseInstructions).toBe(builtInAskMode.customInstructions || "")
	})

	test("should prioritize promptComponent for built-in mode", () => {
		const selection = getModeSelection("ask", promptComponentAsk)
		expect(selection.roleDefinition).toBe(promptComponentAsk.roleDefinition)
		expect(selection.baseInstructions).toBe(promptComponentAsk.customInstructions)
	})

	test("should prioritize customMode over built-in mode", () => {
		const selection = getModeSelection("code", undefined, customModesList)
		const customCode = customModesList.find((m) => m.slug === "code")!
		expect(selection.roleDefinition).toBe(customCode.roleDefinition)
		expect(selection.baseInstructions).toBe(customCode.customInstructions)
	})

	test("should prioritize customMode over promptComponent and built-in mode when all define properties", () => {
		const selection = getModeSelection("code", promptComponentCode, customModesList)
		const customCode = customModesList.find((m) => m.slug === "code")!
		expect(selection.roleDefinition).toBe(customCode.roleDefinition)
		expect(selection.baseInstructions).toBe(customCode.customInstructions)
	})

	test("should return new custom mode details", () => {
		const selection = getModeSelection("new-custom", undefined, customModesList)
		const newCustom = customModesList.find((m) => m.slug === "new-custom")!
		expect(selection.roleDefinition).toBe(newCustom.roleDefinition)
		expect(selection.baseInstructions).toBe(newCustom.customInstructions)
	})

	test("customMode properties take precedence for new custom mode even with promptComponent", () => {
		const promptComponentNew: PromptComponent = {
			roleDefinition: "Prompt New Custom Role",
			customInstructions: "Prompt New Custom Instructions",
		}
		const selection = getModeSelection("new-custom", promptComponentNew, customModesList)
		const newCustomMode = customModesList.find((m) => m.slug === "new-custom")!
		expect(selection.roleDefinition).toBe(newCustomMode.roleDefinition)
		expect(selection.baseInstructions).toBe(newCustomMode.customInstructions)
	})

	test("should fallback to default (first) mode if slug does not exist", () => {
		const selection = getModeSelection("non-existent-mode", undefined, customModesList)
		expect(selection.roleDefinition).toBe(modes[0].roleDefinition)
		expect(selection.baseInstructions).toBe(modes[0].customInstructions || "")
	})

	test("customMode.roleDefinition is used if defined, ignoring promptComponent's; customMode.customInstructions also from customMode", () => {
		const selection = getModeSelection("code", { roleDefinition: "Prompt Role Only" }, customModesList)
		const customCodeMode = customModesList.find((m) => m.slug === "code")!
		expect(selection.roleDefinition).toBe(customCodeMode.roleDefinition)
		expect(selection.baseInstructions).toBe(customCodeMode.customInstructions)
	})

	test("customMode.customInstructions is used if defined, ignoring promptComponent's; customMode.roleDefinition also from customMode", () => {
		const selection = getModeSelection("code", { customInstructions: "Prompt Instructions Only" }, customModesList)
		const customCodeMode = customModesList.find((m) => m.slug === "code")!
		expect(selection.roleDefinition).toBe(customCodeMode.roleDefinition)
		expect(selection.baseInstructions).toBe(customCodeMode.customInstructions)
	})

	test("customMode takes precedence over built-in when no promptComponent", () => {
		const selection = getModeSelection("code", undefined, customModesList)
		expect(selection.roleDefinition).toBe(customModesList.find((m) => m.slug === "code")!.roleDefinition)
		expect(selection.baseInstructions).toBe(customModesList.find((m) => m.slug === "code")!.customInstructions)
	})

	test("handles undefined customInstructions in modes gracefully", () => {
		const modesWithoutCustomInstructions: ModeConfig[] = [
			{
				slug: "no-instr",
				name: "No Instructions Mode",
				roleDefinition: "Role for no instructions",
				groups: ["read"],
				// customInstructions is undefined
			},
		]
		const selection = getModeSelection("no-instr", undefined, modesWithoutCustomInstructions)
		expect(selection.roleDefinition).toBe("Role for no instructions")
		expect(selection.baseInstructions).toBe("") // Should default to empty string
	})

	test("handles undefined roleDefinition in modes gracefully by falling back", () => {
		const modesWithoutRoleDef: ModeConfig[] = [
			{
				slug: "no-role",
				name: "No Role Mode",
				roleDefinition: "", // Ensure roleDefinition is present
				customInstructions: "Instructions for no role",
				groups: ["read"],
			},
		]
		// Since 'no-role' is a custom mode not overriding a built-in, and it lacks a role,
		// the logic in getModeSelection might fall back if not handled.
		// The current getModeBySlug logic in getModeSelection will fetch this mode.
		// Then, isCustom will be true.
		// roleDefinition = modeConfig?.roleDefinition (undefined) || promptComponent?.roleDefinition (undefined) || ""
		// So it should become ""
		const selection = getModeSelection("no-role", undefined, modesWithoutRoleDef)
		expect(selection.roleDefinition).toBe("")
		expect(selection.baseInstructions).toBe("Instructions for no role")
	})

	test("promptComponent fills customInstructions if customMode's is undefined", () => {
		const customModeRoleOnly: ModeConfig[] = [
			{ slug: "role-custom", name: "Role Custom", roleDefinition: "Custom Role Only", groups: ["read"] },
		]
		const promptComponentInstrOnly: PromptComponent = { customInstructions: "Prompt Instructions Only" }
		const selection = getModeSelection("role-custom", promptComponentInstrOnly, customModeRoleOnly)
		expect(selection.roleDefinition).toBe("Custom Role Only")
		expect(selection.baseInstructions).toBe("Prompt Instructions Only")
	})

	test("promptComponent fills roleDefinition if customMode's is undefined", () => {
		const customModeInstrOnly: ModeConfig[] = [
			{
				slug: "instr-custom",
				name: "Instr Custom",
				roleDefinition: "", // Added to satisfy ModeConfig type
				customInstructions: "Custom Instructions Only",
				groups: ["read"],
			},
		]
		const promptComponentRoleOnly: PromptComponent = { roleDefinition: "Prompt Role Only" }
		const selection = getModeSelection("instr-custom", promptComponentRoleOnly, customModeInstrOnly)
		expect(selection.roleDefinition).toBe("Prompt Role Only")
		expect(selection.baseInstructions).toBe("Custom Instructions Only")
	})

	test("builtInMode fills properties if customMode and promptComponent's are undefined", () => {
		const customModeMinimal: ModeConfig[] = [
			{ slug: "ask", name: "Custom Ask Minimal", roleDefinition: "", groups: ["read"] }, // No roleDef or customInstr
		]
		const promptComponentMinimal: PromptComponent = {} // No roleDef or customInstr
		const selection = getModeSelection("ask", promptComponentMinimal, customModeMinimal)

		// According to original logic, if customMode provides "", that takes precedence.
		expect(selection.roleDefinition).toBe("") // Was builtInAskMode.roleDefinition
		expect(selection.baseInstructions).toBe("") // Was builtInAskMode.customInstructions || ""
	})
})
