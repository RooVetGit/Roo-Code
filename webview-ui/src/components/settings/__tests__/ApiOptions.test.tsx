// Mock @shadcn/ui components - both @/ and @src/ paths
const uiMocks = {
	Select: ({ children, value, onValueChange }: any) => (
		<select value={value} onChange={(e: any) => onValueChange && onValueChange(e.target.value)}>
			{children}
		</select>
	),
	SelectTrigger: ({ children }: any) => <>{children}</>,
	SelectValue: ({ children }: any) => <>{children}</>,
	SelectContent: ({ children }: any) => <>{children}</>,
	SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
	SelectSeparator: () => null,
	Button: ({ children, onClick, role, className }: any) => (
		<button onClick={onClick} className={`button-mock ${className || ""}`} role={role}>
			{children}
		</button>
	),
	Command: ({ children }: any) => <div>{children}</div>,
	CommandEmpty: ({ children }: any) => <div>{children}</div>,
	CommandGroup: ({ children }: any) => <div>{children}</div>,
	CommandInput: ({ value, onValueChange, placeholder, className }: any) => (
		<input
			value={value}
			onChange={(e: any) => onValueChange && onValueChange(e.target.value)}
			placeholder={placeholder}
			className={className}
		/>
	),
	CommandItem: ({ children, value, onSelect }: any) => (
		<div onClick={() => onSelect && onSelect(value)}>{children}</div>
	),
	CommandList: ({ children }: any) => <div>{children}</div>,
	Popover: ({ children }: any) => <div>{children}</div>,
	PopoverContent: ({ children }: any) => <div>{children}</div>,
	PopoverTrigger: ({ children }: any) => <div>{children}</div>,
	Slider: ({ value, onChange }: any) => (
		<div data-testid="slider">
			<input type="range" value={value || 0} onChange={(e: any) => onChange(parseFloat(e.target.value))} />
		</div>
	),
}

jest.mock("@/components/ui", () => uiMocks)
jest.mock("@src/components/ui", () => uiMocks)

// Mock i18n TranslationContext
jest.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock ExtensionMessage
jest.mock("@roo/ExtensionMessage", () => ({
	ExtensionMessage: {},
}))

// Mock vscrui
jest.mock("vscrui", () => ({
	Checkbox: ({ children, ...props }: any) => (
		<input type="checkbox" {...props}>
			{children}
		</input>
	),
}))

// Mock utils/headers
jest.mock("../utils/headers", () => ({
	convertHeadersToObject: jest.fn(() => []),
}))

// Mock transforms
jest.mock("../transforms", () => ({
	inputEventTransform: jest.fn((fn: any) => fn),
	noTransform: jest.fn((fn: any) => fn),
}))

// Mock ModelPicker
jest.mock("../ModelPicker", () => ({
	ModelPicker: ({ children, ...props }: any) => (
		<div data-testid="model-picker" {...props}>
			{children}
		</div>
	),
}))

// Mock R1FormatSetting
jest.mock("../R1FormatSetting", () => ({
	R1FormatSetting: ({ ...props }: any) => <div data-testid="r1-format-setting" {...props}></div>,
}))

// Mock constants
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
	},
}))

// Mock react-i18next
jest.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock useRouterModels
const mockUseRouterModels = {
	data: {
		openrouter: [],
		requesty: [],
		glama: [],
		unbound: [],
		litellm: [
			{ id: "litellm-model-1", context_length: 32000 },
			{ id: "litellm-model-2", context_length: 128000 },
		],
	},
	error: null,
	isLoading: false,
	refetch: jest.fn(),
}

jest.mock("@src/components/ui/hooks/useRouterModels", () => ({
	useRouterModels: () => mockUseRouterModels,
}))

// Mock vscode module
jest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock VSCodeLink component as anchor
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick }: any) => (
		<button onClick={onClick} className="vscode-button">
			{children}
		</button>
	),
	VSCodeLink: ({ children, href }: any) => (
		<a href={href} className="vscode-link">
			{children}
		</a>
	),
	VSCodeTextField: ({ children, ...props }: any) => (
		<input type="text" {...props}>
			{children}
		</input>
	),
}))

jest.mock("../TemperatureControl", () => ({
	TemperatureControl: ({ apiConfiguration, setApiConfigurationField }: any) => (
		<div data-testid="temperature-control">
			<input
				type="range"
				value={apiConfiguration?.temperature || 0}
				onChange={(e: any) => setApiConfigurationField("temperature", parseFloat(e.target.value))}
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
			<input type="number" value={value || 0} onChange={(e: any) => onChange(parseInt(e.target.value))} />
		</div>
	),
}))

jest.mock("../ModelInfoView", () => ({
	ModelInfoView: ({ modelInfo, modelProvider }: any) => (
		<div data-testid="model-info-view">
			{modelInfo && <span>{JSON.stringify(modelInfo)}</span>}
			{modelProvider && <span>{modelProvider}</span>}
		</div>
	),
}))

