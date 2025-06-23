import { suite, test, expect } from "vitest"
import { CodeBlockStateMachine } from "../CodeBlockStateMachine"
import { ParseContext, CodeBlockState } from "../ParseContext"

suite("CodeBlockStateMachine", () => {
	function createContext(): ParseContext {
		return {
			currentText: "",
			contentBlocks: [],
			hasXmlTags: false,
			hasIncompleteXml: false,
			codeBlockState: CodeBlockState.OUTSIDE,
			pendingBackticks: "",
			codeBlockContent: "",
			codeBlockStartIndex: -1,
		}
	}

	test("should detect complete code block boundary", () => {
		const stateMachine = new CodeBlockStateMachine()
		const context = createContext()
		const input = "```\ncode content\n```"

		const result = stateMachine.processText(input, context)

		expect(context.codeBlockState).toBe(CodeBlockState.OUTSIDE)
		expect(result.processedText).toBe("```\ncode content\n```")
	})

	test("should handle false positive backticks", () => {
		const stateMachine = new CodeBlockStateMachine()
		const context = createContext()

		// Single backtick should not trigger code block
		const result1 = stateMachine.processText("text `single` more", context)
		expect(context.codeBlockState).toBe(CodeBlockState.OUTSIDE)

		// Two backticks should not trigger code block
		const result2 = stateMachine.processText("text ``double`` more", context)
		expect(context.codeBlockState).toBe(CodeBlockState.OUTSIDE)
	})

	test("should toggle state correctly for code blocks", () => {
		const stateMachine = new CodeBlockStateMachine()
		const context = createContext()

		// Start outside
		expect(context.codeBlockState).toBe(CodeBlockState.OUTSIDE)

		// Process opening ```
		const result1 = stateMachine.processText("```", context)
		expect(context.codeBlockState).toBe(CodeBlockState.INSIDE)
		expect(result1.suppressXmlParsing).toBe(true)

		// Process content inside
		const result2 = stateMachine.processText("content", context)
		expect(context.codeBlockState).toBe(CodeBlockState.INSIDE)
		expect(result2.suppressXmlParsing).toBe(true)

		// Process closing ```
		const result3 = stateMachine.processText("```", context)
		expect(context.codeBlockState).toBe(CodeBlockState.OUTSIDE)
		expect(result3.suppressXmlParsing).toBe(false)
	})
})
