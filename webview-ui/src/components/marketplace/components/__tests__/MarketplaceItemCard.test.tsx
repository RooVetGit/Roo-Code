import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MarketplaceItemCard } from "../MarketplaceItemCard"
import { vscode } from "@/utils/vscode"
import { MarketplaceItem } from "@roo/services/marketplace/types"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AccordionTrigger } from "@/components/ui/accordion"

// Mock vscode API
jest.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock MarketplaceItemActionsMenu component
jest.mock("../MarketplaceItemActionsMenu", () => ({
	MarketplaceItemActionsMenu: () => <div data-testid="actions-menu" />,
}))

// Mock ChevronDownIcon for Accordion
jest.mock("@/components/ui/accordion", () => {
	const actual = jest.requireActual("@/components/ui/accordion")
	return {
		...actual,
		AccordionTrigger: ({ children, ...props }: React.ComponentProps<typeof AccordionTrigger>) => (
			<button {...props}>
				{children}
				<span data-testid="chevron-icon" />
			</button>
		),
	}
})

// Mock translation hook
jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			if (key === "marketplace:items.card.by") {
				return `by ${params.author}`
			}
			const translations: Record<string, string> = {
				"marketplace:filters.type.mode": "Mode",
				"marketplace:filters.type.mcp server": "MCP Server",
				"marketplace:filters.type.prompt": "Prompt",
				"marketplace:filters.type.package": "Package",
				"marketplace:filters.tags.clear": "Remove filter",
				"marketplace:filters.tags.clickToFilter": "Add filter",
				"marketplace:items.components": "Components",
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
	Download: () => <div data-testid="download-icon" />,
}))

const renderWithProviders = (ui: React.ReactElement) => {
	return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("MarketplaceItemCard", () => {
	const defaultItem: MarketplaceItem = {
		id: "test-item",
		name: "Test Item",
		description: "Test Description",
		type: "mode",
		version: "1.0.0",
		author: "Test Author",
		authorUrl: "https://example.com",
		lastUpdated: "2024-01-01",
		tags: ["test", "example"],
		repoUrl: "https://github.com/test/repo",
		url: "https://example.com/item",
	}

	const defaultProps = {
		item: defaultItem,
		installed: {
			project: undefined,
			global: undefined,
		},
		filters: {
			type: "",
			search: "",
			tags: [],
		},
		setFilters: jest.fn(),
		activeTab: "browse" as const,
		setActiveTab: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("renders basic item information", () => {
		renderWithProviders(<MarketplaceItemCard {...defaultProps} />)

		expect(screen.getByText("Test Item")).toBeInTheDocument()
		expect(screen.getByText("Test Description")).toBeInTheDocument()
		expect(screen.getByText("by Test Author")).toBeInTheDocument()
		expect(screen.getByText("1.0.0")).toBeInTheDocument()
		expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument()
	})

	it("renders project installation badge", () => {
		renderWithProviders(
			<MarketplaceItemCard
				{...defaultProps}
				installed={{
					project: { version: "1.0.0" },
					global: undefined,
				}}
			/>,
		)

		expect(screen.getByText("Project")).toBeInTheDocument()
		expect(screen.getByLabelText("Installed in project")).toBeInTheDocument()
	})

	it("renders global installation badge", () => {
		renderWithProviders(
			<MarketplaceItemCard
				{...defaultProps}
				installed={{
					project: undefined,
					global: { version: "1.0.0" },
				}}
			/>,
		)

		expect(screen.getByText("Global")).toBeInTheDocument()
		expect(screen.getByLabelText("Installed globally")).toBeInTheDocument()
	})

	it("renders type with appropriate icon", () => {
		renderWithProviders(<MarketplaceItemCard {...defaultProps} />)

		expect(screen.getByText("Mode")).toBeInTheDocument()
		expect(screen.getByTestId("rocket-icon")).toBeInTheDocument()
	})

	it("renders tags and handles tag clicks", async () => {
		const user = userEvent.setup()
		const setFilters = jest.fn()
		const setActiveTab = jest.fn()

		renderWithProviders(
			<MarketplaceItemCard {...defaultProps} setFilters={setFilters} setActiveTab={setActiveTab} />,
		)

		const tagButton = screen.getByText("test")
		await user.click(tagButton)

		expect(setFilters).toHaveBeenCalledWith({ tags: ["test"] })
		expect(setActiveTab).not.toHaveBeenCalled() // Already on browse tab
	})

	it("handles author link click", async () => {
		const user = userEvent.setup()
		renderWithProviders(<MarketplaceItemCard {...defaultProps} />)

		const authorLink = screen.getByText("by Test Author")
		await user.click(authorLink)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openExternal",
			url: "https://example.com",
		})
	})

	it("renders package components when available", () => {
		const packageItem: MarketplaceItem = {
			...defaultItem,
			type: "package",
			items: [
				{
					type: "mode",
					path: "test/path",
					matchInfo: { matched: true },
					metadata: {
						name: "Component 1",
						description: "Test Component",
						type: "mode",
						version: "1.0.0",
					},
				},
			],
		}

		renderWithProviders(<MarketplaceItemCard {...defaultProps} item={packageItem} />)

		// Find the section title by its parent button
		const sectionTitle = screen.getByRole("button", { name: /Components/ })
		expect(sectionTitle).toBeInTheDocument()
		expect(screen.getByText("Component 1")).toBeInTheDocument()
	})

	it("does not render invalid author URLs", () => {
		const itemWithInvalidUrl: MarketplaceItem = {
			...defaultItem,
			authorUrl: "invalid-url",
		}

		renderWithProviders(<MarketplaceItemCard {...defaultProps} item={itemWithInvalidUrl} />)

		const authorText = screen.getByText("by Test Author")
		expect(authorText.tagName).not.toBe("BUTTON")
	})
})