jest.mock("../ApiErrorMessage", () => ({
	ApiErrorMessage: ({ error }: any) => <div data-testid="api-error-message">{error && <span>{error}</span>}</div>,
}))

jest.mock("../ThinkingBudget", () => ({
	ThinkingBudget: ({ apiConfiguration, setApiConfigurationField, modelInfo }: any) => {
		// Match the real component's logic
		if (!modelInfo) return null

		const isReasoningBudgetSupported = !!modelInfo && modelInfo.supportsReasoningBudget
		const isReasoningBudgetRequired = !!modelInfo && modelInfo.requiredReasoningBudget
		const isReasoningEffortSupported = !!modelInfo && modelInfo.supportsReasoningEffort
		const enableReasoningEffort = apiConfiguration?.enableReasoningEffort

		if (isReasoningBudgetSupported && !!modelInfo.maxTokens) {
			// Only show if required OR if user has enabled it
			if (isReasoningBudgetRequired || enableReasoningEffort) {
				return (
					<div data-testid="reasoning-budget">
						<input
							type="number"
							value={apiConfiguration?.modelMaxThinkingTokens || 1000}
							onChange={(e: any) =>
								setApiConfigurationField("modelMaxThinkingTokens", parseInt(e.target.value))
							}
						/>
					</div>
				)
			}
			return null
		} else if (isReasoningEffortSupported) {
			return <div data-testid="reasoning-effort"></div>
		}

		return null
	},
}))

jest.mock("../MaxOutputTokensControl", () => ({
	MaxOutputTokensControl: ({ apiConfiguration, setApiConfigurationField, modelInfo }: any) => {
		// Only show if model has maxTokens > 0
		if (!modelInfo || !modelInfo.maxTokens || modelInfo.maxTokens <= 0) {
			return null
		}
		return (
			<div data-testid="max-output-tokens-control">
				<span>Max Output Tokens</span>
				<input
					type="number"
					value={apiConfiguration?.modelMaxTokens || modelInfo?.maxTokens || 4096}
					onChange={(e: any) => setApiConfigurationField("modelMaxTokens", parseInt(e.target.value))}
				/>
			</div>
		)
	},
}))

jest.mock("../DiffSettingsControl", () => ({
	DiffSettingsControl: () => <div data-testid="diff-settings-control" />,
}))

jest.mock("../providers", () => ({
	Anthropic: () => <div data-testid="anthropic-provider" />,
	Bedrock: () => <div data-testid="bedrock-provider" />,
	Chutes: () => <div data-testid="chutes-provider" />,
	DeepSeek: () => <div data-testid="deepseek-provider" />,
	Gemini: () => <div data-testid="gemini-provider" />,
	Glama: () => <div data-testid="glama-provider" />,
	Groq: () => <div data-testid="groq-provider" />,
	LMStudio: () => <div data-testid="lmstudio-provider" />,
	LiteLLM: () => <div data-testid="litellm-provider" />,
	Mistral: () => <div data-testid="mistral-provider" />,
	Ollama: () => <div data-testid="ollama-provider" />,
	OpenAI: () => <div data-testid="openai-provider" />,
	OpenAICompatible: () => <div data-testid="openai-compatible-provider" />,
	OpenRouter: () => <div data-testid="openrouter-provider" />,
	Requesty: () => <div data-testid="requesty-provider" />,
	Unbound: () => <div data-testid="unbound-provider" />,
	Vertex: () => <div data-testid="vertex-provider" />,
	VSCodeLM: () => <div data-testid="vscode-lm-provider" />,
	XAI: () => <div data-testid="xai-provider" />,
}))

jest.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: (apiConfiguration: any) => {
		const selectedModelId = apiConfiguration?.apiModelId
		const selectedProvider = apiConfiguration?.apiProvider || "openai"

		// Return thinking model for "thinking" models, non-thinking for others
		let info = null
		if (selectedModelId?.includes("thinking")) {
			info = {
				supportsReasoningBudget: true,
				requiredReasoningBudget: false,
				maxTokens: 16384,
				contextWindow: 200000,
				supportsPromptCache: true,
				supportsImages: true,
			}
		} else if (selectedModelId === "non-thinking-model-with-max-tokens") {
			info = {
				supportsReasoningBudget: false,
				requiredReasoningBudget: false,
				maxTokens: 8192,
				contextWindow: 100000,
				supportsPromptCache: true,
				supportsImages: true,
			}
		} else if (selectedModelId === "model-without-max-tokens") {
			info = {
				supportsReasoningBudget: false,
				requiredReasoningBudget: false,
				maxTokens: 0,
				contextWindow: 100000,
				supportsPromptCache: true,
				supportsImages: true,
			}
		} else if (selectedModelId === "gpt-4") {
			// Default model
			info = {
				supportsReasoningBudget: false,
				requiredReasoningBudget: false,
				maxTokens: 8192,
				contextWindow: 128000,
				supportsPromptCache: true,
				supportsImages: true,
			}
		}

		return {
			provider: selectedProvider,
			id: selectedModelId,
			info: info,
		}
	},
}))

