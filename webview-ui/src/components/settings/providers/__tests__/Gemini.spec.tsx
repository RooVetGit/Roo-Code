import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Gemini } from "../Gemini"
import type { ProviderSettings } from "@roo-code/types"

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput, type }: any) => (
		<div>
			{children}
			<input type={type} value={value} onChange={(e) => onInput(e)} />
		</div>
	),
}))

vi.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange, "data-testid": testId, _ }: any) => (
		<label data-testid={testId}>
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			{children}
		</label>
	),
}))

vi.mock("@src/components/ui", () => ({
	Slider: ({ min, max, step, value, onValueChange, "data-testid": testId, _ }: any) => (
		<input
			data-testid={testId}
			type="range"
			min={min}
			max={max}
			step={step}
			value={value[0]}
			onChange={(e) => onValueChange([Number(e.target.value)])}
		/>
	),
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@src/components/common/VSCodeButtonLink", () => ({
	VSCodeButtonLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

describe("Gemini provider settings", () => {
	it("renders sliders for topP, topK and maxOutputTokens after expanding", async () => {
		const user = userEvent.setup()
		const setApiField = vi.fn()
		const config: ProviderSettings = {}
		render(<Gemini apiConfiguration={config} setApiConfigurationField={setApiField} />)

		expect(screen.queryByTestId("slider-top-p")).not.toBeInTheDocument()
		expect(screen.queryByTestId("slider-top-k")).not.toBeInTheDocument()
		expect(screen.queryByTestId("slider-max-output-tokens")).not.toBeInTheDocument()

		const trigger = screen.getByText("settings:providers.geminiSections.modelParameters.title")
		await user.click(trigger)

		expect(screen.getByTestId("slider-top-p")).toBeInTheDocument()
		expect(screen.getByTestId("slider-top-k")).toBeInTheDocument()
		expect(screen.getByTestId("slider-max-output-tokens")).toBeInTheDocument()
	})
})
