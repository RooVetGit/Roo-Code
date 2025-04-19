import React from "react"
import { render, fireEvent, screen } from "@testing-library/react"
import { MarketplaceSourcesConfig } from "../MarketplaceView"

// Mock the translation hook
jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key, // Return the key as-is for testing
	}),
}))

describe("MarketplaceSourcesConfig", () => {
	const mockOnSourcesChange = jest.fn()
	const mockOnRefreshSource = jest.fn()

	beforeEach(() => {
		jest.clearAllMocks()
	})

	test("should accept multi-part corporate git URLs", () => {
		render(
			<MarketplaceSourcesConfig
				sources={[]}
				refreshingUrls={[]}
				onSourcesChange={mockOnSourcesChange}
				onRefreshSource={mockOnRefreshSource}
			/>,
		)

		// Get the URL input
		const urlInput = screen.getByPlaceholderText("marketplace:sources.add.urlPlaceholder")

		// Type a multi-part corporate git URL
		const gitUrl = "git@git.lab.company.com:team-core/project-name.git"
		fireEvent.change(urlInput, { target: { value: gitUrl } })

		// Click the add button
		const addButton = screen.getByText("marketplace:sources.add.button")
		fireEvent.click(addButton)

		// Verify the source was added without validation errors
		expect(mockOnSourcesChange).toHaveBeenCalledWith([
			expect.objectContaining({
				url: gitUrl,
				enabled: true,
			}),
		])

		// Verify no error message is shown
		const errorElement = screen.queryByText("marketplace:sources.errors.invalidUrl")
		expect(errorElement).not.toBeInTheDocument()
	})
})
