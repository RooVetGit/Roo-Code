import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { VsCodeLmHandler } from "../vscode-lm"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
	},
	lm: {
		selectChatModels: vi.fn(),
	},
	LanguageModelChatMessage: {
		Assistant: vi.fn((content) => ({ role: "assistant", content })),
		User: vi.fn((content) => ({ role: "user", content })),
	},
	CancellationError: class extends Error {
		constructor(message?: string) {
			super(message)
			this.name = "CancellationError"
		}
	},
	CancellationTokenSource: vi.fn(() => ({
		token: {},
		cancel: vi.fn(),
		dispose: vi.fn(),
	})),
}))

describe("VsCodeLmHandler Content Filtering", () => {
	let handler: VsCodeLmHandler
	let mockClient: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockClient = {
			id: "test-model",
			name: "Test Model",
			vendor: "test",
			family: "test",
			version: "1.0",
			maxInputTokens: 8192,
			sendRequest: vi.fn(),
			countTokens: vi.fn().mockResolvedValue(10),
		}

		vi.mocked(vscode.lm.selectChatModels).mockResolvedValue([mockClient])

		handler = new VsCodeLmHandler({
			vsCodeLmModelSelector: { vendor: "test", family: "test" },
		})
	})

	describe("Content Filtering Error Detection", () => {
		it("should detect content filtering errors in Error objects", async () => {
			const filteringError = new Error("Response was filtered by content policy")
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Response was filtered by VS Code's content policy/)
		})

		it("should detect content filtering errors with 'inappropriate' keyword", async () => {
			const filteringError = new Error("Content deemed inappropriate")
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Response was filtered by VS Code's content policy/)
		})

		it("should detect content filtering errors with 'safety' keyword", async () => {
			const filteringError = new Error("Safety violation detected")
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Response was filtered by VS Code's content policy/)
		})

		it("should detect content filtering errors with 'blocked' keyword", async () => {
			const filteringError = new Error("Request blocked by policy")
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Response was filtered by VS Code's content policy/)
		})

		it("should detect content filtering errors in error objects", async () => {
			const filteringError = {
				message: "Content filtered",
				code: "CONTENT_POLICY_VIOLATION",
			}
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Response was filtered by VS Code's content policy/)
		})

		it("should detect content filtering errors in error objects with reason property", async () => {
			const filteringError = {
				reason: "Content policy violation",
				type: "FILTERING_ERROR",
			}
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Response was filtered by VS Code's content policy/)
		})

		it("should not detect content filtering for regular errors", async () => {
			const regularError = new Error("Network timeout")
			mockClient.sendRequest.mockRejectedValue(regularError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow("Network timeout")
		})

		it("should handle cancellation errors correctly", async () => {
			const cancellationError = new vscode.CancellationError()
			mockClient.sendRequest.mockRejectedValue(cancellationError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Request cancelled by user/)
		})

		it("should provide helpful error message for content filtering", async () => {
			const filteringError = new Error("Response got filtered FIX!!")
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			try {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const errorMessage = (error as Error).message
				expect(errorMessage).toContain("Response was filtered by VS Code's content policy")
				expect(errorMessage).toContain("Try rephrasing your request")
				expect(errorMessage).toContain("Original error: Response got filtered FIX!!")
			}
		})
	})

	describe("Case Insensitive Detection", () => {
		it("should detect content filtering errors case-insensitively", async () => {
			const filteringError = new Error("CONTENT POLICY VIOLATION")
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Response was filtered by VS Code's content policy/)
		})

		it("should detect content filtering in error name case-insensitively", async () => {
			const filteringError = new Error("Some error")
			filteringError.name = "CONTENT_FILTERED_ERROR"
			mockClient.sendRequest.mockRejectedValue(filteringError)

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hello" }]

			await expect(async () => {
				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Should not reach here
				}
			}).rejects.toThrow(/Response was filtered by VS Code's content policy/)
		})
	})
})
