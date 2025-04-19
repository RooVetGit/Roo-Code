import React from "react"
import { screen, fireEvent } from "@testing-library/react"
import { MarketplaceItemCard } from "../MarketplaceItemCard"
import { MarketplaceItem } from "../../../../../../src/services/marketplace/types"
import { renderWithProviders } from "@/test/test-utils"

// Mock vscode API
const mockPostMessage = jest.fn()
jest.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: (msg: any) => mockPostMessage(msg),
	},
}))

describe("MarketplaceItemCard", () => {
	const mockItem: MarketplaceItem = {
		name: "Test Package",
		description: "A test package",
		type: "package",
		repoUrl: "test-url",
		url: "test-url",
		tags: ["test", "mock"],
		items: [
			{
				type: "mcp server",
				path: "test/path",
				metadata: {
					name: "Test Server",
					description: "A test server",
					version: "1.0.0",
					type: "mcp server",
				},
			},
			{
				type: "mode",
				path: "test/path2",
				metadata: {
					name: "Test Mode",
					description: "A test mode",
					version: "2.0.0",
					type: "mode",
				},
			},
		],
		version: "1.0.0",
		author: "Test Author",
		lastUpdated: "2025-04-13",
	}

	const defaultProps = {
		item: mockItem,
		filters: { type: "", search: "", tags: [] },
		setFilters: jest.fn(),
		activeTab: "browse" as const,
		setActiveTab: jest.fn(),
	}

	beforeEach(() => {
		mockPostMessage.mockClear()
	})

	it("should render basic item information", () => {
		renderWithProviders(<MarketplaceItemCard {...defaultProps} />)

		expect(screen.getByText("Test Package")).toBeInTheDocument()
		expect(screen.getByText("A test package")).toBeInTheDocument()
		expect(
			screen.getByText((content, element) => {
				// This will match the translated text "by Test Author" regardless of how it's structured
				return element?.textContent === "by Test Author"
			}),
		).toBeInTheDocument()
		// Check for the type label specifically
		expect(
			screen.getByText((content, element) => {
				return Boolean(element?.className.includes("rounded-full") && content === "Package")
			}),
		).toBeInTheDocument()
	})

	it("should render tags", () => {
		renderWithProviders(<MarketplaceItemCard {...defaultProps} />)

		expect(screen.getByText("test")).toBeInTheDocument()
		expect(screen.getByText("mock")).toBeInTheDocument()
	})

	it("should handle tag clicks", () => {
		const setFilters = jest.fn()
		renderWithProviders(<MarketplaceItemCard {...defaultProps} setFilters={setFilters} />)

		fireEvent.click(screen.getByText("test"))
		expect(setFilters).toHaveBeenCalledWith(
			expect.objectContaining({
				tags: ["test"],
			}),
		)
	})

	it("should render version and date information", () => {
		renderWithProviders(<MarketplaceItemCard {...defaultProps} />)

		expect(screen.getByText("1.0.0")).toBeInTheDocument()
		// Use a regex to match the date since it depends on the timezone
		expect(screen.getByText(/Apr \d{1,2}, 2025/)).toBeInTheDocument()
	})

	describe("URL handling", () => {
		it("should use sourceUrl directly when present and valid", () => {
			const itemWithSourceUrl = {
				...mockItem,
				sourceUrl: "https://example.com/direct-link",
				defaultBranch: "main",
				path: "some/path",
			}
			renderWithProviders(<MarketplaceItemCard {...defaultProps} item={itemWithSourceUrl} />)

			const button = screen.getByRole("button", { name: /^$/ }) // Button with no text, only icon
			fireEvent.click(button)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "openExternal",
				url: "https://example.com/direct-link",
			})
		})

		it("should use repoUrl with git path when sourceUrl is not present", () => {
			const itemWithGitPath = {
				...mockItem,
				defaultBranch: "main",
				path: "some/path",
			}
			renderWithProviders(<MarketplaceItemCard {...defaultProps} item={itemWithGitPath} />)
			const button = screen.getByRole("button", { name: /View/i })
			fireEvent.click(button)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "openExternal",
				url: "test-url/tree/main/some/path",
			})
		})

		it("should show only icon when sourceUrl is present and valid", () => {
			const itemWithSourceUrl = {
				...mockItem,
				sourceUrl: "https://example.com/direct-link",
			}
			renderWithProviders(<MarketplaceItemCard {...defaultProps} item={itemWithSourceUrl} />)

			// Find the source button by its empty aria-label
			const button = screen.getByRole("button", {
				name: "", // Empty aria-label when sourceUrl is present
			})
			expect(button.querySelector(".codicon-link-external")).toBeInTheDocument()
			expect(button.textContent).toBe("") // Verify no text content
		})

		it("should show text label when sourceUrl is not present", () => {
			renderWithProviders(<MarketplaceItemCard {...defaultProps} />)

			// Find the source button by its aria-label
			const button = screen.getByRole("button", {
				name: "View",
			})
			expect(button.querySelector(".codicon-link-external")).toBeInTheDocument()
			expect(button).toHaveTextContent("View")
		})
	})

	describe("Details section", () => {
		it("should render expandable details section with correct count when item has no components", () => {
			const itemWithNoItems = { ...mockItem, items: [] }
			renderWithProviders(<MarketplaceItemCard {...defaultProps} item={itemWithNoItems} />)

			// The component uses t("marketplace:items.components", { count: 0 })
			expect(screen.getByText("0 components")).toBeInTheDocument()
		})

		it("should render expandable details section with correct count when item has components", () => {
			renderWithProviders(<MarketplaceItemCard {...defaultProps} />)

			// The component uses t("marketplace:items.components", { count: 2 })
			expect(screen.getByText("2 components")).toBeInTheDocument()
		})

		it("should not render details section when item has no subcomponents", () => {
			const itemWithoutItems = { ...mockItem, items: [] }
			renderWithProviders(<MarketplaceItemCard {...defaultProps} item={itemWithoutItems} />)

			expect(screen.queryByText("Component Details")).not.toBeInTheDocument()
		})

		it("should show grouped items when expanded", () => {
			renderWithProviders(<MarketplaceItemCard {...defaultProps} />)
			fireEvent.click(screen.getByText("2 components"))

			// These use the type-group translations
			expect(screen.getByText((content, element) => element?.textContent === "MCP Servers")).toBeInTheDocument()
			expect(screen.getByText((content, element) => element?.textContent === "Modes")).toBeInTheDocument()

			// Check for items using getByRole and textContent
			const items = screen.getAllByRole("listitem")
			expect(items[0]).toHaveTextContent("Test Server")
			expect(items[0]).toHaveTextContent("A test server")
			expect(items[1]).toHaveTextContent("Test Mode")
			expect(items[1]).toHaveTextContent("A test mode")
		})

		it("should maintain proper order of items within groups", () => {
			renderWithProviders(<MarketplaceItemCard {...defaultProps} />)
			fireEvent.click(screen.getByText("2 components"))

			const items = screen.getAllByRole("listitem")
			expect(items[0]).toHaveTextContent("Test Server")
			expect(items[1]).toHaveTextContent("Test Mode")
		})

		it("should show expandable section for package type", () => {
			const packageItem = { ...mockItem, type: "package" as const }
			renderWithProviders(<MarketplaceItemCard {...defaultProps} item={packageItem} />)

			expect(screen.getByText("2 components")).toBeInTheDocument()
		})

		it("should not show expandable section for mode type", () => {
			const modeItem = { ...mockItem, type: "mode" as const }
			renderWithProviders(<MarketplaceItemCard {...defaultProps} item={modeItem} />)

			expect(screen.queryByText("2 components")).not.toBeInTheDocument()
		})

		it("should not show expandable section for mcp server type", () => {
			const mcpServerItem = { ...mockItem, type: "mcp server" as const }
			renderWithProviders(<MarketplaceItemCard {...defaultProps} item={mcpServerItem} />)

			expect(screen.queryByText("2 components")).not.toBeInTheDocument()
		})
	})
})
