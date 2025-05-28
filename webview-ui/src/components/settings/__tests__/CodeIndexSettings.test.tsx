import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CodeIndexSettings } from "../CodeIndexSettings"
import { vscode } from "@src/utils/vscode"

// Mock vscode API
jest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock i18n
jest.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"settings:codeIndex.providerLabel": "Provider",
				"settings:codeIndex.selectProviderPlaceholder": "Select provider",
				"settings:codeIndex.openaiProvider": "OpenAI",
				"settings:codeIndex.ollamaProvider": "Ollama",
				"settings:codeIndex.openaiCompatibleProvider": "OpenAI Compatible",
				"settings:codeIndex.openaiKeyLabel": "OpenAI API Key",
				"settings:codeIndex.openaiCompatibleBaseUrlLabel": "Base URL",
				"settings:codeIndex.openaiCompatibleApiKeyLabel": "API Key",
				"settings:codeIndex.modelLabel": "Model",
				"settings:codeIndex.selectModelPlaceholder": "Select model",
				"settings:codeIndex.qdrantUrlLabel": "Qdrant URL",
				"settings:codeIndex.qdrantApiKeyLabel": "Qdrant API Key",
			}
			return translations[key] || key
		},
	}),
}))

// Mock react-i18next
jest.mock("react-i18next", () => ({
	Trans: ({ children }: any) => <div>{children}</div>,
}))

// Mock doc links
jest.mock("@src/utils/docLinks", () => ({
	buildDocLink: jest.fn(() => "https://docs.example.com"),
}))

// Mock UI components
jest.mock("@src/components/ui", () => ({
	Select: ({ children, value, onValueChange }: any) => (
		<div data-testid="select" data-value={value}>
			<button onClick={() => onValueChange && onValueChange("test-change")}>{value}</button>
			{children}
		</div>
	),
	SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
	SelectItem: ({ children, value }: any) => (
		<div data-testid={`select-item-${value}`} data-value={value}>
			{children}
		</div>
	),
	SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
	SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
	AlertDialog: ({ children }: any) => <div data-testid="alert-dialog">{children}</div>,
	AlertDialogAction: ({ children, onClick }: any) => (
		<button data-testid="alert-dialog-action" onClick={onClick}>
			{children}
		</button>
	),
	AlertDialogCancel: ({ children }: any) => <button data-testid="alert-dialog-cancel">{children}</button>,
	AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
	AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
	AlertDialogFooter: ({ children }: any) => <div data-testid="alert-dialog-footer">{children}</div>,
	AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
	AlertDialogTitle: ({ children }: any) => <div data-testid="alert-dialog-title">{children}</div>,
	AlertDialogTrigger: ({ children }: any) => <div data-testid="alert-dialog-trigger">{children}</div>,
}))

// Mock VSCode components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ checked, onChange, children }: any) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange && onChange({ target: { checked: e.target.checked } })}
				data-testid="vscode-checkbox"
			/>
			{children}
		</label>
	),
	VSCodeTextField: ({ value, onInput, type, style, ...props }: any) => (
		<input
			type={type || "text"}
			value={value || ""}
			onChange={(e) => onInput && onInput({ target: { value: e.target.value } })}
			data-testid="vscode-textfield"
			{...props}
		/>
	),
	VSCodeButton: ({ children, onClick, appearance }: any) => (
		<button onClick={onClick} data-testid="vscode-button" data-appearance={appearance}>
			{children}
		</button>
	),
	VSCodeLink: ({ children, href }: any) => (
		<a href={href} data-testid="vscode-link">
			{children}
		</a>
	),
}))

// Mock Radix Progress
jest.mock("@radix-ui/react-progress", () => ({
	Root: ({ children, value }: any) => (
		<div data-testid="progress-root" data-value={value}>
			{children}
		</div>
	),
	Indicator: ({ style }: any) => <div data-testid="progress-indicator" style={style} />,
}))

