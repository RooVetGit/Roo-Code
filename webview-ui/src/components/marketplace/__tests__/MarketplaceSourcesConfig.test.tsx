import { render, fireEvent, screen } from "@testing-library/react"
import { MarketplaceSourcesConfig } from "../MarketplaceSourcesConfigView"
import { MarketplaceViewStateManager } from "../MarketplaceViewStateManager"

// Mock the translation hook
jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key, // Return the key as-is for testing
	}),
}))

describe("MarketplaceSourcesConfig", () => {
	let stateManager: MarketplaceViewStateManager

	beforeEach(() => {
		stateManager = new MarketplaceViewStateManager()
		// Reset state manager to have no sources
		stateManager.transition({
			type: "UPDATE_SOURCES",
			payload: { sources: [] },
		})
		jest.clearAllMocks()
	})

	it("shows source count", () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const countElement = screen.getByText((content) => content.includes("/ 10"))
		expect(countElement).toBeInTheDocument()
	})

	it("adds a new source with URL only", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		const testUrl = "https://github.com/test/repo-1"
		fireEvent.change(urlInput, { target: { value: testUrl } })

		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)

		const sources = stateManager.getState().sources
		const newSource = sources.find((s) => s.url === testUrl)
		expect(newSource).toEqual({
			url: testUrl,
			enabled: true,
		})
	})

	it("adds a new source with URL and name", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		const testUrl = "https://github.com/test/repo-2"

		fireEvent.change(nameInput, { target: { value: "Test Source" } })
		fireEvent.change(urlInput, { target: { value: testUrl } })

		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)

		const sources = stateManager.getState().sources
		const newSource = sources.find((s) => s.url === testUrl)
		expect(newSource).toEqual({
			url: testUrl,
			name: "Test Source",
			enabled: true,
		})
	})

	it("shows error when URL is empty", () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)

		const errorElement = screen.getByText("marketplace:sources.errors.invalidGitUrl")
		expect(errorElement).toBeInTheDocument()
	})

	it("shows error when max sources reached", () => {
		// Add max number of sources with unique URLs
		const maxSources = Array(10)
			.fill(null)
			.map((_, i) => ({
				url: `https://github.com/test/repo-${i}`,
				enabled: true,
			}))

		stateManager.transition({
			type: "UPDATE_SOURCES",
			payload: { sources: maxSources },
		})

		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		fireEvent.change(urlInput, { target: { value: "https://github.com/test/new" } })

		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)

		const errorElement = screen.getByText("marketplace:sources.errors.maxSources")
		expect(errorElement).toBeInTheDocument()
	})

	it("accepts multi-part corporate git URLs", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		const gitUrl = "git@git.lab.company.com:team-core/project-name.git"
		fireEvent.change(urlInput, { target: { value: gitUrl } })

		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)

		const sources = stateManager.getState().sources
		const newSource = sources.find((s) => s.url === gitUrl)
		expect(newSource).toEqual({
			url: gitUrl,
			enabled: true,
		})
	})

	it("toggles source enabled state", () => {
		const testUrl = "https://github.com/test/repo-3"
		stateManager.transition({
			type: "UPDATE_SOURCES",
			payload: {
				sources: [
					{
						url: testUrl,
						enabled: true,
					},
				],
			},
		})

		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const checkbox = screen.getByRole("checkbox", { name: "" })
		fireEvent.click(checkbox)

		const sources = stateManager.getState().sources
		const updatedSource = sources.find((s) => s.url === testUrl)
		expect(updatedSource?.enabled).toBe(false)
	})

	it("removes a source", () => {
		const testUrl = "https://github.com/test/repo-4"
		stateManager.transition({
			type: "UPDATE_SOURCES",
			payload: {
				sources: [
					{
						url: testUrl,
						enabled: true,
					},
				],
			},
		})

		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const removeButtons = screen.getAllByTitle("marketplace:sources.current.remove")
		fireEvent.click(removeButtons[0])

		const sources = stateManager.getState().sources
		expect(sources.find((s) => s.url === testUrl)).toBeUndefined()
	})

	it("refreshes a source", () => {
		const testUrl = "https://github.com/test/repo-5"
		stateManager.transition({
			type: "UPDATE_SOURCES",
			payload: {
				sources: [
					{
						url: testUrl,
						enabled: true,
					},
				],
			},
		})

		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const refreshButtons = screen.getAllByTitle("marketplace:sources.current.refresh")
		fireEvent.click(refreshButtons[0])

		expect(stateManager.getState().refreshingUrls).toContain(testUrl)
	})

	it("limits source name to 20 characters", () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		const longName = "This is a very long source name that exceeds limit"
		fireEvent.change(nameInput, { target: { value: longName } })

		// The component should truncate to 20 chars
		expect(nameInput).toHaveValue(longName.slice(0, 20))
	})

	it("shows character count for source name", () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		fireEvent.change(nameInput, { target: { value: "Test Source" } })

		expect(screen.getByText("11/20")).toBeInTheDocument()
	})

	it("clears inputs after adding source", () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		const testUrl = "https://github.com/test/repo-6"

		fireEvent.change(nameInput, { target: { value: "Test Source" } })
		fireEvent.change(urlInput, { target: { value: testUrl } })

		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)

		expect(nameInput).toHaveValue("")
		expect(urlInput).toHaveValue("")
	})
})
