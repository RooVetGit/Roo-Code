import { render, screen, fireEvent } from "@testing-library/react"
import { vi } from "vitest"
import { FileEditingOptions } from "../FileEditingOptions"

// Mock the translation hook
const mockT = vi.fn((key: string) => key)
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({ t: mockT }),
}))

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ children, checked, disabled, onChange, ...props }: any) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={onChange}
				data-testid={props["data-testid"]}
			/>
			{children}
		</label>
	),
}))

// Mock UI components
vi.mock("@/components/ui", () => ({
	Slider: ({ value, onValueChange, disabled, ...props }: any) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => onValueChange([parseFloat(e.target.value)])}
			disabled={disabled}
			data-testid="slider"
			{...props}
		/>
	),
}))

describe("FileEditingOptions", () => {
	const defaultProps = {
		diffEnabled: true,
		fuzzyMatchThreshold: 1.0,
		fileBasedEditing: false,
		onChange: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("File-based editing section", () => {
		it("should render file-based editing checkbox", () => {
			render(<FileEditingOptions {...defaultProps} />)

			expect(mockT).toHaveBeenCalledWith("settings:advanced.fileEditing.fileBasedEditing.label")
			expect(mockT).toHaveBeenCalledWith("settings:advanced.fileEditing.fileBasedEditing.description")
		})

		it("should call onChange when file-based editing is toggled", () => {
			const onChange = vi.fn()
			render(<FileEditingOptions {...defaultProps} onChange={onChange} />)

			const fileBasedCheckbox = screen.getByRole("checkbox", { name: /fileBasedEditing/ })
			fireEvent.click(fileBasedCheckbox)

			expect(onChange).toHaveBeenCalledWith("fileBasedEditing", true)
		})

		it("should show exclusivity notice when file-based editing is enabled", () => {
			render(<FileEditingOptions {...defaultProps} fileBasedEditing={true} />)

			expect(mockT).toHaveBeenCalledWith("settings:advanced.fileEditing.exclusivityNotice")
		})
	})

	describe("Diff settings section", () => {
		it("should render diff enabled checkbox", () => {
			render(<FileEditingOptions {...defaultProps} />)

			expect(mockT).toHaveBeenCalledWith("settings:advanced.diff.label")
			expect(mockT).toHaveBeenCalledWith("settings:advanced.diff.description")
		})

		it("should enable diff settings when file-based editing is disabled", () => {
			render(<FileEditingOptions {...defaultProps} fileBasedEditing={false} />)

			const diffEnabledCheckbox = screen.getByRole("checkbox", { name: /diff.label/ })
			expect(diffEnabledCheckbox).not.toBeDisabled()
		})

		it("should show diff sub-controls when diff is enabled and file-based editing is disabled", () => {
			render(<FileEditingOptions {...defaultProps} diffEnabled={true} fileBasedEditing={false} />)

			expect(mockT).toHaveBeenCalledWith("settings:advanced.diff.matchPrecision.label")
		})

		it("should hide diff sub-controls when diff is disabled", () => {
			render(<FileEditingOptions {...defaultProps} diffEnabled={false} fileBasedEditing={false} />)

			expect(mockT).not.toHaveBeenCalledWith("settings:advanced.diff.matchPrecision.label")
		})

		it("should hide diff sub-controls when file-based editing is enabled", () => {
			render(<FileEditingOptions {...defaultProps} diffEnabled={true} fileBasedEditing={true} />)

			expect(mockT).not.toHaveBeenCalledWith("settings:advanced.diff.matchPrecision.label")
		})
	})

	describe("Change handlers", () => {
		it("should call onChange for diffEnabled", () => {
			const onChange = vi.fn()
			render(<FileEditingOptions {...defaultProps} onChange={onChange} />)

			const checkbox = screen.getByRole("checkbox", { name: /diff.label/ })
			fireEvent.click(checkbox)

			// should be false because the default is true
			expect(onChange).toHaveBeenCalledWith("diffEnabled", false)
		})

		it("should call onChange for fuzzyMatchThreshold", () => {
			const onChange = vi.fn()
			render(<FileEditingOptions {...defaultProps} onChange={onChange} diffEnabled={true} />)

			const slider = screen.getByTestId("slider")
			fireEvent.change(slider, { target: { value: "0.95" } })

			expect(onChange).toHaveBeenCalledWith("fuzzyMatchThreshold", 0.95)
		})
	})
})
