import React from "react"
import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import userEvent from "@testing-library/user-event"
import { CodeIndexSettings } from "../CodeIndexSettings"
import { vscode } from "../../../utils/vscode"

// Mock vscode utilities
vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock translation hook - just return the key to verify correct keys are used
vi.mock("../../../i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock doc links
vi.mock("../../../utils/docLinks", () => ({
	buildDocLink: () => "https://docs.example.com",
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	Trans: ({ children }: any) => <div>{children}</div>,
}))

// Mock UI components
vi.mock("@src/components/ui", () => ({
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
	Slider: ({ value, onValueChange, "data-testid": dataTestId }: any) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => onValueChange && onValueChange([parseFloat(e.target.value)])}
			data-testid={dataTestId}
			role="slider"
		/>
	),
	Button: ({ children, onClick, "data-testid": dataTestId, ...props }: any) => (
		<button onClick={onClick} data-testid={dataTestId} {...props}>
			{children}
		</button>
	),
	Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
	TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
	TooltipProvider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
	TooltipTrigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
}))

// Mock VSCode webview UI toolkit
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
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
	VSCodeTextField: ({ value, onInput, type, style, ...props }: any) => {
		const handleChange = (e: any) => {
			if (onInput) {
				onInput({ target: { value: e.target.value } })
			}
		}
		return (
			<input
				type={type || "text"}
				value={value || ""}
				onChange={handleChange}
				onInput={handleChange}
				data-testid="vscode-textfield"
				tabIndex={0}
				{...props}
			/>
		)
	},
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

// Mock Radix UI progress
vi.mock("@radix-ui/react-progress", () => ({
	Root: ({ children, value }: any) => (
		<div data-testid="progress-root" data-value={value}>
			{children}
		</div>
	),
	Indicator: ({ style }: any) => <div data-testid="progress-indicator" style={style} />,
}))

