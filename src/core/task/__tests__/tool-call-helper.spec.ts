// @vitest-environment node

/**
 * @fileoverview
 * StreamingToolCallProcessor & handleOpenaiToolCallStreaming 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest"
import { StreamingToolCallProcessor, handleOpenaiToolCallStreaming } from "../tool-call-helper"

describe("StreamingToolCallProcessor", () => {
	let processor: StreamingToolCallProcessor

	beforeEach(() => {
		processor = new StreamingToolCallProcessor()
	})

	it("should process a simple function call with string arguments", () => {
		const chunk = [{ index: 0, id: "1", function: { name: "echo", arguments: '{"msg":"hello"}' } }]
		const xml = processor.processChunk(chunk)
		expect(xml).toContain("<echo>")
		expect(xml).toContain("<msg>hello</msg>")
	})

	it("should handle incremental argument streaming", () => {
		const chunk1 = [{ index: 0, id: "1", function: { name: "sum", arguments: '{"a":' } }]
		const chunk2 = [{ index: 0, id: "1", function: { name: "", arguments: '1,"b":2}' } }]
		let xml = processor.processChunk(chunk1)
		expect(xml).toContain("<sum>")
		expect(xml).not.toContain("<a>1</a>")
		xml += processor.processChunk(chunk2)
		expect(xml).toContain("<a>1</a>")
		expect(xml).toContain("<b>2</b>")
		expect(xml).toContain("</sum>")
	})

	it("should finalize incomplete tool calls", () => {
		const chunk = [{ index: 0, id: "1", function: { name: "test", arguments: '{"foo":"bar"' } }]
		let finalXml = processor.processChunk(chunk)
		finalXml += processor.finalize()
		expect(finalXml).toContain("<foo>bar</foo>")
		expect(finalXml).toContain("</test>")
	})

	it("should reset state", () => {
		const chunk = [{ index: 0, id: "1", function: { name: "resetTest", arguments: '{"x":1}' } }]
		processor.processChunk(chunk)
		processor.reset()
		const xml = processor.processChunk(chunk)
		expect(xml).toContain("<resetTest>")
		expect(xml).toContain("<x>1</x>")
	})

	it("should handle multiple tool calls (multi-index)", () => {
		const chunk = [
			{ index: 0, id: "1", function: { name: "f1", arguments: '{"a":1}' } },
			{ index: 1, id: "2", function: { name: "f2", arguments: '{"b":2}' } },
		]
		const xml = processor.processChunk(chunk)
		expect(xml).toContain("<f1>")
		expect(xml).toContain("<a>1</a>")
		expect(xml).toContain("<f2>")
		expect(xml).toContain("<b>2</b>")
	})

	it("should handle array and nested objects", () => {
		const chunk = [{ index: 0, id: "1", function: { name: "complex", arguments: '{"arr":[1,2],"obj":{"k":"v"}}' } }]
		const xml = processor.processChunk(chunk)
		expect(xml).toContain("<arr>")
		expect(xml).toContain("<obj>")
		expect(xml).toContain("<k>v</k>")
	})
	it("should handle deeply nested and mixed arrays/objects", () => {
		const chunk = [
			{
				index: 0,
				id: "1",
				function: {
					name: "deep",
					arguments: '{"level1":{"level2":{"arr":[{"x":1},{"y":[2,3,{"z":"end"}]}],"val":42},"emptyArr":[]}}',
				},
			},
		]
		const xml = processor.processChunk(chunk)
		expect(xml).toContain("<level1>")
		expect(xml).toContain("<level2>")
		expect(xml).toContain("<arr>")
		expect(xml).toContain("<x>1</x>")
		expect(xml).toContain("<y>")
		expect(xml).toContain("<z>end</z>")
		expect(xml).toContain("<val>42</val>")
		expect(xml).toContain("<emptyArr>")
	})

	it("should handle incomplete deeply nested JSON streamed in multiple chunks", () => {
		const chunk1 = [
			{
				index: 0,
				id: "1",
				function: {
					name: "streamDeep",
					arguments: '{"foo":{"bar":[{"baz":1},',
				},
			},
		]
		const chunk2 = [
			{
				index: 0,
				id: "1",
				function: {
					name: "",
					arguments: '{"baz":2},{"baz":3}]}, "tail":',
				},
			},
		]
		const chunk3 = [
			{
				index: 0,
				id: "1",
				function: {
					name: "",
					arguments: '"done"',
				},
			},
		]
		let xml = processor.processChunk(chunk1)
		expect(xml).toContain("<streamDeep>")
		expect(xml).toContain("<foo>")
		expect(xml).toContain("<bar>")
		expect(xml).toContain("<baz>1</baz>")
		expect(xml).not.toContain("<baz>2</baz>")
		xml += processor.processChunk(chunk2)
		expect(xml).toContain("<baz>2</baz>")
		expect(xml).toContain("<baz>3</baz>")
		xml += processor.processChunk(chunk3)
		expect(xml).toContain("<tail>done</tail>")
		expect(xml).not.toContain("</streamDeep>")
		xml += processor.finalize()
		expect(xml).toContain("</streamDeep>")
	})

	it("should handle invalid JSON gracefully", () => {
		const chunk = [{ index: 0, id: "1", function: { name: "bad", arguments: '{"a":' } }]
		expect(() => processor.processChunk(chunk)).not.toThrow()
		expect(() => processor.finalize()).not.toThrow()
	})

	it("should process read_file complete arguments", () => {
		const chunk = [
			{
				index: 0,
				id: "1",
				function: {
					name: "read_file",
					arguments: '{"args":{"file":[{"path":"abc/a/b/a.js"},{"path":"abc/c.js"}]}}',
				},
			},
		]
		const xml = processor.processChunk(chunk)
		expect(xml.trim()).toBe(`<read_file>
<args>
	<file>
		<path>abc/a/b/a.js</path>
	</file>
	<file>
		<path>abc/c.js</path>
	</file>
</args>
</read_file>`)
	})

	it("should handle read_file tool calls", () => {
		let xml = ""
		xml += processor.processChunk([
			{
				index: 0,
				id: "call_0_e4d7cf16-74e9-423a-bde5-47bb309978d5",
				type: "function",
				function: { name: "read_file", arguments: "" },
			},
		])
		xml += processor.processChunk([{ index: 0, function: { arguments: '{"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "args" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '":{"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "file" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '":[' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '{"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "path" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '":"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "abc" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "/a" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "/b" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "/a" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ".js" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '"},' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '{"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "path" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '":"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "abc" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "/c" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ".js" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "}]" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "}}" } }])
		expect(xml.trim()).toBe(`<read_file>
<args>
	<file>
		<path>abc/a/b/a.js</path>
	</file>
	<file>
		<path>abc/c.js</path>
	</file>
</args>
</read_file>`)
	})

	it("should handle write_to_file tool calls", () => {
		let xml = ""
		xml += processor.processChunk([
			{
				index: 0,
				id: "call_0_37f0c076-2c5f-4af0-b16b-cf6c0d7479f3",
				type: "function",
				function: { name: "write_to_file", arguments: "" },
			},
		])

		xml += processor.processChunk([{ index: 0, function: { arguments: '{"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "path" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '":"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "abc" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "/a" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "/b" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "/a" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ".js" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '","' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "content" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '":"' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "//" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " Function" } }])
		expect(xml).toContain(" Function")
		xml += processor.processChunk([{ index: 0, function: { arguments: " to" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " add" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " two" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " numbers" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "\\n" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "function" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " add" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "Numbers" } }])
		expect(xml).toContain(" addNumbers")
		xml += processor.processChunk([{ index: 0, function: { arguments: "(a" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "," } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " b" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ")" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " {\\" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "n" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "   " } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " return" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " a" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " +" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " b" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ";\\" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "n" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "}\\" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "n" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "\\n" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "//" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " Example" } }])
		expect(xml).toContain(" Example")
		xml += processor.processChunk([{ index: 0, function: { arguments: " usage" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "\\n" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "const" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " result" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " =" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " add" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "Numbers" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "(" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "5" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "," } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " " } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "7" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ");" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "\\" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "n" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "console" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ".log" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "(result" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ");" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " //" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " Output" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: ":" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: " " } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "12" } }])
		expect(xml.endsWith("Output: 12")).toBe(true)
		xml += processor.processChunk([{ index: 0, function: { arguments: '","' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "line" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "_count" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: '":' } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "6" } }])
		xml += processor.processChunk([{ index: 0, function: { arguments: "}" } }])
		expect(xml.trim().endsWith("</write_to_file>")).toBe(true)
	})
})

describe("handleOpenaiToolCallStreaming", () => {
	it("should delegate to processor.processChunk", () => {
		const processor = new StreamingToolCallProcessor()
		const chunk = [{ index: 0, id: "1", function: { name: "echo", arguments: '{"msg":"hi"}' } }]
		const xml = handleOpenaiToolCallStreaming(processor, chunk, "openai").chunkContent
		expect(xml).toContain("<echo>")
		expect(xml).toContain("<msg>hi</msg>")
	})

	it("should delegate to processor.processChunk apply_diff", () => {
		const processor = new StreamingToolCallProcessor()
		const chunk = [
			{
				index: 0,
				id: "1",
				function: {
					name: "apply_diff",
					arguments:
						'{"args":{"file":[{"diff":[{"replace":"catch (Exception e) {if (true) {}throw e;}","search":"catch (Exception e) {throw e;}","start_line":252}],"path":"Test.java"}]}}',
				},
			},
		]
		const xml = handleOpenaiToolCallStreaming(processor, chunk, "openai").chunkContent
		expect(xml).toContain("<search>")
	})

	it("should delegate to processor.processChunk apply_diff2", () => {
		const processor = new StreamingToolCallProcessor()
		const chunk1 = [
			{
				index: 0,
				id: "1",
				function: {
					name: "apply_diff",
					arguments:
						'{"args":{"file":[{"diff":[{"replace":"catch (Exception e) {if (1==1) {}throw e;}","test":tr',
				},
			},
		]
		const chunk2 = [
			{
				index: 0,
				id: "",
				function: {
					name: "",
					arguments: 'ue,"search":"catch (Exception e) {throw e;}","start_line":25',
				},
			},
		]
		const chunk3 = [
			{
				index: 0,
				id: "",
				function: {
					name: "",
					arguments: '2}],"path":"Test.java"}]}}',
				},
			},
		]
		let xml = handleOpenaiToolCallStreaming(processor, chunk1, "openai").chunkContent
		expect(xml).not.toContain("<search>")
		expect(xml).not.toContain("true")
		xml += handleOpenaiToolCallStreaming(processor, chunk2, "openai").chunkContent
		expect(xml).toContain("<search>")
		expect(xml).toContain("true")
		xml += handleOpenaiToolCallStreaming(processor, chunk3, "openai").chunkContent
		expect(xml).toContain("252")
	})
})
