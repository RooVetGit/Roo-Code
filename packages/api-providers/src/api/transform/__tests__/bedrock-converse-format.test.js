// npx jest src/api/transform/__tests__/bedrock-converse-format.test.ts
import { convertToBedrockConverseMessages } from "../bedrock-converse-format"
describe("convertToBedrockConverseMessages", () => {
	test("converts simple text messages correctly", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there" },
		]
		const result = convertToBedrockConverseMessages(messages)
		expect(result).toEqual([
			{
				role: "user",
				content: [{ text: "Hello" }],
			},
			{
				role: "assistant",
				content: [{ text: "Hi there" }],
			},
		])
	})
	test("converts messages with images correctly", () => {
		const messages = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Look at this image:",
					},
					{
						type: "image",
						source: {
							type: "base64",
							data: "SGVsbG8=", // "Hello" in base64
							media_type: "image/jpeg",
						},
					},
				],
			},
		]
		const result = convertToBedrockConverseMessages(messages)
		if (!result[0] || !result[0].content) {
			fail("Expected result to have content")
			return
		}
		expect(result[0].role).toBe("user")
		expect(result[0].content).toHaveLength(2)
		expect(result[0].content[0]).toEqual({ text: "Look at this image:" })
		const imageBlock = result[0].content[1]
		if ("image" in imageBlock && imageBlock.image && imageBlock.image.source) {
			expect(imageBlock.image.format).toBe("jpeg")
			expect(imageBlock.image.source).toBeDefined()
			expect(imageBlock.image.source.bytes).toBeDefined()
		} else {
			fail("Expected image block not found")
		}
	})
	test("converts tool use messages correctly", () => {
		const messages = [
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "test-id",
						name: "read_file",
						input: {
							path: "test.txt",
						},
					},
				],
			},
		]
		const result = convertToBedrockConverseMessages(messages)
		if (!result[0] || !result[0].content) {
			fail("Expected result to have content")
			return
		}
		expect(result[0].role).toBe("assistant")
		const toolBlock = result[0].content[0]
		if ("toolUse" in toolBlock && toolBlock.toolUse) {
			expect(toolBlock.toolUse).toEqual({
				toolUseId: "test-id",
				name: "read_file",
				input: "<read_file>\n<path>\ntest.txt\n</path>\n</read_file>",
			})
		} else {
			fail("Expected tool use block not found")
		}
	})
	test("converts tool result messages correctly", () => {
		const messages = [
			{
				role: "assistant",
				content: [
					{
						type: "tool_result",
						tool_use_id: "test-id",
						content: [{ type: "text", text: "File contents here" }],
					},
				],
			},
		]
		const result = convertToBedrockConverseMessages(messages)
		if (!result[0] || !result[0].content) {
			fail("Expected result to have content")
			return
		}
		expect(result[0].role).toBe("assistant")
		const resultBlock = result[0].content[0]
		if ("toolResult" in resultBlock && resultBlock.toolResult) {
			const expectedContent = [{ text: "File contents here" }]
			expect(resultBlock.toolResult).toEqual({
				toolUseId: "test-id",
				content: expectedContent,
				status: "success",
			})
		} else {
			fail("Expected tool result block not found")
		}
	})
	test("handles text content correctly", () => {
		const messages = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Hello world",
					},
				],
			},
		]
		const result = convertToBedrockConverseMessages(messages)
		if (!result[0] || !result[0].content) {
			fail("Expected result to have content")
			return
		}
		expect(result[0].role).toBe("user")
		expect(result[0].content).toHaveLength(1)
		const textBlock = result[0].content[0]
		expect(textBlock).toEqual({ text: "Hello world" })
	})
})
//# sourceMappingURL=bedrock-converse-format.test.js.map