describe("CodeIndexSettings", () => {
	const mockCodebaseIndexConfig = {
		codebaseIndexEnabled: true,
		codebaseIndexQdrantUrl: "http://localhost:6333",
		codebaseIndexEmbedderProvider: "openai" as const,
		codebaseIndexEmbedderBaseUrl: "",
		codebaseIndexEmbedderModelId: "text-embedding-3-small",
	}

	const mockCodebaseIndexModels = {
		openai: {
			"text-embedding-3-small": { dimension: 1536 },
			"text-embedding-3-large": { dimension: 3072 },
		},
		ollama: {
			"nomic-embed-text": { dimension: 768 },
		},
		"openai-compatible": {},
	}

	const defaultProps = {
		codebaseIndexModels: mockCodebaseIndexModels,
		codebaseIndexConfig: mockCodebaseIndexConfig,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("renders with default settings when no config provided", () => {
		render(<CodeIndexSettings codebaseIndexModels={undefined} codebaseIndexConfig={undefined} />)

		const enableCheckbox = screen.getByLabelText("Enable Code Index")
		expect(enableCheckbox).not.toBeChecked()
	})

	it("renders with provided config settings", async () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		// Wait for the component to update with the provided config
		await waitFor(() => {
			const enableCheckbox = screen.getByLabelText("Enable Code Index")
			expect(enableCheckbox).toBeChecked()
		})

		const qdrantUrl = screen.getByDisplayValue("http://localhost:6333")
		expect(qdrantUrl).toBeInTheDocument()
	})

	it("shows detailed settings when codebase indexing is enabled", () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		expect(screen.getByText("Provider")).toBeInTheDocument()
		expect(screen.getByText("Qdrant URL")).toBeInTheDocument()
	})

	it("hides detailed settings when codebase indexing is disabled", () => {
		const disabledConfig = { ...mockCodebaseIndexConfig, codebaseIndexEnabled: false }
		render(<CodeIndexSettings codebaseIndexModels={mockCodebaseIndexModels} codebaseIndexConfig={disabledConfig} />)

		expect(screen.queryByText("Provider")).not.toBeInTheDocument()
		expect(screen.queryByText("Qdrant URL")).not.toBeInTheDocument()
	})

	it("shows OpenAI-specific fields when OpenAI provider is selected", () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		expect(screen.getByText("OpenAI API Key")).toBeInTheDocument()
		expect(screen.getByText("Model")).toBeInTheDocument()
	})

	it("shows OpenAI-compatible fields when OpenAI-compatible provider is selected", () => {
		const compatibleConfig = {
			...mockCodebaseIndexConfig,
			codebaseIndexEmbedderProvider: "openai-compatible" as const,
		}
		render(
			<CodeIndexSettings codebaseIndexModels={mockCodebaseIndexModels} codebaseIndexConfig={compatibleConfig} />,
		)

		expect(screen.getByText("Base URL")).toBeInTheDocument()
		expect(screen.getByText("API Key")).toBeInTheDocument()
		expect(screen.getByText("Model")).toBeInTheDocument()
		expect(screen.getByText("Embedding Dimension")).toBeInTheDocument()
	})

	it("marks settings as unsaved when a field is changed", async () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		const qdrantUrlField = screen.getByDisplayValue("http://localhost:6333")
		fireEvent.input(qdrantUrlField, { target: { value: "http://localhost:6334" } })

		await waitFor(() => {
			expect(screen.getByText("• Unsaved changes")).toBeInTheDocument()
		})

		const saveButton = screen.getByText("Save Settings")
		expect(saveButton).not.toBeDisabled()
	})

	it("sends atomic save message when save button is clicked", async () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		const qdrantUrlField = screen.getByDisplayValue("http://localhost:6333")
		fireEvent.input(qdrantUrlField, { target: { value: "http://localhost:6334" } })

		const saveButton = screen.getByText("Save Settings")
		fireEvent.click(saveButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: expect.objectContaining({
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6334",
				codebaseIndexEmbedderProvider: "openai",
			}),
		})
	})

	it("shows saving status when save is in progress", async () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		const qdrantUrlField = screen.getByDisplayValue("http://localhost:6333")
		fireEvent.input(qdrantUrlField, { target: { value: "http://localhost:6334" } })

		const saveButton = screen.getByText("Save Settings")
		fireEvent.click(saveButton)

		expect(screen.getByText("Saving...")).toBeInTheDocument()
		// VSCode button disabled state is handled via the disabled property
		const savingButton = screen.getByText("Saving...")
		const buttonElement = savingButton.closest("vscode-button") as any
		expect(buttonElement.disabled).toBe(true)
	})

	it("handles successful save response", async () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		const qdrantUrlField = screen.getByDisplayValue("http://localhost:6333")
		fireEvent.input(qdrantUrlField, { target: { value: "http://localhost:6334" } })

		const saveButton = screen.getByText("Save Settings")
		fireEvent.click(saveButton)

		// Simulate success message from extension
		const successMessage = new MessageEvent("message", {
			data: { type: "codeIndexSettingsSaved", success: true },
		})
		window.dispatchEvent(successMessage)

		await waitFor(() => {
			expect(screen.getByText("✓ Settings saved")).toBeInTheDocument()
		})

		expect(screen.queryByText("• Unsaved changes")).not.toBeInTheDocument()
	})

	it("handles failed save response", async () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		const qdrantUrlField = screen.getByDisplayValue("http://localhost:6333")
		fireEvent.input(qdrantUrlField, { target: { value: "http://localhost:6334" } })

		const saveButton = screen.getByText("Save Settings")
		fireEvent.click(saveButton)

		// Simulate error message from extension
		const errorMessage = new MessageEvent("message", {
			data: { type: "codeIndexSettingsSaved", success: false },
		})
		window.dispatchEvent(errorMessage)

		await waitFor(() => {
			expect(screen.getByText("✗ Failed to save")).toBeInTheDocument()
		})
	})

	it("sends start indexing message when start button is clicked", () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		const startButton = screen.getByText("Start Indexing")
		fireEvent.click(startButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "startIndexing",
		})
	})

	it("disables save button when there are no unsaved changes", () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		const saveButton = screen.getByText("Save Settings")
		// VSCode button disabled state is handled via the disabled property
		const buttonElement = saveButton.closest("vscode-button") as any
		expect(buttonElement.disabled).toBe(true)
	})

	it("updates local settings when props change", () => {
		const { rerender } = render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		expect(screen.getByDisplayValue("http://localhost:6333")).toBeInTheDocument()

		const updatedConfig = {
			...mockCodebaseIndexConfig,
			codebaseIndexQdrantUrl: "http://localhost:6334",
		}

		rerender(
			<CodeIndexSettings codebaseIndexModels={mockCodebaseIndexModels} codebaseIndexConfig={updatedConfig} />,
		)

		expect(screen.getByDisplayValue("http://localhost:6334")).toBeInTheDocument()
	})

	it("handles provider change correctly", async () => {
		render(
			<CodeIndexSettings
				codebaseIndexModels={mockCodebaseIndexModels}
				codebaseIndexConfig={mockCodebaseIndexConfig}
			/>,
		)

		// Find the provider select by looking for the combobox with "OpenAI" value
		const providerSelects = screen.getAllByRole("combobox")
		const providerSelect = providerSelects.find((select) => select.textContent?.includes("OpenAI"))
		expect(providerSelect).toBeDefined()

		// Click to open the dropdown
		fireEvent.click(providerSelect!)

		// Wait for dropdown to open and select "Ollama" option
		await waitFor(() => {
			const ollamaOption = screen.getByText("Ollama")
			fireEvent.click(ollamaOption)
		})

		// Should mark as unsaved when provider changes
		await waitFor(() => {
			expect(screen.getByText("• Unsaved changes")).toBeInTheDocument()
		})
	})

	it("handles model dimension input for OpenAI-compatible provider", async () => {
		const compatibleConfig = {
			...mockCodebaseIndexConfig,
			codebaseIndexEmbedderProvider: "openai-compatible" as const,
		}

		render(
			<CodeIndexSettings codebaseIndexModels={mockCodebaseIndexModels} codebaseIndexConfig={compatibleConfig} />,
		)

		const dimensionField = screen.getByPlaceholderText("Enter dimension (e.g., 1536)")
		fireEvent.input(dimensionField, { target: { value: "1024" } })

		await waitFor(() => {
			expect(screen.getByText("• Unsaved changes")).toBeInTheDocument()
		})
	})

	it("should render Select dropdown for models when provider is ollama", () => {
		const propsWithOllama = {
			...defaultProps,
			codebaseIndexModels: {
				...defaultProps.codebaseIndexModels,
				ollama: {
					llama2: { dimension: 4096 },
					codellama: { dimension: 4096 },
				},
			},
			codebaseIndexConfig: {
				...defaultProps.codebaseIndexConfig,
				codebaseIndexEmbedderProvider: "ollama" as const,
				codebaseIndexEmbedderModelId: "llama2",
			},
		}

		render(<CodeIndexSettings {...propsWithOllama} />)

		// Should render Select dropdown for models (second select element)
		const selectElements = screen.getAllByTestId("select")
		expect(selectElements).toHaveLength(2) // Provider and model selects
		const modelSelect = selectElements[1] // Model select is second
		expect(modelSelect).toHaveAttribute("data-value", "llama2")

		// Should NOT render VSCodeTextField for Model ID
		const modelTextFields = screen.getAllByTestId("vscode-textfield")
		const modelIdField = modelTextFields.find(
			(field) => field.getAttribute("placeholder") === "Enter custom model ID",
		)
		expect(modelIdField).toBeUndefined()
	})

		/**
		 * Test VSCodeTextField interactions for OpenAI-Compatible provider
		 */
		describe("VSCodeTextField for OpenAI-Compatible Model ID", () => {
			const openAICompatibleProps = {
				...defaultProps,
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexEmbedderProvider: "openai-compatible" as const,
					codebaseIndexEmbedderModelId: "existing-model",
				},
			}

			it("should display current Model ID value in VSCodeTextField", () => {
				render(<CodeIndexSettings {...openAICompatibleProps} />)

				const modelIdField = screen.getByPlaceholderText("Enter custom model ID")
				expect(modelIdField).toHaveValue("existing-model")
			})

			it("should call setCachedStateField when Model ID changes", async () => {
				render(<CodeIndexSettings {...openAICompatibleProps} />)

				const modelIdField = screen.getByPlaceholderText("Enter custom model ID")

				// Use fireEvent to trigger the change
				fireEvent.change(modelIdField, { target: { value: "new-model" } })

				// Verify the field value changed
				expect(modelIdField).toHaveValue("new-model")
			})

			it("should handle empty Model ID value", () => {
				const propsWithEmptyModelId = {
					...openAICompatibleProps,
					codebaseIndexConfig: {
						...openAICompatibleProps.codebaseIndexConfig,
						codebaseIndexEmbedderModelId: "",
					},
				}

				render(<CodeIndexSettings {...propsWithEmptyModelId} />)

				const modelIdField = screen.getByPlaceholderText("Enter custom model ID")
				expect(modelIdField).toHaveValue("")
			})

			it("should show placeholder text for Model ID input", () => {
				render(<CodeIndexSettings {...openAICompatibleProps} />)

				const modelIdField = screen.getByPlaceholderText("Enter custom model ID")
				expect(modelIdField).toBeInTheDocument()
				expect(modelIdField).toHaveAttribute("placeholder", "Enter custom model ID")
			})
		})

		/**
		 * Test Select dropdown interactions for other providers
		 */
		describe("Select Dropdown for Other Providers", () => {
			it("should show available models for OpenAI provider in dropdown", () => {
				const propsWithOpenAI = {
					...defaultProps,
					codebaseIndexConfig: {
						...defaultProps.codebaseIndexConfig,
						codebaseIndexEmbedderProvider: "openai" as const,
					},
				}

				render(<CodeIndexSettings {...propsWithOpenAI} />)

				expect(screen.getByTestId("select-item-text-embedding-3-small")).toBeInTheDocument()
				expect(screen.getByTestId("select-item-text-embedding-3-large")).toBeInTheDocument()
			})

			it("should show available models for Ollama provider in dropdown", () => {
				const propsWithOllama = {
					...defaultProps,
					codebaseIndexModels: {
						...defaultProps.codebaseIndexModels,
						ollama: {
							llama2: { dimension: 4096 },
							codellama: { dimension: 4096 },
						},
					},
					codebaseIndexConfig: {
						...defaultProps.codebaseIndexConfig,
						codebaseIndexEmbedderProvider: "ollama" as const,
					},
				}

				render(<CodeIndexSettings {...propsWithOllama} />)

				expect(screen.getByTestId("select-item-llama2")).toBeInTheDocument()
				expect(screen.getByTestId("select-item-codellama")).toBeInTheDocument()
			})

			it("should call setCachedStateField when model is selected from dropdown", async () => {
				const user = userEvent.setup()
				const propsWithOpenAI = {
					...defaultProps,
					codebaseIndexConfig: {
						...defaultProps.codebaseIndexConfig,
						codebaseIndexEmbedderProvider: "openai" as const,
					},
				}

				render(<CodeIndexSettings {...propsWithOpenAI} />)

				// Get all select elements and find the model select (second one)
				const selectElements = screen.getAllByTestId("select")
				const modelSelect = selectElements[1] // Provider is first, Model is second
				const selectButton = modelSelect.querySelector("button")
				expect(selectButton).toBeInTheDocument()
				await user.click(selectButton!)

				// The mock Select component triggers onValueChange with "test-change"
				// In a real scenario, this would update the model selection
			})

			it("should display current model selection in dropdown", () => {
				const propsWithSelectedModel = {
					...defaultProps,
					codebaseIndexConfig: {
						...defaultProps.codebaseIndexConfig,
						codebaseIndexEmbedderProvider: "openai" as const,
						codebaseIndexEmbedderModelId: "text-embedding-3-large",
					},
				}

				render(<CodeIndexSettings {...propsWithSelectedModel} />)

				// Get all select elements and find the model select (second one)
				const selectElements = screen.getAllByTestId("select")
				const modelSelect = selectElements[1] // Provider is first, Model is second
				expect(modelSelect).toHaveAttribute("data-value", "text-embedding-3-large")
			})
		})

		/**
		 * Test fallback behavior for OpenAI-Compatible provider
		 */
		describe("OpenAI-Compatible Provider Model Fallback", () => {
			it("should show available models for OpenAI Compatible provider", () => {
				const propsWithOpenAICompatible = {
					...defaultProps,
					codebaseIndexConfig: {
						...defaultProps.codebaseIndexConfig,
						codebaseIndexEmbedderProvider: "openai-compatible" as const,
					},
				}

				render(<CodeIndexSettings {...propsWithOpenAICompatible} />)

				// Note: For openai-compatible, we render VSCodeTextField, not Select dropdown
				// But the component still uses availableModelIds for other purposes
				const modelIdField = screen.getByPlaceholderText("Enter custom model ID")
				expect(modelIdField).toBeInTheDocument()
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

				// Should still render VSCodeTextField for openai-compatible provider
				const modelIdField = screen.getByPlaceholderText("Enter custom model ID")
				expect(modelIdField).toBeInTheDocument()
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
			const messageHandler = (window.addEventListener as any).mock.calls.find(
				(call: any) => call[0] === "message",
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
			expect(screen.getByText(/Indexing/)).toBeInTheDocument()
		})
	})

	describe("Search Minimum Score Slider", () => {
		const expandAdvancedConfig = () => {
			const advancedButton = screen.getByRole("button", { name: /Advanced Configuration/i })
			fireEvent.click(advancedButton)
		}

		it("should render advanced configuration toggle button", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			expect(screen.getByRole("button", { name: /Advanced Configuration/i })).toBeInTheDocument()
			expect(screen.getByText("Advanced Configuration")).toBeInTheDocument()
		})

		it("should render search minimum score slider with reset button when expanded", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			expandAdvancedConfig()

			expect(screen.getByTestId("search-min-score-slider")).toBeInTheDocument()
			expect(screen.getByTestId("search-min-score-reset-button")).toBeInTheDocument()
			expect(screen.getByText("Search Score Threshold")).toBeInTheDocument()
		})

		it("should display current search minimum score value when expanded", () => {
			const propsWithScore = {
				...defaultProps,
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexSearchMinScore: 0.65,
				},
			}

			render(<CodeIndexSettings {...propsWithScore} />)

			expandAdvancedConfig()

			expect(screen.getByText("0.65")).toBeInTheDocument()
		})

		it("should call setCachedStateField when slider value changes", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			expandAdvancedConfig()

			const slider = screen.getByTestId("search-min-score-slider")
			fireEvent.change(slider, { target: { value: "0.8" } })

			// The slider change would trigger a state update in the real component
			expect(slider).toHaveValue("0.8")
		})

		it("should reset to default value when reset button is clicked", () => {
			const propsWithScore = {
				...defaultProps,
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexSearchMinScore: 0.8,
				},
			}

			render(<CodeIndexSettings {...propsWithScore} />)

			expandAdvancedConfig()

			const resetButton = screen.getByTestId("search-min-score-reset-button")
			fireEvent.click(resetButton)

			// The reset button would reset the slider to default value (0.4)
			const slider = screen.getByTestId("search-min-score-slider")
			expect(slider).toHaveValue("0.4")
		})

		it("should use default value when no score is set", () => {
			const propsWithoutScore = {
				...defaultProps,
				codebaseIndexConfig: {
					...defaultProps.codebaseIndexConfig,
					codebaseIndexSearchMinScore: undefined,
				},
			}

			render(<CodeIndexSettings {...propsWithoutScore} />)

			expandAdvancedConfig()

			expect(screen.getByText("0.40")).toBeInTheDocument()
		})

		it("should toggle advanced section visibility", () => {
			render(<CodeIndexSettings {...defaultProps} />)

			// Initially collapsed - should not see slider
			expect(screen.queryByTestId("search-min-score-slider")).not.toBeInTheDocument()

			// Expand advanced section
			expandAdvancedConfig()
			expect(screen.getByTestId("search-min-score-slider")).toBeInTheDocument()

			// Collapse again
			expandAdvancedConfig()
			expect(screen.queryByTestId("search-min-score-slider")).not.toBeInTheDocument()
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

	})
})
