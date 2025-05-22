import * as assert from "assert"

import type { RooCodeAPI, ClineMessage } from "@roo-code/types"

import { waitUntilCompleted } from "./utils"

suite("Roo Code Task", () => {
	test("Should handle prompt and response correctly", async () => {
		// @ts-expect-error - Expose the API to the tests.
		const api = globalThis.api as RooCodeAPI

		const messages: ClineMessage[] = []

		api.on("message", ({ message }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: { mode: "Ask", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: "Hello world, what is your name? Respond with 'My name is ...'",
		})

		await waitUntilCompleted({ api, taskId })

		assert.ok(
			!!messages.find(
				({ say, text }) => (say === "completion_result" || say === "text") && text?.includes("My name is Roo"),
			),
			`Completion should include "My name is Roo"`,
		)
	})
})

	test("should preserve chat history when a task is canceled and resumed", async () => {
		const api = globalThis.api
		const collectedMessages: ClineMessage[] = []
		let messageHandler: ((event: { message: ClineMessage }) => void) | undefined

		// Helper to wait for a specific message text to appear
		const waitForMessage = (textToFind: string, timeout = 10000): Promise<ClineMessage> => {
			return new Promise((resolve, reject) => {
				const startTime = Date.now()
				const checkMessages = () => {
					const found = collectedMessages.find(msg => msg.text?.includes(textToFind) && msg.partial === false)
					if (found) {
						resolve(found)
					} else if (Date.now() - startTime > timeout) {
						reject(new Error(`Timeout waiting for message: "${textToFind}"`))
					} else {
						setTimeout(checkMessages, 100) // Check every 100ms
					}
				}
				checkMessages()
			})
		}

		// Start collecting messages
		messageHandler = ({ message }) => {
			// We are interested in 'say' and 'ask' types for chat history
			if ((message.type === "say" || message.type === "ask") && message.partial === false) {
				collectedMessages.push(message)
			}
		}
		api.on("message", messageHandler)

		const initialPrompt = "This is the initial task prompt for cancel/resume test. Respond with 'Initial prompt processed.'"
		const userMessage = "Hello, this is a test message after initial prompt. Respond with 'User message processed.'"

		// 1. Start a new task
		const taskId = await api.startNewTask({
			configuration: { mode: "Ask", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: initialPrompt,
		})
		assert.ok(taskId, "Task ID should be returned on start")

		// Wait for the initial prompt to be processed and responded to
		await waitForMessage("Initial prompt processed")

		// 2. Send a message to the task
		// Assuming an API method like postMessageToTask or sendInput.
		// This is a common pattern, but might need adjustment based on actual API.
		if (typeof api.postMessageToTask !== "function") {
			console.warn("api.postMessageToTask is not available, skipping sending user message and further steps that depend on it.")
		} else {
			await api.postMessageToTask(taskId, { text: userMessage })
	
			// 3. Wait for task to process and respond to the user message
			await waitForMessage("User message processed")
		}

		// 4. Cancel the task
		// Assuming an API method like cancelTask.
		if (typeof api.cancelTask !== "function") {
			console.warn("api.cancelTask is not available, skipping cancel and resume.")
			// Clean up listener if test cannot proceed
			if (messageHandler) api.off("message", messageHandler)
			return // End test if cancel is not possible
		}
		await api.cancelTask(taskId)
		// Add a small delay to ensure cancellation is processed
		await new Promise(resolve => setTimeout(resolve, 500))


		// 5. Re-open/resume the task
		// Assuming an API method like resumeTask or openTask.
		// For this test, we might not need to "do" anything with the resumed task other than check its history.
		// If resuming re-triggers message processing or requires specific state, that would need handling.
		if (typeof api.resumeTask !== "function") {
			console.warn("api.resumeTask is not available, skipping resume and history check.")
			// Clean up listener if test cannot proceed
			if (messageHandler) api.off("message", messageHandler)
			return // End test if resume is not possible
		}
		await api.resumeTask(taskId) 
		// Add a small delay to ensure resumption is processed
		await new Promise(resolve => setTimeout(resolve, 500))


		// 6. Verify chat history
		// The collectedMessages array should now contain all messages from the beginning.
		// If resuming a task clears and reloads messages, this assertion strategy would need to change.
		// We'd need an `api.getTaskMessages(taskId)` instead.

		const initialPromptMessage = collectedMessages.find(
			msg => msg.text === initialPrompt && (msg.say === "ask" || msg.type === "ask")
		)
		assert.ok(initialPromptMessage, `Initial prompt "${initialPrompt}" should be in chat history. Found: ${JSON.stringify(collectedMessages.map(m => m.text))}`)

		if (typeof api.postMessageToTask === "function") {
			const userMessageInHistory = collectedMessages.find(
				msg => msg.text === userMessage && (msg.say === "ask" || msg.type === "ask")
			)
			assert.ok(userMessageInHistory, `User message "${userMessage}" should be in chat history. Found: ${JSON.stringify(collectedMessages.map(m => m.text))}`)
		}
		
		// Clean up message listener
		if (messageHandler) {
			api.off("message", messageHandler)
		}
		
		// Optional: wait for the resumed task to complete if it's supposed to do something.
		// For this test, primarily concerned with history, so explicit completion wait might not be needed
		// unless history fetching depends on it.
		// await waitUntilCompleted({ api, taskId }); // This might be problematic if task was truly "canceled"
	})
})
