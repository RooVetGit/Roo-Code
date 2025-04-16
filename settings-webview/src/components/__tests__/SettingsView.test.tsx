import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import SettingsView from "../SettingsView"

describe("SettingsView", () => {
	it("renders the settings categories in the sidebar", () => {
		render(<SettingsView />)

		// Check that all categories are rendered in the sidebar
		const sidebar = screen.getByRole("button", { name: /general/i }).closest("div")?.parentElement
		expect(sidebar).toBeInTheDocument()

		// Verify all category buttons are present
		expect(screen.getByRole("button", { name: /general/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /permissions/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /browser/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /checkpoints/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /context management/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /terminal/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /advanced/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /experimental/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /about/i })).toBeInTheDocument()
	})

	it("shows the content for the selected category", () => {
		render(<SettingsView />)

		// Initially shows General content
		expect(screen.getByText(/settings content for general will be implemented here/i)).toBeInTheDocument()

		// Click on Advanced category
		fireEvent.click(screen.getByRole("button", { name: /advanced/i }))

		// Should now show Advanced content
		expect(screen.getByText(/settings content for advanced will be implemented here/i)).toBeInTheDocument()
	})
})
