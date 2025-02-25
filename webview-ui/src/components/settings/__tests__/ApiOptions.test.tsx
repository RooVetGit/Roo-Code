import { render, screen } from "@testing-library/react"
import ApiOptions from "../ApiOptions"
import { ExtensionStateContextProvider } from "../../../context/ExtensionStateContext"

// Mock VSCode components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onBlur }: any) => (
		<div>
			{children}
			<input type="text" value={value} onChange={onBlur} />
		</div>
	),
	VSCodeLink: ({ children, href }: any) => <a href={href}>{children}</a>,
	VSCodeRadio: ({ children, value, checked }: any) => <input type="radio" value={value} checked={checked} />,
	VSCodeRadioGroup: ({ children }: any) => <div>{children}</div>,
}))

// Mock other components
jest.mock("vscrui", () => ({
	Dropdown: ({ children, value, onChange }: any) => (
		<select value={value} onChange={onChange}>
			{children}
		</select>
	),
	Checkbox: ({ children, checked, onChange }: any) => (
		<label>
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			{children}
		</label>
	),
	Pane: ({ children }: any) => <div>{children}</div>,
}))

jest.mock("../TemperatureControl", () => ({
	TemperatureControl: ({ value, onChange }: any) => (
		<div data-testid="temperature-control">
			<input
				type="range"
				value={value || 0}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				min={0}
				max={2}
				step={0.1}
			/>
		</div>
	),
}))

jest.mock("@/components/ui", () => ({
	Slider: ({ min, max, step, value, onValueChange }: any) => (
		<div data-testid="thinking-slider">
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value[0]}
				onChange={(e) => onValueChange([parseInt(e.target.value)])}
			/>
		</div>
	),
}))

describe("ApiOptions", () => {
	const renderApiOptions = (props = {}) => {
		render(
			<ExtensionStateContextProvider>
				<ApiOptions
					uriScheme={undefined}
					apiConfiguration={{}}
					setApiConfigurationField={() => {}}
					{...props}
				/>
			</ExtensionStateContextProvider>,
		)
	}

	it("shows temperature control by default", () => {
		renderApiOptions()
		expect(screen.getByTestId("temperature-control")).toBeInTheDocument()
	})

	it("hides temperature control when fromWelcomeView is true", () => {
		renderApiOptions({ fromWelcomeView: true })
		expect(screen.queryByTestId("temperature-control")).not.toBeInTheDocument()
	})

	describe("Thinking Feature", () => {
		it("should show thinking controls for Anthropic with Claude 3.7 Sonnet", () => {
			renderApiOptions({
				apiConfiguration: {
					apiProvider: "anthropic",
					apiModelId: "claude-3-7-sonnet-20250219",
				},
			})

			expect(screen.getByText("Thinking?")).toBeInTheDocument()
		})

		it("should show thinking controls for Vertex with Claude 3.7 Sonnet", () => {
			renderApiOptions({
				apiConfiguration: {
					apiProvider: "vertex",
					apiModelId: "claude-3-7-sonnet@20250219",
				},
			})

			expect(screen.getByText("Thinking?")).toBeInTheDocument()
		})

		it("should not show thinking controls for non-supported Anthropic models", () => {
			renderApiOptions({
				apiConfiguration: {
					apiProvider: "anthropic",
					apiModelId: "claude-3-5-sonnet-20241022",
				},
			})

			expect(screen.queryByText("Thinking?")).not.toBeInTheDocument()
		})

		it("should not show thinking controls for non-supported Vertex models", () => {
			renderApiOptions({
				apiConfiguration: {
					apiProvider: "vertex",
					apiModelId: "claude-3-5-sonnet-v2@20241022",
				},
			})

			expect(screen.queryByText("Thinking?")).not.toBeInTheDocument()
		})

		it("should show slider when thinking is enabled for Anthropic", () => {
			const setApiConfigurationField = jest.fn()

			renderApiOptions({
				apiConfiguration: {
					apiProvider: "anthropic",
					apiModelId: "claude-3-7-sonnet-20250219",
					anthropicThinking: 16384,
				},
				setApiConfigurationField,
			})

			expect(screen.getByTestId("thinking-slider")).toBeInTheDocument()
		})

		it("should show slider when thinking is enabled for Vertex", () => {
			const setApiConfigurationField = jest.fn()

			renderApiOptions({
				apiConfiguration: {
					apiProvider: "vertex",
					apiModelId: "claude-3-7-sonnet@20250219",
					anthropicThinking: 16384,
				},
				setApiConfigurationField,
			})

			expect(screen.getByTestId("thinking-slider")).toBeInTheDocument()
		})
	})
})
