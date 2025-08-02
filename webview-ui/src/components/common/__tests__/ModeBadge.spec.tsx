import { render, screen } from "@testing-library/react"
import { ModeBadge } from "../ModeBadge"
import { getModeBySlug } from "@roo/modes"
import { useExtensionState } from "@/context/ExtensionStateContext"

// Mock dependencies
vi.mock("@roo/modes")
vi.mock("@/context/ExtensionStateContext")
vi.mock("@/components/ui", () => ({
	StandardTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
	Badge: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

const mockGetModeBySlug = vi.mocked(getModeBySlug)
const mockUseExtensionState = vi.mocked(useExtensionState)

describe("ModeBadge", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseExtensionState.mockReturnValue({
			customModes: [],
		} as any)
	})

	it("should not render when modeSlug is undefined", () => {
		const { container } = render(<ModeBadge modeSlug={undefined} />)
		expect(container.firstChild).toBeNull()
	})

	it("should render mode name for built-in mode", () => {
		mockGetModeBySlug.mockReturnValue({
			slug: "code",
			name: "💻 Code",
			roleDefinition: "You are a code assistant",
			groups: ["read", "edit"] as const,
		} as any)

		render(<ModeBadge modeSlug="code" />)

		expect(screen.getByText("💻 Code")).toBeInTheDocument()
		expect(mockGetModeBySlug).toHaveBeenCalledWith("code", [])
	})

	it("should render mode name for custom mode", () => {
		const customModes = [
			{
				slug: "custom-mode",
				name: "🎨 Custom Mode",
				roleDefinition: "Custom role",
				groups: ["read"] as const,
			},
		]

		mockUseExtensionState.mockReturnValue({
			customModes,
		} as any)

		mockGetModeBySlug.mockReturnValue(customModes[0] as any)

		render(<ModeBadge modeSlug="custom-mode" />)

		expect(screen.getByText("🎨 Custom Mode")).toBeInTheDocument()
		expect(mockGetModeBySlug).toHaveBeenCalledWith("custom-mode", customModes)
	})

	it("should render mode slug as fallback for deleted custom mode", () => {
		mockGetModeBySlug.mockReturnValue(undefined)

		render(<ModeBadge modeSlug="deleted-mode" />)

		expect(screen.getByText("deleted-mode")).toBeInTheDocument()
	})

	it("should truncate long mode names", () => {
		mockGetModeBySlug.mockReturnValue({
			slug: "long-mode",
			name: "This is a very long mode name that should be truncated",
			roleDefinition: "Long mode",
			groups: ["read"] as const,
		} as any)

		render(<ModeBadge modeSlug="long-mode" />)

		expect(screen.getByText("This is a very lo...")).toBeInTheDocument()
	})

	it("should show full name in tooltip", () => {
		const longName = "This is a very long mode name that should be truncated"
		mockGetModeBySlug.mockReturnValue({
			slug: "long-mode",
			name: longName,
			roleDefinition: "Long mode",
			groups: ["read"] as const,
		} as any)

		render(<ModeBadge modeSlug="long-mode" />)

		// The StandardTooltip component should have the full name as content
		const badge = screen.getByText("This is a very lo...")
		expect(badge.closest("[title]")).toHaveAttribute("title", longName)
	})

	it("should apply custom className", () => {
		mockGetModeBySlug.mockReturnValue({
			slug: "code",
			name: "Code",
			roleDefinition: "Code mode",
			groups: ["read"] as const,
		} as any)

		render(<ModeBadge modeSlug="code" className="custom-class" />)

		const badge = screen.getByText("Code")
		expect(badge).toHaveClass("custom-class")
	})

	it("should handle mode without emoji", () => {
		mockGetModeBySlug.mockReturnValue({
			slug: "plain-mode",
			name: "Plain Mode",
			roleDefinition: "Plain mode",
			groups: ["read"] as const,
		} as any)

		render(<ModeBadge modeSlug="plain-mode" />)

		expect(screen.getByText("Plain Mode")).toBeInTheDocument()
	})

	it("should use correct styling classes", () => {
		mockGetModeBySlug.mockReturnValue({
			slug: "test-mode",
			name: "Test Mode",
			roleDefinition: "Test mode",
			groups: ["read"] as const,
		} as any)

		render(<ModeBadge modeSlug="test-mode" />)

		const badge = screen.getByText("Test Mode")
		expect(badge).toHaveClass("bg-vscode-badge-background")
		expect(badge).toHaveClass("text-vscode-badge-foreground")
		expect(badge).toHaveClass("border-vscode-badge-background")
		expect(badge).toHaveClass("text-xs")
		expect(badge).toHaveClass("font-normal")
		expect(badge).toHaveClass("px-1.5")
		expect(badge).toHaveClass("py-0")
		expect(badge).toHaveClass("h-5")
	})

	it("should handle all built-in modes", () => {
		const builtInModes = [
			{ slug: "architect", name: "🏗️ Architect" },
			{ slug: "code", name: "💻 Code" },
			{ slug: "ask", name: "❓ Ask" },
			{ slug: "debug", name: "🪲 Debug" },
			{ slug: "test", name: "🧪 Test" },
		]

		builtInModes.forEach((mode) => {
			mockGetModeBySlug.mockReturnValue({
				...mode,
				roleDefinition: "Test",
				groups: ["read"] as const,
			} as any)

			const { unmount } = render(<ModeBadge modeSlug={mode.slug} />)
			expect(screen.getByText(mode.name)).toBeInTheDocument()
			unmount()
		})
	})
})