jest.mock("react-use", () => ({
	...jest.requireActual("react-use"),
	useDebounce: jest.fn(),
	useEvent: jest.fn(),
}))

jest.mock("@src/utils/validate", () => ({
	validateApiConfiguration: jest.fn(() => ({ isValid: true })),
}))

jest.mock("@src/utils/docLinks", () => ({
	buildDocLink: jest.fn((path: string) => `https://docs.example.com/${path}`),
}))

jest.mock("@src/context/ExtensionStateContext", () => ({
	...jest.requireActual("@src/context/ExtensionStateContext"),
	useExtensionState: () => ({
		organizationAllowList: {
			requiredProvidersForParsing: [],
			organizationData: {},
			providers: {
				anthropic: { allowAll: true },
				bedrock: { allowAll: true },
				openai: { allowAll: true },
				gemini: { allowAll: true },
				ollama: { allowAll: true },
				deepseek: { allowAll: true },
				mistral: { allowAll: true },
				vertex: { allowAll: true },
				lmstudio: { allowAll: true },
				"openai-native": { allowAll: true },
				"vscode-lm": { allowAll: true },
				xai: { allowAll: true },
				groq: { allowAll: true },
				chutes: { allowAll: true },
				openrouter: { allowAll: true },
				glama: { allowAll: true },
				requesty: { allowAll: true },
				unbound: { allowAll: true },
				litellm: { allowAll: true },
			},
		},
	}),
}))

// Now the imports
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import ApiOptions, { ApiOptionsProps } from "../ApiOptions"

// Mock vscode object
declare global {
	// eslint-disable-next-line no-var
	var vscode: {
		postMessage: jest.Mock
	}
}
global.vscode = {
	postMessage: jest.fn(),
}

const renderApiOptions = (props: Partial<ApiOptionsProps> = {}) => {
	const defaultProps: ApiOptionsProps = {
		uriScheme: undefined,
		apiConfiguration: {
			apiProvider: "openai",
			apiModelId: "gpt-4",
		},
		setApiConfigurationField: jest.fn(),
		fromWelcomeView: false,
		errorMessage: undefined,
		setErrorMessage: jest.fn(),
	}

	const queryClient = new QueryClient()

	render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ApiOptions {...defaultProps} {...props} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ApiOptions Component", () => {
	it("renders controls for non-thinking model with max tokens", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "openai" as const,
				apiModelId: "non-thinking-model-with-max-tokens",
				enableReasoningEffort: false, // Explicitly set to false
			},
		})

		// Should show MaxOutputTokensControl
		expect(screen.getByTestId("max-output-tokens-control")).toBeInTheDocument()
		expect(screen.getByText("Max Output Tokens")).toBeInTheDocument()

		// Should NOT show ThinkingBudget
		expect(screen.queryByTestId("reasoning-budget")).not.toBeInTheDocument()
		expect(screen.queryByTestId("reasoning-effort")).not.toBeInTheDocument()
	})

	it("renders controls for thinking model", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "openai" as const,
				apiModelId: "thinking-model-with-max-tokens",
				enableReasoningEffort: true, // Enable reasoning effort for thinking models
			},
		})

		// Should show both controls
		expect(screen.getByTestId("max-output-tokens-control")).toBeInTheDocument()
		expect(screen.getByTestId("reasoning-budget")).toBeInTheDocument()
	})

	it("renders no token controls for model without max tokens", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "openai" as const,
				apiModelId: "model-without-max-tokens",
			},
		})

		// Should NOT show MaxOutputTokensControl
		expect(screen.queryByTestId("max-output-tokens-control")).not.toBeInTheDocument()

		// Should NOT show ThinkingBudget
		expect(screen.queryByTestId("reasoning-budget")).not.toBeInTheDocument()
	})

	it("shows temperature control", () => {
		renderApiOptions()

		const temperatureControl = screen.getByTestId("temperature-control")
		expect(temperatureControl).toBeInTheDocument()

		const temperatureSlider = temperatureControl.querySelector("input")
		expect(temperatureSlider).toBeInTheDocument()
		expect(temperatureSlider!.type).toBe("range")
		expect(temperatureSlider!.min).toBe("0")
		expect(temperatureSlider!.max).toBe("2")
	})

	it("displays provider-specific component", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "gemini" as const,
				apiModelId: "gemini-2.5-pro-exp-03-25",
			},
		})

		expect(screen.getByTestId("gemini-provider")).toBeInTheDocument()
	})

	it("displays OpenAI Compatible component for openai provider", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "openai" as const,
				apiModelId: "gpt-4",
			},
		})

		expect(screen.getByTestId("openai-compatible-provider")).toBeInTheDocument()
	})
})
