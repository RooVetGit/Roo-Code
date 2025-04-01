import { HumanRelayHandler } from "../human-relay"
import * as vscode from "vscode"

jest.mock("vscode", () => ({
	env: {
		clipboard: {
			writeText: jest.fn(),
		},
	},
	commands: {
		executeCommand: jest.fn(),
	},
}))

describe("HumanRelayHandler", () => {
	let handler: HumanRelayHandler
	const mockClipboardWrite = vscode.env.clipboard.writeText as jest.Mock
	const mockExecuteCommand = vscode.commands.executeCommand as jest.Mock

	beforeEach(() => {
		handler = new HumanRelayHandler({})
		mockClipboardWrite.mockClear()
		mockExecuteCommand.mockClear()
		jest.spyOn(console, "error").mockImplementation(() => {})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant"

		it("should handle successful relay", async () => {
			mockClipboardWrite.mockResolvedValue(undefined)
			mockExecuteCommand.mockImplementation((command, ...args) => {
				if (command === "roo-cline.registerHumanRelayCallback") {
					const callback = args[1]
					setTimeout(() => callback("AI response"), 0)
				}
			})

			const stream = handler.createMessage(systemPrompt, [{ role: "user" as const, content: "Hello" }])
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			expect(results).toEqual([{ type: "text", text: "AI response" }])
			expect(mockClipboardWrite).toHaveBeenCalled()
		})

		it("should handle empty message list", async () => {
			const stream = handler.createMessage(systemPrompt, [])
			await expect(async () => {
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow(/"status":400.*"message":"No message to relay"/)
		})

		it("should handle clipboard access error", async () => {
			mockClipboardWrite.mockRejectedValue(new Error("Clipboard access denied"))

			const stream = handler.createMessage(systemPrompt, [{ role: "user" as const, content: "Hello" }])
			await expect(async () => {
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow(/"status":500.*"message":"Clipboard access error"/)
		})

		it("should handle user cancellation", async () => {
			mockClipboardWrite.mockResolvedValue(undefined)
			mockExecuteCommand.mockImplementation((command, ...args) => {
				if (command === "roo-cline.registerHumanRelayCallback") {
					const callback = args[1]
					setTimeout(() => callback(undefined), 0)
				}
			})

			const stream = handler.createMessage(systemPrompt, [{ role: "user" as const, content: "Hello" }])
			await expect(async () => {
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow(/"status":499.*"message":"Operation cancelled"/)
		})

		it("should handle empty response", async () => {
			mockClipboardWrite.mockResolvedValue(undefined)
			mockExecuteCommand.mockImplementation((command, ...args) => {
				if (command === "roo-cline.registerHumanRelayCallback") {
					const callback = args[1]
					setTimeout(() => callback("   "), 0)
				}
			})

			const stream = handler.createMessage(systemPrompt, [{ role: "user" as const, content: "Hello" }])
			await expect(async () => {
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow(/"status":400.*"message":"Empty response"/)
		})
	})

	describe("completePrompt", () => {
		it("should handle successful prompt completion", async () => {
			mockClipboardWrite.mockResolvedValue(undefined)
			mockExecuteCommand.mockImplementation((command, ...args) => {
				if (command === "roo-cline.registerHumanRelayCallback") {
					const callback = args[1]
					setTimeout(() => callback("AI response"), 0)
				}
			})

			const response = await handler.completePrompt("Hello")
			expect(response).toBe("AI response")
			expect(mockClipboardWrite).toHaveBeenCalledWith("Hello")
		})

		it("should handle clipboard error in completePrompt", async () => {
			mockClipboardWrite.mockRejectedValue(new Error("Clipboard error"))

			await expect(handler.completePrompt("Hello")).rejects.toThrow(
				/"status":500.*"message":"Clipboard access error"/,
			)
		})

		it("should handle cancellation in completePrompt", async () => {
			mockClipboardWrite.mockResolvedValue(undefined)
			mockExecuteCommand.mockImplementation((command, ...args) => {
				if (command === "roo-cline.registerHumanRelayCallback") {
					const callback = args[1]
					setTimeout(() => callback(undefined), 0)
				}
			})

			await expect(handler.completePrompt("Hello")).rejects.toThrow(
				/"status":499.*"message":"Operation cancelled"/,
			)
		})

		it("should handle empty response in completePrompt", async () => {
			mockClipboardWrite.mockResolvedValue(undefined)
			mockExecuteCommand.mockImplementation((command, ...args) => {
				if (command === "roo-cline.registerHumanRelayCallback") {
					const callback = args[1]
					setTimeout(() => callback("  "), 0)
				}
			})

			await expect(handler.completePrompt("Hello")).rejects.toThrow(/"status":400.*"message":"Empty response"/)
		})
	})

	describe("getModel", () => {
		it("should return correct model information", () => {
			const model = handler.getModel()
			expect(model.id).toBe("human-relay")
			expect(model.info).toEqual({
				maxTokens: 16384,
				contextWindow: 100000,
				supportsImages: true,
				supportsPromptCache: false,
				supportsComputerUse: true,
				inputPrice: 0,
				outputPrice: 0,
				description: expect.any(String),
			})
		})
	})
})
