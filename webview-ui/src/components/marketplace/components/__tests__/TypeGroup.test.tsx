import { render, screen } from "@testing-library/react"
import { TypeGroup } from "../TypeGroup"

// Mock translation hook
jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			if (key === "marketplace:type-group.generic-type") {
				return params.type
			}
			const translations: Record<string, string> = {
				"marketplace:type-group.modes": "Modes",
				"marketplace:type-group.mcps": "MCPs",
				"marketplace:type-group.prompts": "Prompts",
				"marketplace:type-group.packages": "Packages",
				"marketplace:type-group.match": "Match",
			}
			return translations[key] || key
		},
	}),
}))

// Mock icons
jest.mock("lucide-react", () => ({
	Rocket: () => <div data-testid="rocket-icon" />,
	Server: () => <div data-testid="server-icon" />,
	Package: () => <div data-testid="package-icon" />,
	Sparkles: () => <div data-testid="sparkles-icon" />,
}))

describe("TypeGroup", () => {
	const defaultItems = [
		{
			name: "Test Item",
			description: "Test Description",
			path: "test/path",
		},
	]

	it("renders nothing when items array is empty", () => {
		const { container } = render(<TypeGroup type="mode" items={[]} />)
		expect(container).toBeEmptyDOMElement()
	})

	it("renders mode type with horizontal layout", () => {
		render(<TypeGroup type="mode" items={defaultItems} />)

		expect(screen.getByText("Modes")).toBeInTheDocument()
		expect(screen.getByTestId("rocket-icon")).toBeInTheDocument()

		// Find the grid container
		const gridContainer = screen.getByText("Test Item").closest(".grid")
		expect(gridContainer).toHaveClass("grid-cols-[repeat(auto-fit,minmax(140px,1fr))]")
	})

	it("renders mcp type with vertical layout", () => {
		render(<TypeGroup type="mcp" items={defaultItems} />)

		expect(screen.getByText("MCPs")).toBeInTheDocument()
		expect(screen.getByTestId("server-icon")).toBeInTheDocument()

		// Find the grid container
		const gridContainer = screen.getByText("Test Item").closest(".grid")
		expect(gridContainer).toHaveClass("grid-cols-1")
	})

	it("renders prompt type correctly", () => {
		render(<TypeGroup type="prompt" items={defaultItems} />)

		expect(screen.getByText("Prompts")).toBeInTheDocument()
		expect(screen.getByTestId("sparkles-icon")).toBeInTheDocument()
	})

	it("renders package type correctly", () => {
		render(<TypeGroup type="package" items={defaultItems} />)

		expect(screen.getByText("Packages")).toBeInTheDocument()
		expect(screen.getByTestId("package-icon")).toBeInTheDocument()
	})

	it("renders custom type with generic label", () => {
		render(<TypeGroup type="custom" items={defaultItems} />)

		expect(screen.getByText("Custom")).toBeInTheDocument()
		// Falls back to package icon
		expect(screen.getByTestId("package-icon")).toBeInTheDocument()
	})

	it("renders matched items with special styling", () => {
		const matchedItems = [
			{
				name: "Matched Item",
				description: "Test Description",
				path: "test/path",
				matchInfo: {
					matched: true,
					matchReason: { name: true },
				},
			},
		]

		render(<TypeGroup type="mode" items={matchedItems} />)

		const matchedText = screen.getByText("Matched Item")
		expect(matchedText).toHaveClass("text-vscode-textLink")
		expect(screen.getByText("Match")).toBeInTheDocument()
	})

	it("renders description when provided", () => {
		render(<TypeGroup type="mcp" items={defaultItems} />)

		expect(screen.getByText("Test Description")).toBeInTheDocument()
		expect(screen.getByText("Test Description")).toHaveClass("text-vscode-descriptionForeground")
	})

	it("applies custom className", () => {
		render(<TypeGroup type="mode" items={defaultItems} className="custom-class" />)

		const container = screen.getByText("Modes").closest(".custom-class")
		expect(container).toBeInTheDocument()
	})
})
