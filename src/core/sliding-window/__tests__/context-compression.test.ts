import { describe, it } from "mocha"
import "should"
import cloneDeep from "clone-deep"
import { Anthropic } from "@anthropic-ai/sdk"
import { compressConversationHistory, compressEnvironmentDetails } from "../core/sliding-window/context-compression"

// Helper function to get the last message with environment details
function getLastEnvironmentMessage(messages: Anthropic.Messages.MessageParam[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]
		if (Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "text" && block.text.includes("<environment_details>")) {
					return block.text
				}
			}
		}
	}
	return ""
}

// Helper function to get all non-last environment messages
function getPriorEnvironmentMessages(messages: Anthropic.Messages.MessageParam[]): string[] {
	const result: string[] = []
	let lastEnvIndex = -1

	// Find last environment message first
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]
		if (Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "text" && block.text.includes("<environment_details>")) {
					lastEnvIndex = i
					break
				}
			}
		}
		if (lastEnvIndex !== -1) {
			break
		}
	}

	// Collect all prior environment messages
	for (let i = 0; i < lastEnvIndex; i++) {
		const msg = messages[i]
		if (Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "text" && block.text.includes("<environment_details>")) {
					result.push(block.text)
				}
			}
		}
	}

	return result
}

// Helper function to verify environment details compression
function verifyEnvironmentCompression(
	beforeObj: Anthropic.Messages.MessageParam[],
	afterObj: Anthropic.Messages.MessageParam[],
): void {
	// Get last and prior messages after compression
	const lastMsg = getLastEnvironmentMessage(afterObj)
	const priorMsgs = getPriorEnvironmentMessages(afterObj)

	// Verify prior messages only have UTC UNIX timestamp
	for (const msg of priorMsgs) {
		should(msg).match(/UTC UNIX: \d+/)
		should(msg).not.match(/VSCode Visible Files/)
		should(msg).not.match(/VSCode Open Tabs/)
		should(msg).not.match(/Current Working Directory/)
	}

	// Verify last message has full details
	should(lastMsg).match(/\d+\/\d+\/\d+,\s*(?:\d+:\d+:\d+(?:\s*[AP]M)?|\d+:\d+:\d+)/)

	// Verify original structure is preserved in before object
	const lastBeforeMsg = getLastEnvironmentMessage(beforeObj)
	const priorBeforeMsgs = getPriorEnvironmentMessages(beforeObj)

	// Original messages should have their full content
	for (const msg of priorBeforeMsgs) {
		should(msg).match(/\d+\/\d+\/\d+,\s*(?:\d+:\d+:\d+(?:\s*[AP]M)?|\d+:\d+:\d+)/)
	}
	should(lastBeforeMsg).match(/\d+\/\d+\/\d+,\s*(?:\d+:\d+:\d+(?:\s*[AP]M)?|\d+:\d+:\d+)/)
}

