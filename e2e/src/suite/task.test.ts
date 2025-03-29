import * as assert from "assert"

import { RooCodeEventName, ClineMessage } from "../../../src/exports/roo-code"

import { waitUntilCompleted } from "./utils"

suite("Roo Code Task", () => {
	test("Should handle prompt and response correctly", async () => {
		const api = globalThis.api

		const messages: ClineMessage[] = []
		api.on(RooCodeEventName.Message, ({ message }) => messages.push(message))

		const taskId = await api.startNewTask({
			configuration: { mode: "Ask", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: "Hello world, what is your name? Respond with 'My name is ...'",
		})

		await waitUntilCompleted({ api, taskId })

		const completion = messages.find(({ type, say, partial }) => say === "completion_result" && partial === false)

		assert.ok(
			completion?.text?.includes("My name is Roo"),
			`Completion should include "My name is Roo" - ${completion?.text}`,
		)
	})
})
