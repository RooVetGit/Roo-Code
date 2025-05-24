import { render, screen, fireEvent } from "@testing-library/react"
import { MarketplaceListView } from "../MarketplaceListView"
import { MarketplaceItem } from "../../../../../src/services/marketplace/types"
import { ViewState } from "../MarketplaceViewStateManager"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@/components/ui/tooltip"

jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver

const mockTransition = jest.fn()
const mockState: ViewState = {
	allItems: [],
	displayItems: [],
	isFetching: false,
	activeTab: "browse",
	refreshingUrls: [],
	sources: [],
	installedMetadata: {
		project: {},
		global: {},
	},
	filters: {
		type: "",
		search: "",
		tags: [],
	},
	sortConfig: {
		by: "name",
		order: "asc",
	},
}

jest.mock("../useStateManager", () => ({
	useStateManager: () => [mockState, { transition: mockTransition }],
}))

jest.mock("lucide-react", () => {
	return new Proxy(
		{},
		{
			get: function (obj, prop) {
				if (prop === "__esModule") {
					return true
				}
				return () => <div data-testid={`${String(prop)}-icon`}>{String(prop)}</div>
			},
		},
	)
})

const defaultProps = {
	stateManager: {} as any,
	allTags: ["tag1", "tag2"],
	filteredTags: ["tag1", "tag2"],
}

describe("MarketplaceListView", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockState.filters.tags = []
		mockState.isFetching = false
		mockState.displayItems = []
	})

	const renderWithProviders = (props = {}) =>
		render(
			<TooltipProvider>
				<MarketplaceListView {...defaultProps} {...props} />
			</TooltipProvider>,
		)

	it("renders search input", () => {
		renderWithProviders()

		const searchInput = screen.getByPlaceholderText("marketplace:filters.search.placeholder")
		expect(searchInput).toBeInTheDocument()
	})

	it("renders type filter", () => {
		renderWithProviders()

		expect(screen.getByText("marketplace:filters.type.label")).toBeInTheDocument()
		expect(screen.getByText("marketplace:filters.type.all")).toBeInTheDocument()
	})

	it("renders sort options", () => {
		renderWithProviders()

		expect(screen.getByText("marketplace:filters.sort.label")).toBeInTheDocument()
		expect(screen.getByText("marketplace:filters.sort.name")).toBeInTheDocument()
	})

	it("renders tags section when tags are available", () => {
		renderWithProviders()

		expect(screen.getByText("marketplace:filters.tags.label")).toBeInTheDocument()
		expect(screen.getByText("(2)")).toBeInTheDocument() // Shows tag count
	})

	it("shows loading state when fetching", () => {
		mockState.isFetching = true

		renderWithProviders()

		expect(screen.getByText("marketplace:items.refresh.refreshing")).toBeInTheDocument()
		expect(screen.getByText("This may take a moment...")).toBeInTheDocument()
	})

	it("shows empty state when no items and not fetching", () => {
		renderWithProviders()

		expect(screen.getByText("marketplace:items.empty.noItems")).toBeInTheDocument()
		expect(screen.getByText("Try adjusting your filters or search terms")).toBeInTheDocument()
	})

	it("shows items count when items are available", () => {
		const mockItems: MarketplaceItem[] = [
			{
				id: "1",
				repoUrl: "test1",
				name: "Test 1",
				type: "mode",
				description: "Test description 1",
				url: "https://test1.com",
				version: "1.0.0",
				author: "Test Author 1",
				lastUpdated: "2024-01-01",
			},
			{
				id: "2",
				repoUrl: "test2",
				name: "Test 2",
				type: "mode",
				description: "Test description 2",
				url: "https://test2.com",
				version: "1.0.0",
				author: "Test Author 2",
				lastUpdated: "2024-01-02",
			},
		]
		mockState.displayItems = mockItems

		renderWithProviders()

		expect(screen.getByText("marketplace:items.count")).toBeInTheDocument()
	})

	it("updates search filter when typing", () => {
		renderWithProviders()

		const searchInput = screen.getByPlaceholderText("marketplace:filters.search.placeholder")
		fireEvent.change(searchInput, { target: { value: "test" } })

		expect(mockTransition).toHaveBeenCalledWith({
			type: "UPDATE_FILTERS",
			payload: { filters: { search: "test" } },
		})
	})

	it("shows clear tags button when tags are selected", async () => {
		const user = userEvent.setup()
		mockState.filters.tags = ["tag1"]

		renderWithProviders()

		const clearButton = screen.getByText("marketplace:filters.tags.clear")
		expect(clearButton).toBeInTheDocument()

		await user.click(clearButton)
		expect(mockTransition).toHaveBeenCalledWith({
			type: "UPDATE_FILTERS",
			payload: { filters: { tags: [] } },
		})
	})
})