describe("Context Compression", () => {
	describe("Conversation History Compression", () => {
		it("should compress conversation history correctly", () => {
			// Create test messages with environment details
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 1\n<environment_details>\n# VSCode Visible Files\nfile1.ts\n\n# Current Time\n2/14/2025, 6:33:59 PM (America/Los_Angeles, UTC-8:00)\n\n# Current Mode\nACT MODE\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "I'll help with that.",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 2\n<environment_details>\n# VSCode Visible Files\nfile2.ts\n\n# Current Time\n2/14/2025, 6:34:00 PM (America/Los_Angeles, UTC-8:00)\n\n# Current Mode\nPLAN MODE\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
			]

			// Make a deep copy for comparison
			const originalMessages = cloneDeep(messages)

			// Compress and get serialized structures with debug files
			const { before, after } = compressConversationHistory(
				messages,
				"test_task",
				`conversation_before_compression_${Date.now()}_basic_compression.json`,
				`conversation_after_compression_${Date.now()}_basic_compression.json`,
			)

			// Parse the structures
			const beforeObj = JSON.parse(before)
			const afterObj = JSON.parse(after)

			// Verify compression using helper functions
			verifyEnvironmentCompression(beforeObj, afterObj)

			// Additional verification specific to this test
			const lastMsg = getLastEnvironmentMessage(afterObj)
			should(lastMsg).match(/VSCode Visible Files\s*file2\.ts/)
			should(lastMsg).match(/Current Mode\s*PLAN MODE/)
		})

		it("should accumulate sections in last message", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 1\n<environment_details>\n# Current Time\n2/14/2025, 6:33:59 PM (America/Los_Angeles, UTC-8:00)\n\n# VSCode Visible Files\nfile1.ts\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 2\n<environment_details>\n# Current Time\n2/14/2025, 6:34:00 PM (America/Los_Angeles, UTC-8:00)\n\n# VSCode Open Tabs\ntab1.ts\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 3\n<environment_details>\n# Current Time\n2/14/2025, 6:34:01 PM (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
			]

			// Make a deep copy for comparison
			const originalMessages = cloneDeep(messages)

			// Compress and get serialized structures with debug files
			const { before, after } = compressConversationHistory(
				messages,
				"test_task",
				`conversation_before_compression_${Date.now()}_section_accumulation.json`,
				`conversation_after_compression_${Date.now()}_section_accumulation.json`,
			)

			// Parse the structures
			const beforeObj = JSON.parse(before)
			const afterObj = JSON.parse(after)

			// Verify compression using helper functions
			verifyEnvironmentCompression(beforeObj, afterObj)

			// Additional verification specific to this test
			const lastMsg = getLastEnvironmentMessage(afterObj)
			should(lastMsg).match(/VSCode Visible Files\s*file1\.ts/)
			should(lastMsg).match(/VSCode Open Tabs\s*tab1\.ts/)
		})

		it("should handle 12-hour and 24-hour time formats", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 1\n<environment_details>\n# Current Time\n2/14/2025, 6:33:59 PM (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 2\n<environment_details>\n# Current Time\n2/14/2025, 18:34:00 (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
			]

			// Make a deep copy for comparison
			const originalMessages = cloneDeep(messages)

			// Compress and get serialized structures with debug files
			const { before, after } = compressConversationHistory(
				messages,
				"test_task",
				`conversation_before_compression_${Date.now()}_time_formats.json`,
				`conversation_after_compression_${Date.now()}_time_formats.json`,
			)

			// Parse the structures
			const beforeObj = JSON.parse(before)
			const afterObj = JSON.parse(after)

			// Verify compression using helper functions
			verifyEnvironmentCompression(beforeObj, afterObj)

			// Additional verification specific to this test
			const lastMsg = getLastEnvironmentMessage(afterObj)
			should(lastMsg).match(/2\/14\/2025,\s*18:34:00/)
		})

		it("should handle working directory content", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 1\n<environment_details>\n# Current Time\n2/14/2025, 6:33:59 PM (America/Los_Angeles, UTC-8:00)\n\n# Current Working Directory (/path/to/dir) Files\nfile1.txt\ndir1/\n  subfile1.txt\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 2\n<environment_details>\n# Current Time\n2/14/2025, 6:34:00 PM (America/Los_Angeles, UTC-8:00)\n\n# Current Working Directory (/path/to/dir) Files\nfile1.txt\ndir1/\n  subfile1.txt\n  subfile2.txt\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
			]

			// Make a deep copy for comparison
			const originalMessages = cloneDeep(messages)

			// Compress and get serialized structures with debug files
			const { before, after } = compressConversationHistory(
				messages,
				"test_task",
				`conversation_before_compression_${Date.now()}_working_directory.json`,
				`conversation_after_compression_${Date.now()}_working_directory.json`,
			)

			// Parse the structures
			const beforeObj = JSON.parse(before)
			const afterObj = JSON.parse(after)

			// Verify compression using helper functions
			verifyEnvironmentCompression(beforeObj, afterObj)

			// Additional verification specific to this test
			const lastMsg = getLastEnvironmentMessage(afterObj)
			should(lastMsg).match(/Current Working Directory/)
			should(lastMsg).match(/file1\.txt/)
			should(lastMsg).match(/dir1\/\s*subfile1\.txt\s*subfile2\.txt/)
		})

		it("should handle empty VSCode sections", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 1\n<environment_details>\n# Current Time\n2/14/2025, 6:33:59 PM (America/Los_Angeles, UTC-8:00)\n\n# VSCode Visible Files\n(No visible files)\n\n# VSCode Open Tabs\n(No open tabs)\n\n# Current Mode\nACT MODE\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "message 2\n<environment_details>\n# Current Time\n2/14/2025, 6:34:00 PM (America/Los_Angeles, UTC-8:00)\n\n# VSCode Visible Files\n(No visible files)\n\n# VSCode Open Tabs\n(No open tabs)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
			]

			// Make a deep copy for comparison
			const originalMessages = cloneDeep(messages)

			// Compress and get serialized structures with debug files
			const { before, after } = compressConversationHistory(
				messages,
				"test_task",
				`conversation_before_compression_${Date.now()}_empty_vscode.json`,
				`conversation_after_compression_${Date.now()}_empty_vscode.json`,
			)

			// Parse the structures
			const beforeObj = JSON.parse(before)
			const afterObj = JSON.parse(after)

			// Verify compression using helper functions
			verifyEnvironmentCompression(beforeObj, afterObj)

			// Additional verification specific to this test
			const lastMsg = getLastEnvironmentMessage(afterObj)
			should(lastMsg).match(/VSCode Visible Files\s*\(No visible files\)/)
			should(lastMsg).match(/VSCode Open Tabs\s*\(No open tabs\)/)
		})

		it("should remove all but the last task resumption message when last message is task resumption", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "[TASK RESUMPTION] This task was interrupted 5 minutes ago.\nmessage 1\n<environment_details>\n# Current Time\n2/14/2025, 6:33:59 PM (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "[TASK RESUMPTION] This task was interrupted 10 minutes ago.\nmessage 2\n<environment_details>\n# Current Time\n2/14/2025, 6:34:00 PM (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "[TASK RESUMPTION] This task was interrupted 15 minutes ago.\nmessage 3\n<environment_details>\n# Current Time\n2/14/2025, 6:34:01 PM (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
			]

			// Make a deep copy for comparison
			const originalMessages = cloneDeep(messages)

			// Compress and get serialized structures with debug files
			const { before, after } = compressConversationHistory(
				messages,
				"test_task",
				`conversation_before_compression_${Date.now()}_task_resumption.json`,
				`conversation_after_compression_${Date.now()}_task_resumption.json`,
			)

			// Parse the structures
			const beforeObj = JSON.parse(before)
			const afterObj = JSON.parse(after)

			// Count task resumption messages in before object
			let beforeCount = 0
			for (const msg of beforeObj) {
				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === "text" && block.text.includes("[TASK RESUMPTION]")) {
							beforeCount++
						}
					}
				}
			}

			// Count task resumption messages in after object
			let afterCount = 0
			let lastResumptionMsg = ""
			for (const msg of afterObj) {
				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === "text" && block.text.includes("[TASK RESUMPTION]")) {
							afterCount++
							lastResumptionMsg = block.text
						}
					}
				}
			}

			// Verify compression
			should(beforeCount).equal(3)
			should(afterCount).equal(1)
			should(lastResumptionMsg).match(/\[TASK RESUMPTION\] This task was interrupted 15 minutes ago/)
		})

		it("should preserve last task resumption message when last message is not task resumption", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "[TASK RESUMPTION] This task was interrupted 5 minutes ago.\nmessage 1\n<environment_details>\n# Current Time\n2/14/2025, 6:33:59 PM (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "[TASK RESUMPTION] This task was interrupted 10 minutes ago.\nmessage 2\n<environment_details>\n# Current Time\n2/14/2025, 6:34:00 PM (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "regular message\n<environment_details>\n# Current Time\n2/14/2025, 6:34:01 PM (America/Los_Angeles, UTC-8:00)\n</environment_details>",
						} as Anthropic.Messages.TextBlockParam,
					],
				},
			]

			// Make a deep copy for comparison
			const originalMessages = cloneDeep(messages)

			// Compress and get serialized structures with debug files
			const { before, after } = compressConversationHistory(
				messages,
				"test_task",
				`conversation_before_compression_${Date.now()}_task_resumption_non_last.json`,
				`conversation_after_compression_${Date.now()}_task_resumption_non_last.json`,
			)

			// Parse the structures
			const beforeObj = JSON.parse(before)
			const afterObj = JSON.parse(after)

			// Count task resumption messages in before object
			let beforeCount = 0
			for (const msg of beforeObj) {
				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === "text" && block.text.includes("[TASK RESUMPTION]")) {
							beforeCount++
						}
					}
				}
			}

			// Count task resumption messages in after object and find last message
			let afterCount = 0
			let lastResumptionMsg = ""
			let lastMsg = ""
			for (const msg of afterObj) {
				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === "text") {
							lastMsg = block.text
							if (block.text.includes("[TASK RESUMPTION]")) {
								afterCount++
								lastResumptionMsg = block.text
							}
						}
					}
				}
			}

			// Verify compression
			should(beforeCount).equal(2)
			should(afterCount).equal(1)
			should(lastResumptionMsg).match(/\[TASK RESUMPTION\] This task was interrupted 10 minutes ago/)
			should(lastMsg).match(/regular message/)
		})
	})
})