describe("CodeIndexSettings", () => {
	const mockSetCachedStateField = jest.fn()
	const mockSetApiConfigurationField = jest.fn()

	const defaultProps = {
		codebaseIndexModels: {
			openai: {
				"text-embedding-3-small": { dimension: 1536 },
				"text-embedding-3-large": { dimension: 3072 },
			},
			"openai-compatible": {
				"text-embedding-3-small": { dimension: 1536 },
				"custom-model": { dimension: 768 },
			},
		},
		codebaseIndexConfig: {
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai" as const,
			codebaseIndexEmbedderModelId: "text-embedding-3-small",
			codebaseIndexQdrantUrl: "http://localhost:6333",
		},
		apiConfiguration: {
			codeIndexOpenAiKey: "",
			codebaseIndexOpenAiCompatibleBaseUrl: "",
			codebaseIndexOpenAiCompatibleApiKey: "",
			codeIndexQdrantApiKey: "",
		},
		setCachedStateField: mockSetCachedStateField,
		setApiConfigurationField: mockSetApiConfigurationField,
		areSettingsCommitted: true,
	}

	beforeEach(() => {
		jest.clearAllMocks()
		// Mock window.addEventListener for message handling
		Object.defineProperty(window, "addEventListener", {
			value: jest.fn(),
			writable: true,
		})
		Object.defineProperty(window, "removeEventListener", {
			value: jest.fn(),
			writable: true,
		})
	})

	describe("Provider Selection", () => {
		it("should render OpenAI Compatible provider option", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			expect(screen.getByTestId("select-item-openai-compatible")).toBeInTheDocument()
			expect(screen.getByText("OpenAI Compatible")).toBeInTheDocument()
		})

		it("should show OpenAI Compatible configuration fields when provider is selected", () => {
			const propsWithOpenAICompatible = {
				...defaultProps,
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexEmbedderProvider: "openai-compatible" as const,
				},
			}

			render(<CodeIndexSettings {...propsWithOpenAICompatible} />)

			expect(screen.getByText("Base URL")).toBeInTheDocument()
			expect(screen.getByText("API Key")).toBeInTheDocument()
			expect(screen.getAllByTestId("vscode-textfield")).toHaveLength(3) // Base URL, API Key, Qdrant URL
		})

		it("should hide OpenAI Compatible fields when different provider is selected", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			expect(screen.queryByText("Base URL")).not.toBeInTheDocument()
			expect(screen.getByText("OpenAI API Key")).toBeInTheDocument()
		})

		/**
		 * Test provider switching functionality
		 */
		it("should call setCachedStateField when switching to OpenAI Compatible provider", async () => {
			const user = userEvent.setup()
			render(<CodeIndexSettings {...defaultProps} />)

			const selectButton = screen.getByRole("button")
			await user.click(selectButton)

			expect(mockSetCachedStateField).toHaveBeenCalledWith("codebaseIndexConfig", {
				...defaultProps.codebaseIndexConfig,
				codebaseIndexEmbedderProvider: "test-change",
				codebaseIndexEmbedderModelId: expect.any(String),
			})
		})
	})

	describe("OpenAI Compatible Configuration", () => {
		const openAICompatibleProps = {
			...defaultProps,
			codebaseIndexConfig: {
				...defaultProps.codebaseIndexConfig,
				codebaseIndexEmbedderProvider: "openai-compatible" as const,
			},
		}

		it("should render base URL input field", () => {
			render(<CodeIndexSettings {...openAICompatibleProps} />)

			const textFields = screen.getAllByTestId("vscode-textfield")
			const baseUrlField = textFields.find(
				(field) =>
					field.getAttribute("value") ===
					openAICompatibleProps.apiConfiguration.codebaseIndexOpenAiCompatibleBaseUrl,
			)
			expect(baseUrlField).toBeInTheDocument()
		})

		it("should render API key input field with password type", () => {
			render(<CodeIndexSettings {...openAICompatibleProps} />)

			const passwordFields = screen
				.getAllByTestId("vscode-textfield")
				.filter((field) => field.getAttribute("type") === "password")
			expect(passwordFields.length).toBeGreaterThan(0)
		})

		it("should call setApiConfigurationField when base URL changes", async () => {
			const user = userEvent.setup()
			render(<CodeIndexSettings {...openAICompatibleProps} />)

			const textFields = screen.getAllByTestId("vscode-textfield")
			const baseUrlField = textFields[0] // First text field should be base URL

			await user.type(baseUrlField, "https://api.example.com/v1")

			expect(mockSetApiConfigurationField).toHaveBeenCalledWith(
				"codebaseIndexOpenAiCompatibleBaseUrl",
				expect.stringContaining("https://api.example.com/v1"),
			)
		})

		it("should call setApiConfigurationField when API key changes", async () => {
			const user = userEvent.setup()
			render(<CodeIndexSettings {...openAICompatibleProps} />)

			const passwordFields = screen
				.getAllByTestId("vscode-textfield")
				.filter((field) => field.getAttribute("type") === "password")
			const apiKeyField = passwordFields[0] // First password field should be API key

			await user.type(apiKeyField, "test-api-key")

			expect(mockSetApiConfigurationField).toHaveBeenCalledWith(
				"codebaseIndexOpenAiCompatibleApiKey",
				expect.stringContaining("test-api-key"),
			)
		})

		it("should display current base URL value", () => {
			const propsWithValues = {
				...openAICompatibleProps,
				apiConfiguration: {
					...openAICompatibleProps.apiConfiguration,
					codebaseIndexOpenAiCompatibleBaseUrl: "https://existing-api.example.com/v1",
				},
			}

			render(<CodeIndexSettings {...propsWithValues} />)

			const textField = screen.getByDisplayValue("https://existing-api.example.com/v1")
			expect(textField).toBeInTheDocument()
		})

		it("should display current API key value", () => {
			const propsWithValues = {
				...openAICompatibleProps,
				apiConfiguration: {
					...openAICompatibleProps.apiConfiguration,
					codebaseIndexOpenAiCompatibleApiKey: "existing-api-key",
				},
			}

			render(<CodeIndexSettings {...propsWithValues} />)

			const textField = screen.getByDisplayValue("existing-api-key")
			expect(textField).toBeInTheDocument()
		})
	})

	describe("Model Selection", () => {
		it("should show available models for OpenAI Compatible provider", () => {
			const propsWithOpenAICompatible = {
				...defaultProps,
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexEmbedderProvider: "openai-compatible" as const,
				},
			}

			render(<CodeIndexSettings {...propsWithOpenAICompatible} />)

			expect(screen.getByTestId("select-item-text-embedding-3-small")).toBeInTheDocument()
			expect(screen.getByTestId("select-item-custom-model")).toBeInTheDocument()
		})

		it("should fall back to OpenAI models when OpenAI Compatible models are not available", () => {
			const propsWithoutCompatibleModels = {
				...defaultProps,
				codebaseIndexModels: {
					openai: {
						"text-embedding-3-small": { dimension: 1536 },
						"text-embedding-3-large": { dimension: 3072 },
					},
				},
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexEmbedderProvider: "openai-compatible" as const,
				},
			}

			render(<CodeIndexSettings {...propsWithoutCompatibleModels} />)

			expect(screen.getByTestId("select-item-text-embedding-3-small")).toBeInTheDocument()
			expect(screen.getByTestId("select-item-text-embedding-3-large")).toBeInTheDocument()
		})
	})

	describe("Form Validation", () => {
		it("should handle empty configuration gracefully", () => {
			const emptyProps = {
				...defaultProps,
				codebaseIndexConfig: undefined,
				apiConfiguration: {},
			}

			expect(() => render(<CodeIndexSettings {...emptyProps} />)).not.toThrow()
		})

		it("should handle missing model configuration", () => {
			const propsWithoutModels = {
				...defaultProps,
				codebaseIndexModels: undefined,
			}

			expect(() => render(<CodeIndexSettings {...propsWithoutModels} />)).not.toThrow()
		})

		it("should handle empty API configuration fields", () => {
			const propsWithEmptyConfig = {
				...defaultProps,
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexEmbedderProvider: "openai-compatible" as const,
				},
				apiConfiguration: {
					codebaseIndexOpenAiCompatibleBaseUrl: "",
					codebaseIndexOpenAiCompatibleApiKey: "",
				},
			}

			render(<CodeIndexSettings {...propsWithEmptyConfig} />)

			const textFields = screen.getAllByTestId("vscode-textfield")
			expect(textFields[0]).toHaveValue("")
			expect(textFields[1]).toHaveValue("")
		})
	})

	describe("Integration", () => {
		it("should request indexing status on mount", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "requestIndexingStatus",
			})
		})

		it("should set up message listener for status updates", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			expect(window.addEventListener).toHaveBeenCalledWith("message", expect.any(Function))
		})

		it("should clean up message listener on unmount", () => {
			const { unmount } = render(<CodeIndexSettings {...defaultProps} />)

			unmount()

			expect(window.removeEventListener).toHaveBeenCalledWith("message", expect.any(Function))
		})

		/**
		 * Test indexing status updates
		 */
		it("should update indexing status when receiving status update message", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			// Get the message handler that was registered
			const messageHandler = (window.addEventListener as jest.Mock).mock.calls.find(
				(call) => call[0] === "message",
			)?.[1]

			expect(messageHandler).toBeDefined()

			// Simulate receiving a status update message
			const mockEvent = {
				data: {
					type: "indexingStatusUpdate",
					values: {
						systemStatus: "Indexing",
						message: "Processing files...",
						processedItems: 50,
						totalItems: 100,
						currentItemUnit: "files",
					},
				},
			}

			messageHandler(mockEvent)

			// Check that the status indicator shows "Indexing"
			expect(screen.getByText("Indexing - Processing files...")).toBeInTheDocument()
		})
	})

	describe("Error Handling", () => {
		it("should handle invalid provider gracefully", () => {
			const propsWithInvalidProvider = {
				...defaultProps,
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexEmbedderProvider: "invalid-provider" as any,
				},
			}

			expect(() => render(<CodeIndexSettings {...propsWithInvalidProvider} />)).not.toThrow()
		})

		it("should handle missing translation keys gracefully", () => {
			// Mock translation function to return undefined for some keys
			jest.doMock("@src/i18n/TranslationContext", () => ({
				useAppTranslation: () => ({
					t: (key: string) => (key.includes("missing") ? undefined : key),
				}),
			}))

			expect(() => render(<CodeIndexSettings {...defaultProps} />)).not.toThrow()
		})
	})
})
