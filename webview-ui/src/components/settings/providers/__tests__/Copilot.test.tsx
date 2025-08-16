import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
import { Copilot } from "../Copilot"
import { useEvent } from "react-use"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"
import type { OrganizationAllowList } from "@roo/cloud"

// Mock dependencies
vi.mock("react-use", () => ({
	useEvent: vi.fn(),
}))
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: vi.fn(),
}))
vi.mock("@src/components/common/VSCodeButtonLink", () => ({
	VSCodeButtonLink: ({ children, href, onClick, ...props }: any) => (
		<a href={href} onClick={onClick} {...props}>
			{children}
		</a>
	),
}))
vi.mock("../ModelPicker", () => ({
	ModelPicker: ({ models, serviceName }: any) => (
		<div data-testid="model-picker">
			Model Picker for {serviceName}: {Object.keys(models || {}).length} models
		</div>
	),
}))

describe("Copilot Component", () => {
	const mockUseEvent = useEvent as Mock
	const mockPostMessage = vscode.postMessage as Mock
	const mockTranslation = useAppTranslation as Mock

	const defaultProps = {
		apiConfiguration: { apiProvider: "copilot" } as ProviderSettings,
		setApiConfigurationField: vi.fn(),
		organizationAllowList: { allowAll: true, providers: {} } as OrganizationAllowList,
		modelValidationError: undefined,
	}

	const mockT = vi.fn((key: string, options?: any) => {
		const translations: Record<string, string> = {
			"settings:providers.copilotAuthentication": "GitHub Copilot Authentication",
			"settings:providers.copilotDeviceCodeNotice":
				"GitHub Copilot uses OAuth device code flow for secure authentication.",
			"settings:providers.authenticating": "Authenticating...",
			"settings:providers.waitingForAuth": "Waiting for authentication...",
			"settings:providers.authenticateWithGitHub": "Authenticate with GitHub",
			"settings:providers.authenticated": "Authenticated",
			"settings:providers.clearAuthentication": "Clear Authentication",
			"settings:providers.copilotModelDescription": "Allows you to use models on Copilot",
		}
		return options ? key.replace("{{modelId}}", options.modelId) : translations[key] || key
	})

	beforeEach(() => {
		vi.clearAllMocks()
		mockTranslation.mockReturnValue({ t: mockT })

		// Mock the useEvent hook to simulate message handling
		let messageHandler: (event: MessageEvent) => void
		mockUseEvent.mockImplementation((eventType: string, handler: any) => {
			if (eventType === "message") {
				messageHandler = handler
			}
		})

		// Helper to simulate messages from extension
		;(global as any).simulateMessage = (message: any) => {
			if (messageHandler) {
				messageHandler({ data: message } as MessageEvent)
			}
		}
	})

	describe("Authentication Flow", () => {
		it("should render authentication section when not authenticated", () => {
			render(<Copilot {...defaultProps} />)

			expect(screen.getByText("GitHub Copilot Authentication")).toBeInTheDocument()
			expect(
				screen.getByText("GitHub Copilot uses OAuth device code flow for secure authentication."),
			).toBeInTheDocument()
			expect(screen.getByText("Authenticate with GitHub")).toBeInTheDocument()
		})

		it("should send checkCopilotAuth message on mount", () => {
			render(<Copilot {...defaultProps} />)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "checkCopilotAuth",
			})
		})

		it("should handle authentication button click", () => {
			render(<Copilot {...defaultProps} />)

			const authButton = screen.getByText("Authenticate with GitHub")
			fireEvent.click(authButton)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "authenticateCopilot",
			})
		})

		it("should show authenticating state", () => {
			render(<Copilot {...defaultProps} />)

			const authButton = screen.getByText("Authenticate with GitHub")
			fireEvent.click(authButton)

			expect(screen.getByText("Authenticating...")).toBeInTheDocument()
			expect(authButton).toBeDisabled()
		})

		it("should display device code information during authentication", async () => {
			render(<Copilot {...defaultProps} />)

			// Start authentication
			const authButton = screen.getByText("Authenticate with GitHub")
			fireEvent.click(authButton)

			// Simulate device code message
			;(global as any).simulateMessage({
				type: "copilotDeviceCode",
				copilotDeviceCode: {
					user_code: "ABCD-1234",
					verification_uri: "https://github.com/login/device",
					expires_in: 900,
				},
			})

			await waitFor(() => {
				expect(screen.getByText("🔐 GitHub Authentication Required")).toBeInTheDocument()
				expect(screen.getByText("ABCD-1234")).toBeInTheDocument()
				expect(screen.getByText("https://github.com/login/device")).toBeInTheDocument()
				expect(screen.getByText(/Code expires in \d+ minutes/)).toBeInTheDocument()
			})
		})

		it("should handle copy device code button", async () => {
			// Mock clipboard API
			Object.assign(navigator, {
				clipboard: {
					writeText: vi.fn(),
				},
			})

			render(<Copilot {...defaultProps} />)

			// Start authentication and get device code
			const authButton = screen.getByText("Authenticate with GitHub")
			fireEvent.click(authButton)
			;(global as any).simulateMessage({
				type: "copilotDeviceCode",
				copilotDeviceCode: {
					user_code: "ABCD-1234",
					verification_uri: "https://github.com/login/device",
					expires_in: 900,
				},
			})

			await waitFor(() => {
				const copyButton = screen.getByText("Copy")
				fireEvent.click(copyButton)

				expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ABCD-1234")
			})
		})

		it("should show authenticated state", async () => {
			render(<Copilot {...defaultProps} />)

			// Simulate successful authentication
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})

			await waitFor(() => {
				expect(screen.getByText("✓")).toBeInTheDocument()
				expect(screen.getByText("Authenticated")).toBeInTheDocument()
				expect(screen.getByText("Clear Authentication")).toBeInTheDocument()
			})
		})

		it("should handle clear authentication", async () => {
			render(<Copilot {...defaultProps} />)

			// First authenticate
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})

			await waitFor(() => {
				const clearButton = screen.getByText("Clear Authentication")
				fireEvent.click(clearButton)

				expect(mockPostMessage).toHaveBeenCalledWith({
					type: "clearCopilotAuth",
				})
			})
		})

		it("should display authentication errors", async () => {
			render(<Copilot {...defaultProps} />)
			;(global as any).simulateMessage({
				type: "copilotAuthError",
				error: "Authentication failed due to network error",
			})

			await waitFor(() => {
				expect(screen.getByText("❌ Authentication Failed")).toBeInTheDocument()
				expect(screen.getByText("Authentication failed due to network error")).toBeInTheDocument()
			})
		})
	})

	describe("Model Management", () => {
		it("should request models when authenticated", async () => {
			render(<Copilot {...defaultProps} />)
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})

			await waitFor(() => {
				expect(mockPostMessage).toHaveBeenCalledWith({
					type: "requestCopilotModels",
				})
			})
		})

		it("should display model picker when models are available", async () => {
			render(<Copilot {...defaultProps} />)

			// Authenticate first
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})

			// Provide models
			;(global as any).simulateMessage({
				type: "copilotModels",
				copilotModels: {
					"claude-4": {
						maxTokens: 8192,
						contextWindow: 200000,
						description: "Claude 4",
					} as ModelInfo,
					"gpt-4": {
						maxTokens: 8192,
						contextWindow: 128000,
						description: "GPT-4",
					} as ModelInfo,
				},
			})

			await waitFor(() => {
				expect(screen.getByTestId("model-picker")).toBeInTheDocument()
				expect(screen.getByText("Model Picker for Copilot: 2 models")).toBeInTheDocument()
			})
		})

		it("should show description when no models available", async () => {
			render(<Copilot {...defaultProps} />)
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})
			;(global as any).simulateMessage({
				type: "copilotModels",
				copilotModels: {},
			})

			await waitFor(() => {
				expect(screen.getByText("Allows you to use models on Copilot")).toBeInTheDocument()
			})
		})

		it("should display model validation errors", async () => {
			const propsWithError = {
				...defaultProps,
				modelValidationError: "Selected model is not available",
			}

			render(<Copilot {...propsWithError} />)
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})

			await waitFor(() => {
				expect(screen.getByText("Selected model is not available")).toBeInTheDocument()
			})
		})
	})

	describe("State Management", () => {
		it("should clear device code and error on successful authentication", async () => {
			render(<Copilot {...defaultProps} />)

			// First show an error
			;(global as any).simulateMessage({
				type: "copilotAuthError",
				error: "Network error",
			})

			await waitFor(() => {
				expect(screen.getByText("Network error")).toBeInTheDocument()
			})

			// Then authenticate successfully
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})

			await waitFor(() => {
				expect(screen.queryByText("Network error")).not.toBeInTheDocument()
				expect(screen.getByText("Authenticated")).toBeInTheDocument()
			})
		})

		it("should clear models when authentication is lost", async () => {
			render(<Copilot {...defaultProps} />)

			// First authenticate and get models
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})
			;(global as any).simulateMessage({
				type: "copilotModels",
				copilotModels: {
					"claude-4": { description: "Claude 4" } as ModelInfo,
				},
			})

			await waitFor(() => {
				expect(screen.getByTestId("model-picker")).toBeInTheDocument()
			})

			// Then lose authentication
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: false,
			})

			await waitFor(() => {
				expect(screen.queryByTestId("model-picker")).not.toBeInTheDocument()
				expect(screen.getByText("Authenticate with GitHub")).toBeInTheDocument()
			})
		})

		it("should reset states when starting new authentication", () => {
			render(<Copilot {...defaultProps} />)

			// Show error first
			;(global as any).simulateMessage({
				type: "copilotAuthError",
				error: "Previous error",
			})

			// Start new authentication
			const authButton = screen.getByText("Authenticate with GitHub")
			fireEvent.click(authButton)

			expect(screen.queryByText("Previous error")).not.toBeInTheDocument()
		})
	})

	describe("UI States", () => {
		it("should show waiting for auth when device code is provided", async () => {
			render(<Copilot {...defaultProps} />)

			// Start auth and provide device code
			const authButton = screen.getByText("Authenticate with GitHub")
			fireEvent.click(authButton)
			;(global as any).simulateMessage({
				type: "copilotDeviceCode",
				copilotDeviceCode: {
					user_code: "ABCD-1234",
					verification_uri: "https://github.com/login/device",
					expires_in: 900,
				},
			})

			await waitFor(() => {
				expect(screen.getByText("Waiting for authentication...")).toBeInTheDocument()
			})
		})

		it("should handle empty models gracefully", async () => {
			render(<Copilot {...defaultProps} />)
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})
			;(global as any).simulateMessage({
				type: "copilotModels",
				copilotModels: null,
			})

			await waitFor(() => {
				expect(screen.getByText("Allows you to use models on Copilot")).toBeInTheDocument()
			})
		})

		it("should disable authenticate button when authenticating", () => {
			render(<Copilot {...defaultProps} />)

			const authButton = screen.getByText("Authenticate with GitHub") as HTMLButtonElement
			fireEvent.click(authButton)

			expect(authButton.disabled).toBe(true)
		})

		it("should not request models when not authenticated", async () => {
			render(<Copilot {...defaultProps} />)
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: false,
			})

			// Wait a bit to ensure no additional calls
			await new Promise((resolve) => setTimeout(resolve, 100))

			expect(mockPostMessage).not.toHaveBeenCalledWith({
				type: "requestCopilotModels",
			})
		})
	})

	describe("Message Handling", () => {
		it("should handle multiple message types correctly", async () => {
			render(<Copilot {...defaultProps} />)

			// Send multiple messages in sequence
			;(global as any).simulateMessage({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})
			;(global as any).simulateMessage({
				type: "copilotModels",
				copilotModels: {
					"test-model": { description: "Test Model" } as ModelInfo,
				},
			})
			;(global as any).simulateMessage({
				type: "copilotAuthError",
				error: "Some error",
			})

			await waitFor(() => {
				// Should process all messages appropriately
				expect(screen.getByText("Some error")).toBeInTheDocument()
			})
		})

		it("should ignore unknown message types", () => {
			render(<Copilot {...defaultProps} />)

			// This should not throw an error
			;(global as any).simulateMessage({
				type: "unknownMessageType",
				data: "some data",
			})

			expect(screen.getByText("Authenticate with GitHub")).toBeInTheDocument()
		})
	})
})
