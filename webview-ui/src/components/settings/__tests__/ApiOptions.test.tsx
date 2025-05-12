// npx jest src/components/settings/__tests__/ApiOptions.test.ts

import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@/context/ExtensionStateContext"
import { geminiModels } from "@roo/shared/api"
import ApiOptions, { ApiOptionsProps } from "../ApiOptions"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel" // Import the hook to be mocked

// Mock useSelectedModel at the top level
// Mock MODELS_BY_PROVIDER to ensure selectedProviderModels is not empty
jest.mock("../constants", () => ({
	...jest.requireActual("../constants"),
	MODELS_BY_PROVIDER: {
		"mock-provider": {
			"default-mock-model": {},
			"thinking-model-with-max-tokens": {},
			"thinking-model": {},
			"non-thinking-model": {},
			"non-thinking-model-with-max-tokens": {},
			"model-without-max-tokens": {},
		},
		gemini: {
			"gemini-2.5-pro-exp-03-25": {},
		},
		PROVIDERS: jest.requireActual("../constants").PROVIDERS,
		REASONING_MODELS: jest.requireActual("../constants").REASONING_MODELS,
	},
}))

jest.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: jest.fn().mockReturnValue({
		provider: "mock-provider",
		id: "default-mock-model",
		info: {
			thinking: false,
			maxTokens: 4000,
			contextWindow: 4000,
			supportsPromptCache: false,
			isPromptCacheOptional: false,
		},
	}),
}))

// Mock VSCode components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onBlur }: any) => (
		<div>
			{children}
			<input type="text" value={value} onChange={onBlur} />
		</div>
	),
	VSCodeLink: ({ children, href }: any) => <a href={href}>{children}</a>,
	VSCodeRadio: ({ value, checked }: any) => <input type="radio" value={value} checked={checked} />,
	VSCodeRadioGroup: ({ children }: any) => <div>{children}</div>,
	VSCodeButton: ({ children }: any) => <div>{children}</div>,
}))

// Mock other components
jest.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange }: any) => (
		<label data-testid={`checkbox-${children?.toString().replace(/\s+/g, "-").toLowerCase()}`}>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				data-testid={`checkbox-input-${children?.toString().replace(/\s+/g, "-").toLowerCase()}`}
			/>
			{children}
		</label>
	),
}))

