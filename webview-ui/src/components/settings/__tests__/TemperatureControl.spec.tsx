// npx vitest src/components/settings/__tests__/TemperatureControl.spec.tsx

import { render, screen, fireEvent } from "@testing-library/react"

import { TemperatureControl } from "../TemperatureControl"

// Mock translation hook to return the key as the translation
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock VSCode components to behave like standard HTML elements
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
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

vi.mock("@/components/ui", () => ({
	...vi.importActual("@/components/ui"),
	Slider: ({ value, onValueChange, "data-testid": dataTestId }: any) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => onValueChange([parseFloat(e.target.value)])}
			data-testid={dataTestId}
			role="slider"
		/>
	),
}))

describe("TemperatureControl", () => {
	it("renders with default temperature disabled", () => {
		const onChange = vi.fn()
		render(<TemperatureControl value={undefined} onChange={onChange} />)

		const checkbox = screen.getByRole("checkbox")
		expect(checkbox).not.toBeChecked()
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
	})

	it("renders with custom temperature enabled", () => {
		const onChange = vi.fn()
		render(<TemperatureControl value={0.7} onChange={onChange} />)

		const checkbox = screen.getByRole("checkbox")
		expect(checkbox).toBeChecked()

		const input = screen.getByRole("slider")
		expect(input).toBeInTheDocument()
		expect(input).toHaveValue("0.7")
	})

	it("updates when checkbox is toggled", async () => {
		const onChange = vi.fn()
		render(<TemperatureControl value={0.7} onChange={onChange} />)

		const checkbox = screen.getByRole("checkbox")

		// Uncheck - should clear temperature.
		fireEvent.click(checkbox)

		// Waiting for debounce.
		await new Promise((x) => setTimeout(x, 100))
		expect(onChange).toHaveBeenCalledWith(null)

		// Check - should restore previous temperature.
		fireEvent.click(checkbox)

		// Waiting for debounce.
		await new Promise((x) => setTimeout(x, 100))
		expect(onChange).toHaveBeenCalledWith(0.7)
	})

	it("syncs checkbox state when value prop changes", () => {
		const onChange = vi.fn()
		const { rerender } = render(<TemperatureControl value={0.7} onChange={onChange} />)

		// Initially checked.
		const checkbox = screen.getByRole("checkbox")
		expect(checkbox).toBeChecked()

		// Update to undefined.
		rerender(<TemperatureControl value={undefined} onChange={onChange} />)
		expect(checkbox).not.toBeChecked()

		// Update back to a value.
		rerender(<TemperatureControl value={0.5} onChange={onChange} />)
		expect(checkbox).toBeChecked()
	})
})
