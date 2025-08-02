// npx vitest run src/components/common/__tests__/ModeBadge.spec.tsx

import { render, screen } from "@/utils/test-utils"
import { DEFAULT_MODES, type ModeConfig } from "@roo-code/types"

import ModeBadge from "../ModeBadge"

// Mock the shared modes module
vi.mock("../../../../../src/shared/modes", () => ({
	getModeBySlug: vi.fn((slug: string, customModes?: any[]) => {
		// First check custom modes
		const customMode = customModes?.find((mode) => mode.slug === slug)
		if (customMode) {
			return customMode
		}
		// Then check built-in modes
		return DEFAULT_MODES.find((mode) => mode.slug === slug)
	}),
}))

// Mock the extension state context
const mockExtensionState = {
	customModes: [] as ModeConfig[],
}

vi.mock("../../../context/ExtensionStateContext", () => ({
	useExtensionState: () => mockExtensionState,
}))

describe("ModeBadge", () => {
	beforeEach(() => {
		// Reset custom modes before each test
		mockExtensionState.customModes = []
	})

	it("renders mode badge for built-in mode", () => {
		render(<ModeBadge modeSlug="code" />)

		const badge = screen.getByText("💻 Code")
		expect(badge).toBeInTheDocument()
		expect(badge).toHaveClass("border-vscode-input-border")
	})

	it("renders mode badge for architect mode", () => {
		render(<ModeBadge modeSlug="architect" />)

		expect(screen.getByText("🏗️ Architect")).toBeInTheDocument()
	})

	it("renders mode badge for ask mode", () => {
		render(<ModeBadge modeSlug="ask" />)

		expect(screen.getByText("❓ Ask")).toBeInTheDocument()
	})

	it("renders mode badge for debug mode", () => {
		render(<ModeBadge modeSlug="debug" />)

		expect(screen.getByText("🪲 Debug")).toBeInTheDocument()
	})

	it("renders mode badge for orchestrator mode", () => {
		render(<ModeBadge modeSlug="orchestrator" />)

		expect(screen.getByText("🪃 Orchestrator")).toBeInTheDocument()
	})

	it("renders mode badge for custom mode", () => {
		// Add a custom mode to the mock state
		mockExtensionState.customModes = [
			{
				slug: "custom-test",
				name: "🧪 Test Mode",
				roleDefinition: "Test role",
				groups: ["read"],
			},
		]

		render(<ModeBadge modeSlug="custom-test" />)

		expect(screen.getByText("🧪 Test Mode")).toBeInTheDocument()
	})

	it("renders mode badge for custom mode without emoji", () => {
		// Add a custom mode without emoji
		mockExtensionState.customModes = [
			{
				slug: "plain-mode",
				name: "Plain Mode",
				roleDefinition: "Plain role",
				groups: ["read"],
			},
		]

		render(<ModeBadge modeSlug="plain-mode" />)

		expect(screen.getByText("Plain Mode")).toBeInTheDocument()
	})

	it("returns null for undefined mode", () => {
		const { container } = render(<ModeBadge modeSlug="non-existent-mode" />)

		expect(container.firstChild).toBeNull()
	})

	it("returns null for deleted custom mode", () => {
		// Simulate a mode that was deleted but still referenced in history
		render(<ModeBadge modeSlug="deleted-custom-mode" />)

		const { container } = render(<ModeBadge modeSlug="deleted-custom-mode" />)
		expect(container.firstChild).toBeNull()
	})

	it("applies custom className", () => {
		render(<ModeBadge modeSlug="code" className="custom-class" />)

		const badge = screen.getByText("💻 Code")
		expect(badge).toHaveClass("custom-class")
	})

	it("truncates long mode names with CSS", () => {
		// Add a custom mode with a very long name
		mockExtensionState.customModes = [
			{
				slug: "very-long-mode",
				name: "This is a very long mode name that should be truncated",
				roleDefinition: "Long role",
				groups: ["read"],
			},
		]

		render(<ModeBadge modeSlug="very-long-mode" />)

		const badge = screen.getByText("This is a very long mode name that should be truncated")
		expect(badge).toHaveClass("max-w-24", "truncate")
	})

	it("has proper title attribute for accessibility", () => {
		render(<ModeBadge modeSlug="code" />)

		const badge = screen.getByText("💻 Code")
		expect(badge).toHaveAttribute("title", "💻 Code")
	})

	it("uses outline variant for consistent styling", () => {
		render(<ModeBadge modeSlug="code" />)

		const badge = screen.getByText("💻 Code")
		expect(badge).toHaveClass("border-vscode-input-border")
	})

	it("handles custom mode overriding built-in mode", () => {
		// Add a custom mode that overrides a built-in mode
		mockExtensionState.customModes = [
			{
				slug: "code",
				name: "🔧 Custom Code",
				roleDefinition: "Custom code role",
				groups: ["read", "edit"],
			},
		]

		render(<ModeBadge modeSlug="code" />)

		// Should show the custom mode name, not the built-in one
		expect(screen.getByText("🔧 Custom Code")).toBeInTheDocument()
		expect(screen.queryByText("💻 Code")).not.toBeInTheDocument()
	})
})
