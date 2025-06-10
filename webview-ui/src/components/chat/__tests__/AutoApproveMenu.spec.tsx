import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import AutoApproveMenu from "../AutoApproveMenu"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

// Mock dependencies
jest.mock("@src/context/ExtensionStateContext")
jest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

jest.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: jest.fn((key: string) => {
			const translations: Record<string, string> = {
				"chat:autoApprove.title": "Auto Approve",
				"chat:autoApprove.none": "None",
				"chat:autoApprove.description": "Auto-approve certain actions",
				"settings:autoApprove.readOnly.label": "Read-only",
				"settings:autoApprove.write.label": "Write files",
				"settings:autoApprove.execute.label": "Execute",
				"settings:autoApprove.browser.label": "Browser",
				"settings:autoApprove.mcp.label": "MCP",
				"settings:autoApprove.modeSwitch.label": "Mode Switch",
				"settings:autoApprove.subtasks.label": "Subtasks",
				"settings:autoApprove.retry.label": "Retry",
				"settings:autoApprove.apiRequestLimit.title": "API Request Limit",
				"settings:autoApprove.apiRequestLimit.unlimited": "Unlimited",
				"settings:autoApprove.apiRequestLimit.description": "Maximum number of API requests",
			}
			return translations[key] || key
		}),
	}),
}))

jest.mock("react-i18next", () => ({
	Trans: ({ i18nKey, children }: { i18nKey?: string; children?: React.ReactNode }) => {
		const translations: Record<string, string> = {
			"chat:autoApprove.description": "Auto-approve certain actions",
		}
		return <div>{translations[i18nKey as string] || children}</div>
	},
}))

// Mock useExtensionState
const mockUseExtensionState = jest.mocked(useExtensionState)

