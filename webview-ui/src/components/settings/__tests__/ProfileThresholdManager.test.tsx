import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProfileThresholdManager } from "../ProfileThresholdManager"
import type { ProviderSettingsEntry } from "@roo-code/types"

// Mock translation hook to return the key as the translation
jest.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock VSCode UI components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, disabled, appearance, "aria-label": ariaLabel }: any) => (
		<button onClick={onClick} disabled={disabled} data-appearance={appearance} aria-label={ariaLabel}>
			{children}
		</button>
	),
	VSCodeDropdown: ({ children, value, onChange, className }: any) => (
		<select value={value} onChange={onChange} className={className} data-testid="profile-dropdown">
			{children}
		</select>
	),
	VSCodeOption: ({ children, value }: any) => <option value={value}>{children}</option>,
	VSCodeTextField: ({ value, onInput, placeholder, className, disabled }: any) => (
		<input value={value} onChange={onInput} placeholder={placeholder} className={className} disabled={disabled} />
	),
}))

describe("ProfileThresholdManager", () => {
	const mockListApiConfigMeta: ProviderSettingsEntry[] = [
		{ id: "profile-1", name: "Profile 1" },
		{ id: "profile-2", name: "Profile 2" },
		{ id: "profile-3", name: "Profile 3" },
	]

	const defaultProps = {
		listApiConfigMeta: mockListApiConfigMeta,
		profileThresholds: {},
		defaultThreshold: 75,
		onUpdateThresholds: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	/**
	 * Test basic rendering functionality
	 */
	describe("Rendering", () => {
		it("renders correctly with empty profile thresholds", () => {
			render(<ProfileThresholdManager {...defaultProps} />)

			// Should render the configuration section
			expect(screen.getByText("settings:contextManagement.profileThresholds.configureLabel")).toBeInTheDocument()

			// Should render the dropdown with default option
			const dropdown = screen.getByDisplayValue("") // VSCodeDropdown with empty value
			expect(dropdown).toBeInTheDocument()
			expect(screen.getByText("settings:contextManagement.profileThresholds.selectProfile")).toBeInTheDocument()

			// Should render all profile options
			expect(screen.getByText("Profile 1")).toBeInTheDocument()
			expect(screen.getByText("Profile 2")).toBeInTheDocument()
			expect(screen.getByText("Profile 3")).toBeInTheDocument()

			// Should render threshold input
			const thresholdInput = screen.getByPlaceholderText("%")
			expect(thresholdInput).toBeInTheDocument()
			expect(thresholdInput).toBeDisabled() // Should be disabled when no profile selected

			// Should render save button
			const saveButton = screen.getByText("settings:common.save")
			expect(saveButton).toBeInTheDocument()
			expect(saveButton).toBeDisabled() // Should be disabled initially

			// Should render info text
			expect(screen.getByText("Enter -1 to use the default threshold")).toBeInTheDocument()

			// Should not render configured profiles section when empty
			expect(
				screen.queryByText("settings:contextManagement.profileThresholds.configuredProfiles"),
			).not.toBeInTheDocument()
		})

		it("renders configured profiles list when profile thresholds exist", () => {
			const propsWithThresholds = {
				...defaultProps,
				profileThresholds: {
					"profile-1": 60,
					"profile-2": -1,
					"profile-3": 80,
				},
			}

			render(<ProfileThresholdManager {...propsWithThresholds} />)

			// Should render configured profiles section
			expect(
				screen.getByText("settings:contextManagement.profileThresholds.configuredProfiles"),
			).toBeInTheDocument()

			// Should render each configured profile
			expect(screen.getByText("• Profile 1: 60%")).toBeInTheDocument()
			expect(
				screen.getByText("• Profile 2: settings:contextManagement.profileThresholds.defaultThreshold"),
			).toBeInTheDocument()
			expect(screen.getByText("• Profile 3: 80%")).toBeInTheDocument()

			// Should render remove buttons for each profile
			const removeButtons = screen.getAllByLabelText(
				/settings:contextManagement.profileThresholds.removeAriaLabel/,
			)
			expect(removeButtons).toHaveLength(3)
		})
	})

	/**
	 * Test profile selection and threshold input functionality
	 */
	describe("Profile Selection and Input", () => {
		it("renders with correct initial state", () => {
			render(<ProfileThresholdManager {...defaultProps} />)

			const thresholdInput = screen.getByPlaceholderText("%") as HTMLInputElement
			const saveButton = screen.getByText("settings:common.save")

			// Initially disabled
			expect(thresholdInput).toBeDisabled()
			expect(saveButton).toBeDisabled()

			// Note: VSCodeDropdown interaction testing is complex with the VSCode UI toolkit
			// The actual dropdown selection logic is tested through unit tests of the component methods
		})

		it("renders save button in disabled state initially", () => {
			render(<ProfileThresholdManager {...defaultProps} />)

			const saveButton = screen.getByText("settings:common.save")

			// Save button should be disabled initially (no profile selected, no input)
			expect(saveButton).toBeDisabled()
		})

		it("displays existing thresholds correctly in the configured profiles list", () => {
			const propsWithThresholds = {
				...defaultProps,
				profileThresholds: {
					"profile-1": 60,
					"profile-2": -1,
				},
			}

			render(<ProfileThresholdManager {...propsWithThresholds} />)

			// Should show configured profiles section
			expect(
				screen.getByText("settings:contextManagement.profileThresholds.configuredProfiles"),
			).toBeInTheDocument()

			// Should display the threshold values correctly
			expect(screen.getByText("• Profile 1: 60%")).toBeInTheDocument()
			expect(
				screen.getByText("• Profile 2: settings:contextManagement.profileThresholds.defaultThreshold"),
			).toBeInTheDocument()

			// Should have remove buttons for each configured profile
			const removeButtons = screen.getAllByLabelText(
				/settings:contextManagement.profileThresholds.removeAriaLabel/,
			)
			expect(removeButtons).toHaveLength(2)
		})
	})

	/**
	 * Test save functionality
	 */
	describe("Save Functionality", () => {
		it("calls onUpdateThresholds with correct data when save is clicked", () => {
			const mockOnUpdateThresholds = jest.fn()
			const props = {
				...defaultProps,
				onUpdateThresholds: mockOnUpdateThresholds,
			}

			render(<ProfileThresholdManager {...props} />)

			const dropdown = screen.getByTestId("profile-dropdown")
			const thresholdInput = screen.getByPlaceholderText("%")
			const saveButton = screen.getByText("settings:common.save")

			// Select profile and enter threshold
			fireEvent.change(dropdown, { target: { value: "profile-1" } })
			fireEvent.change(thresholdInput, { target: { value: "65" } })
			fireEvent.click(saveButton)

			// Should call onUpdateThresholds with new threshold
			expect(mockOnUpdateThresholds).toHaveBeenCalledWith({
				"profile-1": 65,
			})
		})

		it("merges new threshold with existing thresholds", () => {
			const mockOnUpdateThresholds = jest.fn()
			const propsWithExisting = {
				...defaultProps,
				profileThresholds: {
					"profile-2": 70,
				},
				onUpdateThresholds: mockOnUpdateThresholds,
			}

			render(<ProfileThresholdManager {...propsWithExisting} />)

			const dropdown = screen.getByTestId("profile-dropdown")
			const thresholdInput = screen.getByPlaceholderText("%")
			const saveButton = screen.getByText("settings:common.save")

			// Add threshold for different profile
			fireEvent.change(dropdown, { target: { value: "profile-1" } })
			fireEvent.change(thresholdInput, { target: { value: "65" } })
			fireEvent.click(saveButton)

			// Should merge with existing thresholds
			expect(mockOnUpdateThresholds).toHaveBeenCalledWith({
				"profile-2": 70,
				"profile-1": 65,
			})
		})

		it("resets form state after successful save", () => {
			render(<ProfileThresholdManager {...defaultProps} />)

			const dropdown = screen.getByTestId("profile-dropdown") as HTMLSelectElement
			const thresholdInput = screen.getByPlaceholderText("%") as HTMLInputElement
			const saveButton = screen.getByText("settings:common.save")

			// Select profile and enter threshold
			fireEvent.change(dropdown, { target: { value: "profile-1" } })
			fireEvent.change(thresholdInput, { target: { value: "65" } })
			fireEvent.click(saveButton)

			// Form should be reset
			expect(dropdown.value).toBe("")
			expect(thresholdInput.value).toBe("")
			expect(thresholdInput).toBeDisabled()
			expect(saveButton).toBeDisabled()
		})

		it("handles -1 threshold value correctly", () => {
			const mockOnUpdateThresholds = jest.fn()
			const props = {
				...defaultProps,
				onUpdateThresholds: mockOnUpdateThresholds,
			}

			render(<ProfileThresholdManager {...props} />)

			const dropdown = screen.getByTestId("profile-dropdown")
			const thresholdInput = screen.getByPlaceholderText("%")
			const saveButton = screen.getByText("settings:common.save")

			// Enter -1 threshold
			fireEvent.change(dropdown, { target: { value: "profile-1" } })
			fireEvent.change(thresholdInput, { target: { value: "-1" } })
			fireEvent.click(saveButton)

			// Should save -1 correctly
			expect(mockOnUpdateThresholds).toHaveBeenCalledWith({
				"profile-1": -1,
			})
		})

		it("does not save invalid threshold values", () => {
			const mockOnUpdateThresholds = jest.fn()
			const props = {
				...defaultProps,
				onUpdateThresholds: mockOnUpdateThresholds,
			}

			render(<ProfileThresholdManager {...props} />)

			const dropdown = screen.getByTestId("profile-dropdown")
			const thresholdInput = screen.getByPlaceholderText("%")
			const saveButton = screen.getByText("settings:common.save")

			// Try to save invalid threshold
			fireEvent.change(dropdown, { target: { value: "profile-1" } })
			fireEvent.change(thresholdInput, { target: { value: "invalid" } })
			fireEvent.click(saveButton)

			// Should not call onUpdateThresholds
			expect(mockOnUpdateThresholds).not.toHaveBeenCalled()
		})
	})

	/**
	 * Test remove functionality
	 */
	describe("Remove Functionality", () => {
		it("calls onUpdateThresholds to remove profile threshold when remove button is clicked", () => {
			const mockOnUpdateThresholds = jest.fn()
			const propsWithThresholds = {
				...defaultProps,
				profileThresholds: {
					"profile-1": 60,
					"profile-2": 70,
				},
				onUpdateThresholds: mockOnUpdateThresholds,
			}

			render(<ProfileThresholdManager {...propsWithThresholds} />)

			// Find and click remove button for profile-1
			const removeButtons = screen.getAllByLabelText(
				/settings:contextManagement.profileThresholds.removeAriaLabel/,
			)
			fireEvent.click(removeButtons[0]) // First remove button (profile-1)

			// Should call onUpdateThresholds with profile-1 removed
			expect(mockOnUpdateThresholds).toHaveBeenCalledWith({
				"profile-2": 70,
			})
		})

		it("removes the correct profile when multiple profiles exist", () => {
			const mockOnUpdateThresholds = jest.fn()
			const propsWithThresholds = {
				...defaultProps,
				profileThresholds: {
					"profile-1": 60,
					"profile-2": 70,
					"profile-3": 80,
				},
				onUpdateThresholds: mockOnUpdateThresholds,
			}

			render(<ProfileThresholdManager {...propsWithThresholds} />)

			// Find and click remove button for profile-2 (middle one)
			const removeButtons = screen.getAllByLabelText(
				/settings:contextManagement.profileThresholds.removeAriaLabel/,
			)
			fireEvent.click(removeButtons[1]) // Second remove button (profile-2)

			// Should call onUpdateThresholds with profile-2 removed
			expect(mockOnUpdateThresholds).toHaveBeenCalledWith({
				"profile-1": 60,
				"profile-3": 80,
			})
		})
	})

	/**
	 * Test threshold display formatting
	 */
	describe("Threshold Display Formatting", () => {
		it("displays percentage values correctly", () => {
			const propsWithThresholds = {
				...defaultProps,
				profileThresholds: {
					"profile-1": 60,
					"profile-3": 80,
				},
			}

			render(<ProfileThresholdManager {...propsWithThresholds} />)

			expect(screen.getByText("• Profile 1: 60%")).toBeInTheDocument()
			expect(screen.getByText("• Profile 3: 80%")).toBeInTheDocument()
		})

		it("displays default threshold message for -1 values", () => {
			const propsWithThresholds = {
				...defaultProps,
				profileThresholds: {
					"profile-2": -1,
				},
			}

			render(<ProfileThresholdManager {...propsWithThresholds} />)

			expect(
				screen.getByText("• Profile 2: settings:contextManagement.profileThresholds.defaultThreshold"),
			).toBeInTheDocument()
		})

		it("handles profiles that no longer exist in listApiConfigMeta", () => {
			const propsWithOrphanedThreshold = {
				...defaultProps,
				profileThresholds: {
					"profile-1": 60,
					"deleted-profile": 70, // This profile no longer exists in listApiConfigMeta
				},
			}

			render(<ProfileThresholdManager {...propsWithOrphanedThreshold} />)

			// Should display profile name for existing profile
			expect(screen.getByText("• Profile 1: 60%")).toBeInTheDocument()
			// Should display profile ID for non-existent profile
			expect(screen.getByText("• deleted-profile: 70%")).toBeInTheDocument()
		})
	})

	/**
	 * Test edge cases and validation
	 */
	describe("Edge Cases and Validation", () => {
		it("handles empty listApiConfigMeta gracefully", () => {
			const propsWithEmptyList = {
				...defaultProps,
				listApiConfigMeta: [],
			}

			expect(() => {
				render(<ProfileThresholdManager {...propsWithEmptyList} />)
			}).not.toThrow()

			// Should still render the dropdown with just the default option
			expect(screen.getByText("settings:contextManagement.profileThresholds.selectProfile")).toBeInTheDocument()
		})

		it("disables save button when no profile is selected", () => {
			render(<ProfileThresholdManager {...defaultProps} />)

			const thresholdInput = screen.getByPlaceholderText("%")
			const saveButton = screen.getByText("settings:common.save")

			// Try to enter threshold without selecting profile
			fireEvent.change(thresholdInput, { target: { value: "65" } })

			// Save button should remain disabled
			expect(saveButton).toBeDisabled()
		})

		it("disables save button when threshold input is empty", () => {
			render(<ProfileThresholdManager {...defaultProps} />)

			const dropdown = screen.getByTestId("profile-dropdown")
			const saveButton = screen.getByText("settings:common.save")

			// Select profile but don't enter threshold
			fireEvent.change(dropdown, { target: { value: "profile-1" } })

			// Save button should remain disabled
			expect(saveButton).toBeDisabled()
		})

		it("disables save button when there are no unsaved changes", () => {
			const propsWithThresholds = {
				...defaultProps,
				profileThresholds: {
					"profile-1": 60,
				},
			}

			render(<ProfileThresholdManager {...propsWithThresholds} />)

			const dropdown = screen.getByTestId("profile-dropdown")
			const saveButton = screen.getByText("settings:common.save")

			// Select profile with existing threshold (no changes)
			fireEvent.change(dropdown, { target: { value: "profile-1" } })

			// Save button should be disabled (no unsaved changes)
			expect(saveButton).toBeDisabled()
		})
	})
})