// Mock @shadcn/ui components
jest.mock("@/components/ui", () => ({
	Select: ({ children, value, onValueChange }: any) => (
		<select value={value} onChange={(e) => onValueChange && onValueChange(e.target.value)}>
			{children}
		</select>
	),
	SelectTrigger: ({ children }: any) => <>{children}</>, // Render children directly
	SelectValue: ({ children }: any) => <>{children}</>, // Render children directly
	SelectContent: ({ children }: any) => <>{children}</>, // Render children directly
	SelectItem: ({ children, value }: any) => (
		<option value={value}>{children}</option> // Use native option
	),
	SelectSeparator: () => null, // Render nothing for separator
	Button: ({ children, onClick, _variant, role, className }: any) => (
		<button onClick={onClick} className={`button-mock ${className || ""}`} role={role}>
			{children}
		</button>
	),
	// Add missing components used by ModelPicker
	Command: ({ children }: any) => <div>{children}</div>, // Simple div mock
	CommandEmpty: ({ children }: any) => <div>{children}</div>, // Simple div mock
	CommandGroup: ({ children }: any) => <div>{children}</div>, // Simple div mock
	CommandInput: ({ value, onValueChange, placeholder, className, _ref }: any) => (
		<input
			value={value}
			onChange={(e) => onValueChange && onValueChange(e.target.value)}
			placeholder={placeholder}
			className={className}
		/>
	),
	CommandItem: ({ children, value, onSelect }: any) => (
		<div onClick={() => onSelect && onSelect(value)}>{children}</div> // Simple div mock
	),
	CommandList: ({ children }: any) => <div>{children}</div>, // Simple div mock
	Popover: ({ children, _open, _onOpenChange }: any) => <div>{children}</div>, // Simple div mock
	PopoverContent: ({ children, _className }: any) => <div>{children}</div>, // Simple div mock
	PopoverTrigger: ({ children, _asChild }: any) => <div>{children}</div>, // Simple div mock
	Slider: ({ value, onChange }: any) => (
		<div data-testid="slider">
			<input type="range" value={value || 0} onChange={(e) => onChange(parseFloat(e.target.value))} />
		</div>
	),
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

jest.mock("../RateLimitSecondsControl", () => ({
	RateLimitSecondsControl: ({ value, onChange }: any) => (
		<div data-testid="rate-limit-seconds-control">
			<input
				type="range"
				value={value || 0}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				min={0}
				max={60}
				step={1}
			/>
		</div>
	),
}))

// Mock DiffSettingsControl for tests
jest.mock("../DiffSettingsControl", () => ({
	DiffSettingsControl: ({ diffEnabled, fuzzyMatchThreshold, onChange }: any) => (
		<div data-testid="diff-settings-control">
			<label>
				Enable editing through diffs
				<input
					type="checkbox"
					checked={diffEnabled}
					onChange={(e) => onChange("diffEnabled", e.target.checked)}
				/>
			</label>
			<div>
				Fuzzy match threshold
				<input
					type="range"
					value={fuzzyMatchThreshold || 1.0}
					onChange={(e) => onChange("fuzzyMatchThreshold", parseFloat(e.target.value))}
					min={0.8}
					max={1}
					step={0.005}
				/>
			</div>
		</div>
	),
}))

// Modified mocks to accept shouldRender prop
jest.mock("../ReasoningEffort", () => ({
	ReasoningEffort: () => <div data-testid="reasoning-effort-select" />,
}))

jest.mock("../ThinkingBudget", () => ({
	ThinkingBudget: ({ _modelInfo }: { _modelInfo: any }) => {
		// Always render the component for testing purposes
		return <div data-testid="mock-thinking-budget" />
	},
}))

jest.mock("../MaxOutputTokensControl", () => ({
	MaxOutputTokensControl: ({ _modelInfo }: { _modelInfo: any }) => {
		// Always render the component for testing purposes
		return <div data-testid="max-output-tokens-control" />
	},
}))

const renderApiOptions = (props: Partial<ApiOptionsProps> = {}) => {
	const queryClient = new QueryClient()

	// Log the value of useSelectedModel for debugging
	console.log("useSelectedModel mock return value:", (useSelectedModel as jest.Mock).mock.results)

	render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ApiOptions
					errorMessage={undefined}
					setErrorMessage={() => {}}
					uriScheme={undefined}
					apiConfiguration={{}}
					setApiConfigurationField={() => {}}
					{...props}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ApiOptions", () => {
	// Reset the mock before each test
	beforeEach(() => {
		// Reset the mock implementation before each test
		;(useSelectedModel as jest.Mock).mockReturnValue({
			provider: "mock-provider",
			id: "default-mock-model",
			info: {
				thinking: false,
				maxTokens: 4000,
				contextWindow: 4000,
				supportsPromptCache: false,
				isPromptCacheOptional: false,
			},
		})
	})

	it("shows diff settings, temperature and rate limit controls by default", () => {
		renderApiOptions({
			apiConfiguration: {
				diffEnabled: true,
				fuzzyMatchThreshold: 0.95,
			},
		})
		// Check for DiffSettingsControl by looking for text content
		expect(screen.getByText(/enable editing through diffs/i)).toBeInTheDocument()
		expect(screen.getByTestId("temperature-control")).toBeInTheDocument()
		expect(screen.getByTestId("rate-limit-seconds-control")).toBeInTheDocument()
	})

	it("hides all controls when fromWelcomeView is true", () => {
		renderApiOptions({ fromWelcomeView: true })
		// Check for absence of DiffSettingsControl text
		expect(screen.queryByText(/enable editing through diffs/i)).not.toBeInTheDocument()
		expect(screen.queryByTestId("temperature-control")).not.toBeInTheDocument()
		expect(screen.queryByTestId("rate-limit-seconds-control")).not.toBeInTheDocument()
	})

	it("should show MaxOutputTokensControl and ThinkingBudget for a thinking model with maxTokens", () => {
		;(useSelectedModel as jest.Mock).mockReturnValue({
			provider: "mock-provider",
			id: "thinking-model-with-max-tokens",
			info: {
				thinking: true,
				maxTokens: 65535,
				contextWindow: 4000,
				supportsPromptCache: false,
				isPromptCacheOptional: false,
			},
		})
		renderApiOptions({})

		expect(screen.queryByTestId("max-output-tokens-control")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-thinking-budget")).toBeInTheDocument()
	})

	describe("thinking functionality", () => {
		it("should show ThinkingBudget for models that support thinking", () => {
			;(useSelectedModel as jest.Mock).mockReturnValue({
				provider: "mock-provider",
				id: "thinking-model",
				info: {
					thinking: true,
					contextWindow: 4000,
					maxTokens: 128000,
					supportsPromptCache: false,
					isPromptCacheOptional: false,
				},
			})
			renderApiOptions({})

			expect(screen.queryByTestId("mock-thinking-budget")).toBeInTheDocument()
		})

		it("should not show ThinkingBudget for models that don't support thinking", () => {
			;(useSelectedModel as jest.Mock).mockReturnValue({
				provider: "mock-provider",
				id: "non-thinking-model",
				info: {
					thinking: false,
					contextWindow: 4000,
					maxTokens: 4000,
					supportsPromptCache: false,
					isPromptCacheOptional: false,
				},
			})
			renderApiOptions({})

			expect(screen.queryByTestId("mock-thinking-budget")).not.toBeInTheDocument()
		})

		// Note: We don't need to test the actual ThinkingBudget component functionality here
		// since we have separate tests for that component. We just need to verify that
		// it's included in the ApiOptions component when appropriate.
	})

	it("should show MaxOutputTokensControl and hide ThinkingBudget for a non-thinking model with maxTokens", () => {
		;(useSelectedModel as jest.Mock).mockReturnValue({
			provider: "mock-provider",
			id: "non-thinking-model-with-max-tokens",
			info: {
				thinking: false,
				maxTokens: 65535,
				contextWindow: 4000,
				supportsPromptCache: false,
				isPromptCacheOptional: false,
			},
		})
		renderApiOptions({})

		expect(screen.queryByTestId("max-output-tokens-control")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-thinking-budget")).not.toBeInTheDocument()
	})

	it("should hide MaxOutputTokensControl and ThinkingBudget for a model without maxTokens", () => {
		;(useSelectedModel as jest.Mock).mockReturnValue({
			provider: "mock-provider",
			id: "model-without-max-tokens",
			info: {
				contextWindow: 4000,
				thinking: false,
				maxTokens: undefined,
				supportsPromptCache: false,
				isPromptCacheOptional: false,
			}, // Set maxTokens to undefined for this test
		})
		renderApiOptions({})

		expect(screen.queryByTestId("max-output-tokens-control")).not.toBeInTheDocument()
		expect(screen.queryByTestId("mock-thinking-budget")).not.toBeInTheDocument()
	})

	it("should show MaxOutputTokensControl and hide ThinkingBudget for problematic Gemini models (e.g., gemini-2.5-pro-exp-03-25)", () => {
		// Use geminiModels here to satisfy linter
		const problematicGeminiModelInfo = geminiModels["gemini-2.5-pro-exp-03-25"]
		;(useSelectedModel as jest.Mock).mockReturnValue({
			provider: "gemini", // Use actual provider for this test
			id: "gemini-2.5-pro-exp-03-25",
			info: { ...problematicGeminiModelInfo, supportsPromptCache: false, isPromptCacheOptional: false }, // Ensure all properties are present
		})
		renderApiOptions({})

		expect(screen.queryByTestId("max-output-tokens-control")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-thinking-budget")).not.toBeInTheDocument()
	})

	// describe("OpenAI provider tests", () => {
	// 	// Set a mock model info that would cause ReasoningEffort to render
	// 	beforeEach(() => {
	// 		setMockModelInfo({ id: "mock-reasoning-model", contextWindow: 4000 });
	// 		// Add "mock-reasoning-model" to the REASONING_MODELS set for this test file
	// 		const { REASONING_MODELS } = jest.requireActual("../constants");
	// 		REASONING_MODELS.add("mock-reasoning-model");
	// 	});

	// 	// After each test, clean up the REASONING_MODELS set
	// 	afterEach(() => {
	// 		const { REASONING_MODELS } = jest.requireActual("../constants");
	// 		REASONING_MODELS.delete("mock-reasoning-model");
	// 	});

	// 	it("removes reasoningEffort from openAiCustomModelInfo when unchecked", () => {
	// 		const mockSetApiConfigurationField = jest.fn();
	// 		const initialConfig = {
	// 			apiProvider: "openai" as const,
	// 			enableReasoningEffort: true,
	// 			openAiCustomModelInfo: {
	// 				...openAiModelInfoSaneDefaults, // Start with defaults
	// 				reasoningEffort: "low" as const, // Set an initial value
	// 			},
	// 			// Add other necessary default fields for openai provider if needed
	// 		};

	// 		renderApiOptions({
	// 			apiConfiguration: initialConfig,
	// 			setApiConfigurationField: mockSetApiConfigurationField,
	// 		});

	// 		// Find the checkbox by its test ID instead of label text
	// 		// Find the checkbox by its role and accessible name
	// 		const checkbox = screen.getByRole('checkbox', { name: /set reasoning level/i });

	// 		// Simulate unchecking the checkbox
	// 		fireEvent.click(checkbox);
	// 	});
	// });
})
