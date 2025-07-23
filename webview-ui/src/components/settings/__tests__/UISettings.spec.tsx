import { render, screen, fireEvent } from "@/utils/test-utils"

import { UISettings } from "@src/components/settings/UISettings"

// Mock translation hook to return the key as the translation
vitest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock VSCode components to behave like standard HTML elements
vitest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ checked, onChange, children, "data-testid": dataTestId, ...props }: any) => (
		<div>
			<input
				type="checkbox"
				checked={checked}
				onChange={onChange}
				data-testid={dataTestId}
				aria-label={children?.props?.children || children}
				role="checkbox"
				aria-checked={checked}
				{...props}
			/>
			{children}
		</div>
	),
}))

describe("UISettings", () => {
	const defaultProps = {
		filesChangedEnabled: false,
		setCachedStateField: vitest.fn(),
	}

	beforeEach(() => {
		vitest.clearAllMocks()
	})

	it("renders the UI settings section", () => {
		render(<UISettings {...defaultProps} />)

		// Check that the section header is rendered
		expect(screen.getByText("settings:sections.ui")).toBeInTheDocument()
		expect(screen.getByText("settings:ui.description")).toBeInTheDocument()
	})

	it("renders the files changed overview checkbox", () => {
		render(<UISettings {...defaultProps} />)

		// Files changed overview checkbox
		const filesChangedCheckbox = screen.getByTestId("files-changed-enabled-checkbox")
		expect(filesChangedCheckbox).toBeInTheDocument()
		expect(filesChangedCheckbox).not.toBeChecked()

		// Check label and description are present
		expect(screen.getByText("settings:experimental.filesChangedOverview.name")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.filesChangedOverview.description")).toBeInTheDocument()
	})

	it("displays correct state when filesChangedEnabled is true", () => {
		const propsWithEnabled = {
			...defaultProps,
			filesChangedEnabled: true,
		}
		render(<UISettings {...propsWithEnabled} />)

		const checkbox = screen.getByTestId("files-changed-enabled-checkbox")
		expect(checkbox).toBeChecked()
	})

	it("displays correct state when filesChangedEnabled is false", () => {
		const propsWithDisabled = {
			...defaultProps,
			filesChangedEnabled: false,
		}
		render(<UISettings {...propsWithDisabled} />)

		const checkbox = screen.getByTestId("files-changed-enabled-checkbox")
		expect(checkbox).not.toBeChecked()
	})

	it("calls setCachedStateField when files changed checkbox is toggled", () => {
		const mockSetCachedStateField = vitest.fn()
		const props = {
			...defaultProps,
			filesChangedEnabled: false,
			setCachedStateField: mockSetCachedStateField,
		}
		render(<UISettings {...props} />)

		const checkbox = screen.getByTestId("files-changed-enabled-checkbox")
		fireEvent.click(checkbox)

		expect(mockSetCachedStateField).toHaveBeenCalledWith("filesChangedEnabled", true)
	})

	it("calls setCachedStateField with false when enabled checkbox is clicked", () => {
		const mockSetCachedStateField = vitest.fn()
		const props = {
			...defaultProps,
			filesChangedEnabled: true,
			setCachedStateField: mockSetCachedStateField,
		}
		render(<UISettings {...props} />)

		const checkbox = screen.getByTestId("files-changed-enabled-checkbox")
		fireEvent.click(checkbox)

		expect(mockSetCachedStateField).toHaveBeenCalledWith("filesChangedEnabled", false)
	})

	it("handles undefined filesChangedEnabled gracefully", () => {
		const propsWithUndefined = {
			...defaultProps,
			filesChangedEnabled: undefined,
		}

		expect(() => {
			render(<UISettings {...propsWithUndefined} />)
		}).not.toThrow()

		const checkbox = screen.getByTestId("files-changed-enabled-checkbox")
		expect(checkbox).not.toBeChecked() // Should default to false for undefined
	})

	describe("Accessibility", () => {
		it("has proper labels and descriptions", () => {
			render(<UISettings {...defaultProps} />)

			// Check that labels are present
			expect(screen.getByText("settings:experimental.filesChangedOverview.name")).toBeInTheDocument()

			// Check that descriptions are present
			expect(screen.getByText("settings:experimental.filesChangedOverview.description")).toBeInTheDocument()
		})

		it("has proper test ids for all interactive elements", () => {
			render(<UISettings {...defaultProps} />)

			expect(screen.getByTestId("files-changed-enabled-checkbox")).toBeInTheDocument()
		})

		it("has proper checkbox role and aria attributes", () => {
			render(<UISettings {...defaultProps} />)

			const checkbox = screen.getByTestId("files-changed-enabled-checkbox")
			expect(checkbox).toHaveAttribute("role", "checkbox")
			expect(checkbox).toHaveAttribute("aria-checked", "false")
		})

		it("updates aria-checked when state changes", () => {
			const propsWithEnabled = {
				...defaultProps,
				filesChangedEnabled: true,
			}
			render(<UISettings {...propsWithEnabled} />)

			const checkbox = screen.getByTestId("files-changed-enabled-checkbox")
			expect(checkbox).toHaveAttribute("aria-checked", "true")
		})
	})

	describe("Integration with translation system", () => {
		it("uses translation keys for all text content", () => {
			render(<UISettings {...defaultProps} />)

			// Verify that translation keys are being used (mocked to return the key)
			expect(screen.getByText("settings:sections.ui")).toBeInTheDocument()
			expect(screen.getByText("settings:ui.description")).toBeInTheDocument()
			expect(screen.getByText("settings:experimental.filesChangedOverview.name")).toBeInTheDocument()
			expect(screen.getByText("settings:experimental.filesChangedOverview.description")).toBeInTheDocument()
		})
	})

	describe("Component structure", () => {
		it("renders with custom className", () => {
			const { container } = render(<UISettings {...defaultProps} className="custom-class" />)

			const uiSettingsDiv = container.firstChild as HTMLElement
			expect(uiSettingsDiv).toHaveClass("custom-class")
		})

		it("passes through additional props", () => {
			const { container } = render(<UISettings {...defaultProps} data-custom="test-value" />)

			const uiSettingsDiv = container.firstChild as HTMLElement
			expect(uiSettingsDiv).toHaveAttribute("data-custom", "test-value")
		})
	})
})
