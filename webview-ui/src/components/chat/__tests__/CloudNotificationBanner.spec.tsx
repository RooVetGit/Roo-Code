// npx vitest src/components/chat/__tests__/CloudNotificationBanner.spec.tsx

import { render, screen, fireEvent } from "@testing-library/react"
import { vi } from "vitest"

import { CloudNotificationBanner } from "../CloudNotificationBanner"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:cloudNotification.message":
					"This might take a while. Grab a coffee and continue from anywhere with Cloud.",
			}
			return translations[key] || key
		},
	}),
}))

// Mock vscode
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock utils
vi.mock("@src/lib/utils", () => ({
	cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}))

describe("CloudNotificationBanner", () => {
	const mockOnDismiss = vi.fn()
	const mockOnNavigateToAccount = vi.fn()

	const defaultProps = {
		onDismiss: mockOnDismiss,
		onNavigateToAccount: mockOnNavigateToAccount,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the notification banner with correct message", () => {
		render(<CloudNotificationBanner {...defaultProps} />)

		expect(
			screen.getByText("This might take a while. Grab a coffee and continue from anywhere with Cloud."),
		).toBeInTheDocument()
	})

	it("renders the close button", () => {
		render(<CloudNotificationBanner {...defaultProps} />)

		const closeButton = screen.getByRole("button", { name: "Close notification" })
		expect(closeButton).toBeInTheDocument()
	})

	it("calls onNavigateToAccount and onDismiss when banner is clicked", () => {
		render(<CloudNotificationBanner {...defaultProps} />)

		const banner = screen.getByText("This might take a while. Grab a coffee and continue from anywhere with Cloud.")
		fireEvent.click(banner)

		expect(mockOnNavigateToAccount).toHaveBeenCalledTimes(1)
		expect(mockOnDismiss).toHaveBeenCalledTimes(1)
	})

	it("calls onDismiss when close button is clicked", () => {
		render(<CloudNotificationBanner {...defaultProps} />)

		const closeButton = screen.getByRole("button", { name: "Close notification" })
		fireEvent.click(closeButton)

		expect(mockOnDismiss).toHaveBeenCalledTimes(1)
	})

	it("does not call onNavigateToAccount when close button is clicked", () => {
		render(<CloudNotificationBanner {...defaultProps} />)

		const closeButton = screen.getByRole("button", { name: "Close notification" })
		fireEvent.click(closeButton)

		expect(mockOnNavigateToAccount).not.toHaveBeenCalled()
	})

	it("applies custom className when provided", () => {
		const { container } = render(<CloudNotificationBanner {...defaultProps} className="custom-class" />)

		const bannerContainer = container.firstChild as HTMLElement
		expect(bannerContainer).toHaveClass("custom-class")
	})

	it("has proper speech bubble styling", () => {
		render(<CloudNotificationBanner {...defaultProps} />)

		// Check for the speech bubble triangle element
		const triangleElement = screen
			.getByText("This might take a while. Grab a coffee and continue from anywhere with Cloud.")
			.closest("div")
			?.parentElement?.querySelector("div")

		expect(triangleElement).toBeInTheDocument()
	})
})
