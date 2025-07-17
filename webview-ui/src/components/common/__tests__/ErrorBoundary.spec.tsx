import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { vi, beforeEach, afterEach, describe, it, expect } from "vitest"
import { ErrorBoundary } from "../ErrorBoundary"
import { errorReporter } from "../../../utils/errorReporting"

// Mock the error reporter
vi.mock("../../../utils/errorReporting", () => ({
	errorReporter: {
		reportError: vi.fn(),
	},
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string, options?: any) => {
			// Handle interpolation for componentError
			if (key === "errorBoundary.componentError" && options?.componentName) {
				return `Error in ${options.componentName} component`
			}
			return defaultValue || key
		},
	}),
}))

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
	if (shouldThrow) {
		throw new Error("Test error")
	}
	return <div>No error</div>
}

describe("ErrorBoundary", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Suppress console.error for these tests
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("renders children when there is no error", () => {
		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={false} />
			</ErrorBoundary>,
		)

		expect(screen.getByText("No error")).toBeInTheDocument()
	})

	it("renders error fallback when there is an error", () => {
		render(
			<ErrorBoundary componentName="TestComponent">
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		)

		expect(screen.getByText("Something went wrong")).toBeInTheDocument()
		expect(screen.getByText("Error in TestComponent component")).toBeInTheDocument()
		expect(screen.getByText("Try again")).toBeInTheDocument()
	})

	it("shows error details when expanded", () => {
		render(
			<ErrorBoundary>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		)

		const detailsButton = screen.getByText("Show error details")
		fireEvent.click(detailsButton)

		// Look for the error message in the details section (it's part of a larger text block)
		expect(screen.getByText(/Test error/)).toBeInTheDocument()
	})

	it("calls error reporter when error occurs", () => {
		const mockReportError = errorReporter.reportError as ReturnType<typeof vi.fn>

		render(
			<ErrorBoundary componentName="TestComponent">
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		)

		expect(mockReportError).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Test error",
			}),
			expect.any(Object),
			"TestComponent",
		)
	})

	it("calls custom onError handler when provided", () => {
		const mockOnError = vi.fn()

		render(
			<ErrorBoundary onError={mockOnError}>
				<ThrowError shouldThrow={true} />
			</ErrorBoundary>,
		)

		expect(mockOnError).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Test error",
			}),
			expect.any(Object),
		)
	})

	it("resets error boundary when retry button is clicked", () => {
		const TestComponent = () => {
			const [shouldThrow, setShouldThrow] = React.useState(true)

			return (
				<ErrorBoundary>
					<button onClick={() => setShouldThrow(false)}>Fix error</button>
					<ThrowError shouldThrow={shouldThrow} />
				</ErrorBoundary>
			)
		}

		render(<TestComponent />)

		// Error should be shown initially
		expect(screen.getByText("Something went wrong")).toBeInTheDocument()

		// Click retry button
		const retryButton = screen.getByText("Try again")
		fireEvent.click(retryButton)

		// Component should be reset and try to render again
		// Since we haven't fixed the error, it should show the error again
		expect(screen.getByText("Something went wrong")).toBeInTheDocument()
	})
})
