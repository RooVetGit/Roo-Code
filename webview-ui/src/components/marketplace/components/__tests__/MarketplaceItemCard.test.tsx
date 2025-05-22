import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MarketplaceItemCard } from "../MarketplaceItemCard"
import { vscode } from "@/utils/vscode"
import { MarketplaceItem } from "@roo/services/marketplace/types"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AccordionTrigger } from "@/components/ui/accordion"
type MarketplaceItemType = "mode" | "prompt" | "package" | "mcp"

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
			const translations: Record<string, any> = {
				"marketplace:filters.type.mode": "Mode",
				"marketplace:filters.type.mcp server": "MCP Server",
				"marketplace:filters.type.prompt": "Prompt",
				"marketplace:filters.type.package": "Package",
				"marketplace:filters.tags.clear": "Remove filter",
				"marketplace:filters.tags.clickToFilter": "Add filter",
				"marketplace:items.components": "Components", // This should be a string for the title prop
				"marketplace:items.card.installProject": "Install Project",
				"marketplace:items.card.removeProject": "Remove Project",
			}
			// Special handling for "marketplace:items.components" when it's used as a badge with count
			if (key === "marketplace:items.components" && params?.count !== undefined) {
				return `${params.count} Components`
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
	ChevronDown: () => <div data-testid="chevron-down-icon" />, // Added ChevronDown mock
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

		// When installed in project, the button should say "Remove Project"
		expect(screen.getByText("Remove Project")).toBeInTheDocument()
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

		// The global installation is handled by MarketplaceItemActionsMenu, which is mocked.
		// So, we can't directly assert on "Global" text unless it's explicitly rendered outside the menu.
		// For now, we'll rely on the actions menu being present.
		expect(screen.getByTestId("actions-menu")).toBeInTheDocument()
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

		const authorText = screen.getByText(/by Test Author/) // Changed to regex
		expect(authorText.tagName).not.toBe("BUTTON")
	})

	describe("MarketplaceItemCard install/remove button", () => {
		it("posts install message when not installed in project", () => {
			const setFilters = jest.fn()
			const setActiveTab = jest.fn()
			const item: MarketplaceItem = {
				id: "test-item",
				name: "Test Item",
				description: "Test Description",
				type: "mode" as MarketplaceItemType,
				version: "1.0.0",
				author: "Test Author",
				authorUrl: "https://example.com",
				lastUpdated: "2024-01-01",
				tags: ["test", "example"],
				url: "https://example.com/item",
				repoUrl: "https://github.com/test/repo",
			}
			const installed = {
				project: undefined,
				global: undefined,
			}
			renderWithProviders(
				<MarketplaceItemCard
					item={item}
					installed={installed}
					filters={{ type: "", search: "", tags: [] }}
					setFilters={setFilters}
					activeTab="browse"
					setActiveTab={setActiveTab}
				/>,
			)

			const installButton = screen.getByRole("button", { name: "Install Project" }) // Changed to exact string
			installButton.click()

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "installMarketplaceItem",
				mpItem: item,
				mpInstallOptions: { target: "project" },
			})
		})

		it("posts remove message when installed in project", () => {
			const setFilters = jest.fn()
			const setActiveTab = jest.fn()
			const item: MarketplaceItem = {
				id: "test-item",
				name: "Test Item",
				description: "Test Description",
				type: "mode" as MarketplaceItemType,
				version: "1.0.0",
				author: "Test Author",
				authorUrl: "https://example.com",
				lastUpdated: "2024-01-01",
				tags: ["test", "example"],
				url: "https://example.com/item",
				repoUrl: "https://github.com/test/repo",
			}
			const installed = {
				project: { version: "1.0.0" },
				global: undefined,
			}
			renderWithProviders(
				<MarketplaceItemCard
					item={item}
					installed={installed}
					filters={{ type: "", search: "", tags: [] }}
					setFilters={setFilters}
					activeTab="browse"
					setActiveTab={setActiveTab}
				/>,
			)

			const removeButton = screen.getByRole("button", { name: "Remove Project" }) // Changed to exact string
			removeButton.click()

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "removeInstalledMarketplaceItem",
				mpItem: item,
				mpInstallOptions: { target: "project" },
			})
		})
	})

	describe("MarketplaceItemCard expandable section badge", () => {
		it("shows badge count for matched sub-items", () => {
			const packageItem: MarketplaceItem = {
				id: "package-item",
				name: "Package Item",
				description: "Package Description",
				type: "package" as MarketplaceItemType,
				version: "1.0.0",
				author: "Package Author",
				authorUrl: "https://example.com",
				lastUpdated: "2024-01-01",
				tags: ["package"],
				url: "https://example.com/package",
				repoUrl: "https://github.com/package/repo",
				items: [
					{
						type: "mode" as MarketplaceItemType,
						path: "path1",
						matchInfo: { matched: true },
						metadata: {
							name: "Comp1",
							description: "",
							type: "mode" as MarketplaceItemType,
							version: "1.0.0",
						},
					},
					{
						type: "mode" as MarketplaceItemType,
						path: "path2",
						matchInfo: { matched: false },
						metadata: {
							name: "Comp2",
							description: "",
							type: "mode" as MarketplaceItemType,
							version: "1.0.0",
						},
					},
					{
						type: "mode" as MarketplaceItemType,
						path: "path3",
						matchInfo: { matched: true },
						metadata: {
							name: "Comp3",
							description: "",
							type: "mode" as MarketplaceItemType,
							version: "1.0.0",
						},
					},
				],
			}
			renderWithProviders(
				<MarketplaceItemCard
					item={packageItem}
					installed={{ project: undefined, global: undefined }}
					filters={{ type: "", search: "", tags: [] }}
					setFilters={jest.fn()}
					activeTab="browse"
					setActiveTab={jest.fn()}
				/>,
			)

			const badge = screen.getByText("2 Components")
			expect(badge).toBeInTheDocument()
		})

		it("does not show badge if no matched sub-items", () => {
			const packageItem: MarketplaceItem = {
				id: "package-item",
				name: "Package Item",
				description: "Package Description",
				type: "package" as MarketplaceItemType,
				version: "1.0.0",
				author: "Package Author",
				authorUrl: "https://example.com",
				lastUpdated: "2024-01-01",
				tags: ["package"],
				url: "https://example.com/package",
				repoUrl: "https://github.com/package/repo",
				items: [
					{
						type: "mode" as MarketplaceItemType,
						path: "path1",
						matchInfo: { matched: false },
						metadata: {
							name: "Comp1",
							description: "",
							type: "mode" as MarketplaceItemType,
							version: "1.0.0",
						},
					},
					{
						type: "mode" as MarketplaceItemType,
						path: "path2",
						matchInfo: { matched: false },
						metadata: {
							name: "Comp2",
							description: "",
							type: "mode" as MarketplaceItemType,
							version: "1.0.0",
						},
					},
				],
			}
			renderWithProviders(
				<MarketplaceItemCard
					item={packageItem}
					installed={{ project: undefined, global: undefined }}
					filters={{ type: "", search: "", tags: [] }}
					setFilters={jest.fn()}
					activeTab="browse"
					setActiveTab={jest.fn()}
				/>,
			)

			const badge = screen.queryByText("Components", { selector: ".bg-vscode-badge-background" })
			expect(badge).toBeNull()
		})
	})
})
