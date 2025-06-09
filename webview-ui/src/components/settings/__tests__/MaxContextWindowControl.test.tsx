import { render, screen, fireEvent } from "@testing-library/react"
import { MaxContextWindowControl } from "../MaxContextWindowControl"
import "@testing-library/jest-dom"

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}
global.ResizeObserver = MockResizeObserver

jest.mock("@/components/ui", () => ({
	...jest.requireActual("@/components/ui"),
	Slider: ({ value, onValueChange, min = 0, max = 100, "data-testid": dataTestId }: any) => (
		<input
			type="range"
			min={min}
			max={max}
			value={value[0]}
			onChange={(e) => onValueChange([parseInt(e.target.value, 10)])}
			data-testid={dataTestId}
		/>
	),
}))

describe("MaxContextWindowControl", () => {
	it("updates when checkbox is toggled", async () => {
		const onChange = jest.fn()
		render(<MaxContextWindowControl value={123} onChange={onChange} />)

		const checkbox = screen.getByRole("checkbox") as HTMLInputElement
		fireEvent.click(checkbox)

		await new Promise((r) => setTimeout(r, 100))
		expect(onChange).toHaveBeenCalledWith(null)

		fireEvent.click(checkbox)

		await new Promise((r) => setTimeout(r, 100))
		expect(onChange).toHaveBeenCalledWith(123)
	})

	it("calls onChange when slider is moved", async () => {
		const onChange = jest.fn()
		render(<MaxContextWindowControl value={35000} onChange={onChange} />)

		const checkbox = screen.getByRole("checkbox") as HTMLInputElement
		expect(checkbox).toBeChecked()

		const slider = screen.getByRole("slider")
		fireEvent.change(slider, { target: { value: "50000" } })

		await new Promise((r) => setTimeout(r, 120))

		expect(onChange).toHaveBeenCalledWith(50000)
	})
})