describe("AutoApproveMenu", () => {
	const defaultState = {
		autoApprovalEnabled: false,
		alwaysAllowReadOnly: false,
		alwaysAllowWrite: false,
		alwaysAllowExecute: false,
		alwaysAllowBrowser: false,
		alwaysAllowMcp: false,
		alwaysAllowModeSwitch: false,
		alwaysAllowSubtasks: false,
		alwaysApproveResubmit: false,
		allowedMaxRequests: undefined,
	}

	const mockSetters = {
		setAutoApprovalEnabled: jest.fn(),
		setAlwaysAllowReadOnly: jest.fn(),
		setAlwaysAllowWrite: jest.fn(),
		setAlwaysAllowExecute: jest.fn(),
		setAlwaysAllowBrowser: jest.fn(),
		setAlwaysAllowMcp: jest.fn(),
		setAlwaysAllowModeSwitch: jest.fn(),
		setAlwaysAllowSubtasks: jest.fn(),
		setAlwaysApproveResubmit: jest.fn(),
		setAllowedMaxRequests: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
		mockUseExtensionState.mockReturnValue({
			...defaultState,
			...mockSetters,
		} as any)
	})

	describe("Initial state", () => {
		it("should show 'None' when no auto-approve settings are enabled", () => {
			render(<AutoApproveMenu />)
			expect(screen.getByText("None")).toBeInTheDocument()
		})

		it("should have unchecked main checkbox when no settings are enabled", () => {
			render(<AutoApproveMenu />)
			const mainCheckbox = screen.getByRole("checkbox")
			expect(mainCheckbox).not.toBeChecked()
		})
	})

	describe("Individual toggle enables main checkbox", () => {
		it("should enable main checkbox when first individual toggle is enabled", async () => {
			const { rerender } = render(<AutoApproveMenu />)

			// Initially unchecked
			expect(screen.getByRole("checkbox")).not.toBeChecked()

			// Simulate enabling read-only toggle
			mockUseExtensionState.mockReturnValue({
				...defaultState,
				alwaysAllowReadOnly: true,
				...mockSetters,
			} as any)

			rerender(<AutoApproveMenu />)

			// Main checkbox should now be checked
			expect(screen.getByRole("checkbox")).toBeChecked()
			expect(screen.getByText("Read-only")).toBeInTheDocument()
		})

		it("should show enabled actions in display text", () => {
			mockUseExtensionState.mockReturnValue({
				...defaultState,
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: true,
				...mockSetters,
			} as any)

			render(<AutoApproveMenu />)

			expect(screen.getByText("Read-only, Write files")).toBeInTheDocument()
		})
	})

	describe("Main checkbox toggle behavior", () => {
		it("should enable all toggles when main checkbox is clicked (none enabled)", async () => {
			render(<AutoApproveMenu />)

			const mainCheckbox = screen.getByRole("checkbox")
			fireEvent.click(mainCheckbox)

			// Should call setters for all individual toggles with true
			await waitFor(() => {
				expect(mockSetters.setAlwaysAllowReadOnly).toHaveBeenCalledWith(true)
				expect(mockSetters.setAlwaysAllowWrite).toHaveBeenCalledWith(true)
				expect(mockSetters.setAlwaysAllowExecute).toHaveBeenCalledWith(true)
				expect(mockSetters.setAlwaysAllowBrowser).toHaveBeenCalledWith(true)
				expect(mockSetters.setAlwaysAllowMcp).toHaveBeenCalledWith(true)
				expect(mockSetters.setAlwaysAllowModeSwitch).toHaveBeenCalledWith(true)
				expect(mockSetters.setAlwaysAllowSubtasks).toHaveBeenCalledWith(true)
				expect(mockSetters.setAlwaysApproveResubmit).toHaveBeenCalledWith(true)
			})

			// Should send vscode messages for all toggles
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "alwaysAllowReadOnly", bool: true })
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "alwaysAllowWrite", bool: true })
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "autoApprovalEnabled", bool: true })
		})

		it("should disable all toggles when main checkbox is clicked (some enabled)", async () => {
			mockUseExtensionState.mockReturnValue({
				...defaultState,
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: true,
				...mockSetters,
			} as any)

			render(<AutoApproveMenu />)

			const mainCheckbox = screen.getByRole("checkbox")
			fireEvent.click(mainCheckbox)

			// Should call setters for all individual toggles with false
			await waitFor(() => {
				expect(mockSetters.setAlwaysAllowReadOnly).toHaveBeenCalledWith(false)
				expect(mockSetters.setAlwaysAllowWrite).toHaveBeenCalledWith(false)
				expect(mockSetters.setAlwaysAllowExecute).toHaveBeenCalledWith(false)
				expect(mockSetters.setAlwaysAllowBrowser).toHaveBeenCalledWith(false)
				expect(mockSetters.setAlwaysAllowMcp).toHaveBeenCalledWith(false)
				expect(mockSetters.setAlwaysAllowModeSwitch).toHaveBeenCalledWith(false)
				expect(mockSetters.setAlwaysAllowSubtasks).toHaveBeenCalledWith(false)
				expect(mockSetters.setAlwaysApproveResubmit).toHaveBeenCalledWith(false)
			})

			// Should send vscode messages for all toggles with false
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "alwaysAllowReadOnly", bool: false })
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "autoApprovalEnabled", bool: false })
		})
	})

	describe("Bidirectional state synchronization", () => {
		it("should disable main auto-approval when last individual toggle is disabled", async () => {
			// Start with only one toggle enabled
			mockUseExtensionState.mockReturnValue({
				...defaultState,
				alwaysAllowReadOnly: true,
				...mockSetters,
			} as any)

			const { rerender } = render(<AutoApproveMenu />)

			// Expand to show individual toggles
			fireEvent.click(screen.getByText("Auto Approve"))

			// Simulate disabling the last toggle
			mockUseExtensionState.mockReturnValue({
				...defaultState,
				alwaysAllowReadOnly: false,
				...mockSetters,
			} as any)

			rerender(<AutoApproveMenu />)

			// Main checkbox should now be unchecked
			expect(screen.getByRole("checkbox")).not.toBeChecked()
			expect(screen.getByText("None")).toBeInTheDocument()
		})

		it("should enable main auto-approval when any individual toggle is enabled", async () => {
			const { rerender } = render(<AutoApproveMenu />)

			// Initially no toggles enabled
			expect(screen.getByRole("checkbox")).not.toBeChecked()

			// Simulate enabling one toggle
			mockUseExtensionState.mockReturnValue({
				...defaultState,
				alwaysAllowExecute: true,
				...mockSetters,
			} as any)

			rerender(<AutoApproveMenu />)

			// Main checkbox should now be checked
			expect(screen.getByRole("checkbox")).toBeChecked()
			expect(screen.getByText("Execute")).toBeInTheDocument()
		})
	})

	describe("Expandable behavior", () => {
		it("should expand and show individual toggles when clicked", () => {
			render(<AutoApproveMenu />)

			// Initially collapsed - description should not be visible
			expect(screen.queryByText(/Auto-approve certain actions/)).not.toBeInTheDocument()

			// Click to expand
			fireEvent.click(screen.getByText("Auto Approve"))

			// Should show description (indicating expanded state)
			expect(screen.getByText(/Auto-approve certain actions/)).toBeInTheDocument()
		})

		it("should show correct chevron direction when expanded/collapsed", () => {
			render(<AutoApproveMenu />)

			// Initially should show right chevron
			expect(document.querySelector(".codicon-chevron-right")).toBeInTheDocument()

			// Click to expand
			fireEvent.click(screen.getByText("Auto Approve"))

			// Should show down chevron
			expect(document.querySelector(".codicon-chevron-down")).toBeInTheDocument()
		})
	})

	describe("API request limit", () => {
		it("should show unlimited placeholder when no limit is set", () => {
			render(<AutoApproveMenu />)

			// Expand to show settings
			fireEvent.click(screen.getByText("Auto Approve"))

			const input = screen.getByPlaceholderText("Unlimited")
			expect(input).toHaveValue("")
		})

		it("should handle numeric input for API request limit", async () => {
			render(<AutoApproveMenu />)

			// Expand to show settings
			fireEvent.click(screen.getByText("Auto Approve"))

			const input = screen.getByPlaceholderText("Unlimited")
			fireEvent.input(input, { target: { value: "10" } })

			await waitFor(() => {
				expect(mockSetters.setAllowedMaxRequests).toHaveBeenCalledWith(10)
				expect(vscode.postMessage).toHaveBeenCalledWith({ type: "allowedMaxRequests", value: 10 })
			})
		})

		it("should filter out non-numeric characters", async () => {
			render(<AutoApproveMenu />)

			// Expand to show settings
			fireEvent.click(screen.getByText("Auto Approve"))

			const input = screen.getByPlaceholderText("Unlimited") as HTMLInputElement

			// Mock the input value behavior
			let inputValue = "abc123def"
			Object.defineProperty(input, "value", {
				get() {
					return inputValue
				},
				set(val) {
					inputValue = val.replace(/[^0-9]/g, "")
				},
			})

			// Simulate the input event with the filtered behavior
			fireEvent.input(input, { target: { value: "abc123def" } })

			await waitFor(() => {
				expect(mockSetters.setAllowedMaxRequests).toHaveBeenCalledWith(123)
				expect(vscode.postMessage).toHaveBeenCalledWith({ type: "allowedMaxRequests", value: 123 })
			})
		})
	})
})
