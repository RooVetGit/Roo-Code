import { render, screen, fireEvent, act } from "@testing-library/react"
import PackageManagerView from "../PackageManagerView"
import { ComponentMetadata, PackageManagerItem } from "../../../../../src/services/package-manager/types"
import { TranslationProvider } from "@/i18n/TranslationContext"
import { PackageManagerViewStateManager } from "../PackageManagerViewStateManager"

// Mock vscode API for external communication
const mockPostMessage = jest.fn()
jest.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: (msg: any) => mockPostMessage(msg),
		getState: () => undefined,
		setState: (state: any) => state,
	},
}))

// Mock ExtensionStateContext
jest.mock("../../../context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		packageManagerSources: [{ url: "test-url", enabled: true }],
		setPackageManagerSources: jest.fn(),
		language: "en",
		experiments: {
			search_and_replace: false,
			insert_content: false,
			powerSteering: false,
		},
	}),
}))

const mockMetadata: ComponentMetadata = {
	name: "Test Server",
	description: "A test server",
	type: "mcp server",
	version: "1.0.0",
}

describe("PackageManagerView", () => {
	beforeAll(() => {
		jest.setTimeout(5000) // 5 second timeout for all tests
	})

	const mockItems: PackageManagerItem[] = [
		{
			name: "Test Package",
			description: "A test package",
			type: "package",
			repoUrl: "https://github.com/org/repo",
			url: "test-url",
			defaultBranch: "main",
			tags: ["test", "mock"],
			items: [
				{
					type: "mcp server",
					path: "test/path",
					metadata: mockMetadata,
				},
			],
		},
		{
			name: "Another Package",
			description: "Another test package",
			type: "package",
			repoUrl: "test-url-2",
			url: "test-url-2",
			tags: ["test", "another"],
		},
	]

	beforeEach(() => {
		jest.useFakeTimers()
		mockPostMessage.mockClear()

		// Mock window event listener to handle messages
		const listeners = new Map()
		window.addEventListener = jest.fn((event, handler) => {
			if (event === "message") {
				listeners.set("message", handler)
			} else {
				listeners.set(event, handler)
			}
		})
		window.removeEventListener = jest.fn()
		window.dispatchEvent = jest.fn((event: Event) => {
			const messageEvent = event as MessageEvent
			const handler = listeners.get(messageEvent.type)
			if (handler) {
				handler(messageEvent)
			}
			return true
		})
	})

	const mockStateManager = new PackageManagerViewStateManager()

	const renderWithTranslation = (ui: React.ReactElement) => {
		return render(<TranslationProvider>{ui}</TranslationProvider>)
	}

	it("should automatically fetch items on mount", async () => {
		renderWithTranslation(<PackageManagerView stateManager={mockStateManager} />)

		// Should immediately trigger a fetch
		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "fetchPackageManagerItems",
			bool: true,
		})

		// Should show loading state
		expect(
			screen.getByText((content, element) => {
				// Match either the translated text or the raw key
				return content === "Refreshing..." || content === "items.refresh.refreshing"
			}),
		).toBeInTheDocument()

		// Simulate receiving items
		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "state",
						state: {
							packageManagerItems: mockItems,
							isFetching: false,
							activeTab: "browse",
							refreshingUrls: [],
							sources: [],
							filters: { type: "", search: "", tags: [] },
							sortConfig: { by: "name", order: "asc" },
						},
					},
				}),
			)
		})

		// Should show items
		expect(
			screen.getByText((content) => {
				// Match either the translated text or the raw key
				return content === "2 items found" || content === "items.count"
			}),
		).toBeInTheDocument()
		expect(screen.getByText("Test Package")).toBeInTheDocument()
		expect(screen.getByText("Another Package")).toBeInTheDocument()
	})

	it("should update display items when receiving filtered results from backend", async () => {
		renderWithTranslation(<PackageManagerView stateManager={mockStateManager} />)

		// Load initial items
		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "state",
						state: {
							packageManagerItems: [
								{
									name: "MCP Server 1",
									type: "mcp server",
									repoUrl: "test-url-1",
									url: "test-url-1",
								},
								{
									name: "Mode 1",
									type: "mode",
									repoUrl: "test-url-2",
									url: "test-url-2",
								},
								{
									name: "MCP Server 2",
									type: "mcp server",
									repoUrl: "test-url-3",
									url: "test-url-3",
								},
							],
							isFetching: false,
							activeTab: "browse",
							refreshingUrls: [],
							sources: [],
							filters: { type: "", search: "", tags: [] },
							sortConfig: { by: "name", order: "asc" },
						},
					},
				}),
			)
		})

		// Verify initial items are shown
		expect(
			screen.getByText((content) => {
				// Match either the translated text or the raw key
				return content === "3 items found" || content === "items.count"
			}),
		).toBeInTheDocument()
		expect(screen.getByText("MCP Server 1")).toBeInTheDocument()
		expect(screen.getByText("Mode 1")).toBeInTheDocument()
		expect(screen.getByText("MCP Server 2")).toBeInTheDocument()

		// Select MCP Server from type filter
		const typeFilter = screen.getByLabelText((content) => {
			return content === "Filter by type:" || content === "filters.type.label"
		})
		await act(async () => {
			fireEvent.change(typeFilter, { target: { value: "mcp server" } })
		})

		// Verify initial fetch and filter requests were sent
		expect(mockPostMessage).toHaveBeenCalledTimes(2)
		expect(mockPostMessage).toHaveBeenLastCalledWith({
			type: "filterPackageManagerItems",
			filters: { type: "mcp server", search: "", tags: [] },
		})
	})
})
