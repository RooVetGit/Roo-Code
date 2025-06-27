import React from "react"
import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CodeIndexSettings } from "../CodeIndexSettings"
import { vscode } from "../../../utils/vscode"

// Mock vscode utilities
vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock translation hook
vi.mock("../../../i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"settings:codeIndex.enableLabel": "Enable Code Index",
				"settings:codeIndex.enableDescription": "Enable semantic search",
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
				"settings:codeIndex.openaiCompatibleModelDimensionLabel": "Embedding Dimension",
				"settings:codeIndex.openaiCompatibleModelDimensionPlaceholder": "Enter dimension (e.g., 1536)",
				"settings:codeIndex.openaiCompatibleModelDimensionDescription": "The dimension of the embedding model",
				"settings:codeIndex.ollamaUrlLabel": "Ollama URL",
				"settings:codeIndex.qdrantUrlLabel": "Qdrant URL",
				"settings:codeIndex.qdrantKeyLabel": "Qdrant API Key",
				"settings:codeIndex.startIndexingButton": "Start Indexing",
				"settings:codeIndex.clearIndexDataButton": "Clear Index Data",
				"settings:codeIndex.clearDataDialog.title": "Clear Index Data",
				"settings:codeIndex.clearDataDialog.description": "This will clear all indexed data",
				"settings:codeIndex.clearDataDialog.cancelButton": "Cancel",
				"settings:codeIndex.clearDataDialog.confirmButton": "Confirm",
				"settings:codeIndex.unsavedSettingsMessage": "You have unsaved settings",
			}
			return translations[key] || key
		},
	}),
}))

// Mock doc links
vi.mock("../../../utils/docLinks", () => ({
	buildDocLink: () => "https://docs.example.com",
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
})
