import { render, fireEvent, screen, waitFor } from "@testing-library/react"
import { MarketplaceSourcesConfig } from "../MarketplaceSourcesConfigView"
import { MarketplaceViewStateManager } from "../MarketplaceViewStateManager"
import { validateSource, ValidationError } from "@roo/shared/MarketplaceValidation"

// Mock the translation hook
jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key, // Return the key as-is for testing
	}),
}))

// Mock the validateSource function
jest.mock("@roo/shared/MarketplaceValidation", () => ({
	validateSource: jest.fn(),
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
		// Default mock implementation for validateSource
		;(validateSource as jest.Mock).mockReturnValue([])
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

	it("shows error when URL is empty on add (via client-side validation)", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		fireEvent.change(urlInput, { target: { value: "" } }) // Set URL to empty
		fireEvent.blur(urlInput) // Trigger blur to activate client-side validation

		// This error is displayed as a field-specific error message
		const errorMessage = await screen.findByText("marketplace:sources.errors.emptyUrl", {
			selector: "p.text-xs.text-red-500",
		})
		expect(errorMessage).toBeInTheDocument()
	})

	it("shows error when URL is empty on blur", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")

		fireEvent.change(urlInput, { target: { value: "some-url" } })
		fireEvent.blur(urlInput)
		await waitFor(() => {
			expect(
				screen.queryByText("marketplace:sources.errors.emptyUrl", { selector: "p.text-xs.text-red-500" }),
			).not.toBeInTheDocument()
		})

		fireEvent.change(urlInput, { target: { value: "" } })
		fireEvent.blur(urlInput)
		await waitFor(() => {
			expect(
				screen.getByText("marketplace:sources.errors.emptyUrl", { selector: "p.text-xs.text-red-500" }),
			).toBeInTheDocument()
		})
	})

	it("shows error when max sources reached", async () => {
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

		await waitFor(() => {
			const errorMessage = screen.getByText("marketplace:sources.errors.maxSources")
			expect(errorMessage).toHaveClass("text-red-500", "p-2", "bg-red-100")
		})
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

	it("clears inputs after adding source", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)

		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		const testUrl = "https://github.com/test/repo-6"

		fireEvent.change(nameInput, { target: { value: "Test Source" } })
		fireEvent.change(urlInput, { target: { value: testUrl } })

		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)

		await waitFor(() => {
			expect(nameInput).toHaveValue("")
			expect(urlInput).toHaveValue("")
		})
	})

	it("shows error when name is too long on change", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		fireEvent.change(nameInput, { target: { value: "This name is way too long for the input field" } })
		await waitFor(() => {
			expect(
				screen.getByText("marketplace:sources.errors.nameTooLong", { selector: "p.text-xs.text-red-500" }),
			).toBeInTheDocument()
		})
	})

	it("shows error when name contains emoji on change", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		fireEvent.change(nameInput, { target: { value: "Name with emoji 🚀" } })
		await waitFor(() => {
			expect(
				screen.getByText("marketplace:sources.errors.emojiName", { selector: "p.text-xs.text-red-500" }),
			).toBeInTheDocument()
		})
	})

	it("shows error when URL is invalid after validation", async () => {
		;(validateSource as jest.Mock).mockReturnValue([{ field: "url", message: "invalid" } as ValidationError])
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		fireEvent.change(urlInput, { target: { value: "invalid-url" } })
		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)
		await waitFor(() => {
			const errorMessages = screen.queryAllByText("marketplace:sources.errors.invalidGitUrl")
			const fieldErrorMessage = errorMessages.find((el) => el.classList.contains("text-xs"))
			expect(fieldErrorMessage).toBeInTheDocument()
		})
	})

	it("shows error when URL is a duplicate after validation", async () => {
		stateManager.transition({
			type: "UPDATE_SOURCES",
			payload: { sources: [{ url: "https://github.com/existing/repo", enabled: true }] },
		})
		;(validateSource as jest.Mock).mockReturnValue([{ field: "url", message: "duplicate" } as ValidationError])
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		fireEvent.change(urlInput, { target: { value: "https://github.com/existing/repo" } })
		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)
		await waitFor(() => {
			const errorMessages = screen.queryAllByText("marketplace:sources.errors.duplicateUrl")
			const fieldErrorMessage = errorMessages.find((el) => el.classList.contains("text-xs"))
			expect(fieldErrorMessage).toBeInTheDocument()
		})
	})

	it("shows error when name is a duplicate after validation", async () => {
		stateManager.transition({
			type: "UPDATE_SOURCES",
			payload: { sources: [{ name: "Existing Name", url: "https://github.com/existing/repo", enabled: true }] },
		})
		;(validateSource as jest.Mock).mockReturnValue([{ field: "name", message: "duplicate" } as ValidationError])
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		fireEvent.change(nameInput, { target: { value: "Existing Name" } })
		fireEvent.change(urlInput, { target: { value: "https://github.com/new/repo" } })
		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)
		await waitFor(() => {
			const errorMessages = screen.queryAllByText("marketplace:sources.errors.duplicateName")
			const fieldErrorMessage = errorMessages.find((el) => el.classList.contains("text-xs"))
			expect(fieldErrorMessage).toBeInTheDocument()
		})
	})

	it("disables add button when name has error", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const nameInput = screen.getByPlaceholderText("marketplace:sources.add.namePlaceholder")
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		const addButton = screen.getByText("marketplace:sources.add.button")

		fireEvent.change(nameInput, { target: { value: "This name is way too long for the input field" } })
		fireEvent.change(urlInput, { target: { value: "https://valid.com/repo" } })

		await waitFor(() => {
			expect(addButton).toBeDisabled()
		})
	})

	it("disables add button when URL is empty", async () => {
		render(<MarketplaceSourcesConfig stateManager={stateManager} />)
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")
		const addButton = screen.getByText("marketplace:sources.add.button")

		fireEvent.change(urlInput, { target: { value: "" } })

		await waitFor(() => {
			expect(addButton).toBeDisabled()
		})
	})
})
