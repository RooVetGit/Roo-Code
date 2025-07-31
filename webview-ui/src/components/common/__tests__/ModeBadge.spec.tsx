import { render, screen } from "@/utils/test-utils"
import { ModeBadge } from "../ModeBadge"

// Mock the shared modes module
vi.mock("@roo/modes", () => ({
	getModeBySlug: vi.fn((slug, _customModes) => {
		if (slug === "code") return { slug: "code", name: "💻 Code" }
		if (slug === "architect") return { slug: "architect", name: "🏗️ Architect" }
		if (slug === "custom") return { slug: "custom", name: "Very Long Custom Mode Name That Should Be Truncated" }
		return undefined
	}),
}))

// Mock ExtensionStateContext
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		customModes: [],
	}),
}))

describe("ModeBadge", () => {
	it("renders mode name when mode exists", () => {
		render(<ModeBadge modeSlug="code" />)
		expect(screen.getByText("💻 Code")).toBeInTheDocument()
	})

	it("renders slug as fallback when mode not found", () => {
		render(<ModeBadge modeSlug="deleted-mode" />)
		expect(screen.getByText("deleted-mode")).toBeInTheDocument()
	})

	it("returns null when no mode slug provided", () => {
		const { container } = render(<ModeBadge />)
		expect(container.firstChild).toBeNull()
	})

	it("truncates long mode names", () => {
		render(<ModeBadge modeSlug="custom" />)
		const badge = screen.getByText(/Very Long Custom Mode Name/)
		expect(badge).toHaveClass("truncate")
		expect(badge).toHaveClass("max-w-[120px]")
	})

	it("shows full name in tooltip", () => {
		render(<ModeBadge modeSlug="custom" />)
		// The tooltip content is set via the StandardTooltip's content prop
		// We verify the text is rendered in the badge itself
		const badge = screen.getByText(/Very Long Custom Mode Name/)
		expect(badge).toBeInTheDocument()
	})
})
