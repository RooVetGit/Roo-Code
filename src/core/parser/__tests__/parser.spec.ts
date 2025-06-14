import { describe, it, expect, beforeEach } from "vitest"
import { PartialXMLStreamParser, xmlObjectToString } from "../index"

describe("PartialXMLStreamParser", () => {
	let parser: PartialXMLStreamParser

	beforeEach(() => {
		// Default parser for most tests, now implies alwaysCreateTextNode: true
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
	})

	it("should parse a stream chunk by chunk correctly", () => {
		let streamResult

		streamResult = parser.parseStream("<read>")
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ read: {} }],
		})

		streamResult = parser.parseStream("<args>")
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ read: { args: {} } }],
		})

		streamResult = parser.parseStream("<file><name>as")
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ read: { args: { file: { name: { "#text": "as" } } } } }],
		})

		streamResult = parser.parseStream("d</name>")
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ read: { args: { file: { name: { "#text": "asd" } } } } }],
		})

		streamResult = parser.parseStream("</file></args>")
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ read: { args: { file: { name: { "#text": "asd" } } } } }],
		})

		streamResult = parser.parseStream("</read>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ read: { args: { file: { name: { "#text": "asd" } } } } }],
		})

		streamResult = parser.parseStream(null) // Signal end of stream
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ read: { args: { file: { name: { "#text": "asd" } } } } }],
		})
	})

	it("should handle a single incomplete chunk, then completion", () => {
		let streamResult
		const singleChunk = "<request><id>123</id><data>value<da"
		streamResult = parser.parseStream(singleChunk)
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ request: { id: { "#text": "123" }, data: { "#text": "value<da" } } }],
		})

		streamResult = parser.parseStream("ta></request>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				{
					request: {
						id: { "#text": "123" },
						data: { "#text": "value<data>" },
					},
				},
			],
		})

		streamResult = parser.parseStream(null) // Signal end
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				{
					request: {
						id: { "#text": "123" },
						data: { "#text": "value<data>" },
					},
				},
			],
		})
	})

	it("should handle a text-only stream", () => {
		let streamResult
		streamResult = parser.parseStream("Just some text")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: ["Just some text"],
		})

		streamResult = parser.parseStream(null) // End stream
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: ["Just some text"],
		})
	})

	it("should handle self-closing tags and mixed content", () => {
		let streamResult
		streamResult = parser.parseStream("<root><item/>Text after item<another/></root>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: {}, "#text": "Text after item", another: {} } }],
		})

		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: {}, "#text": "Text after item", another: {} } }],
		})
	})

	it("should handle XML entities in text nodes", () => {
		parser = new PartialXMLStreamParser({ textNodeName: "#text" }) // Re-init to be sure about options
		let streamResult = parser.parseStream("<doc>Hello & \"World\" 'Test'</doc>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { "#text": "Hello & \"World\" 'Test'" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { "#text": "Hello & \"World\" 'Test'" } }],
		})
	})

	it("should handle XML entities in attribute values", () => {
		parser = new PartialXMLStreamParser({
			textNodeName: "#text",
			attributeNamePrefix: "@",
		})
		let streamResult = parser.parseStream('<doc val="&lt;value&gt;" />')
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { "@val": "<value>" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { "@val": "<value>" } }],
		})
	})

	it("should handle numeric XML entities (decimal and hex)", () => {
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
		let streamResult = parser.parseStream("<doc>&#60;Hello&#x26;&#32;World&#x3E;</doc>") // <Hello& World>
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { "#text": "<Hello& World>" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { "#text": "<Hello& World>" } }],
		})
	})

	it("should correctly parse multiple chunks that form a complete XML", () => {
		parser = new PartialXMLStreamParser({
			textNodeName: "#text",
			attributeNamePrefix: "@",
		})
		parser.parseStream("<data><item")
		parser.parseStream(' key="value">Te')
		parser.parseStream("st</item><item2")
		let streamResult = parser.parseStream("/></data>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ data: { item: { "@key": "value", "#text": "Test" }, item2: {} } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ data: { item: { "@key": "value", "#text": "Test" }, item2: {} } }],
		})
	})

	it("should return empty array xml for empty stream", () => {
		parser = new PartialXMLStreamParser()
		let streamResult = parser.parseStream("")
		expect(streamResult).toEqual({ metadata: { partial: true }, xml: [] })
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({ metadata: { partial: false }, xml: [] })
	})

	it("should handle stream with only XML declaration and comments", () => {
		parser = new PartialXMLStreamParser()
		let streamResult = parser.parseStream('<?xml version="1.0"?><!-- comment -->')
		expect(streamResult).toEqual({ metadata: { partial: false }, xml: [] })
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({ metadata: { partial: false }, xml: [] })
	})

	it("should handle custom attributeNamePrefix", () => {
		parser = new PartialXMLStreamParser({ attributeNamePrefix: "_" })
		let streamResult = parser.parseStream('<doc attr="val" />')
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { _attr: "val" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { _attr: "val" } }],
		})

		parser = new PartialXMLStreamParser({ attributeNamePrefix: "" })
		streamResult = parser.parseStream('<doc attr="val" />')
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { attr: "val" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { attr: "val" } }],
		})
	})

	it("should parse CDATA sections correctly", () => {
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
		let streamResult = parser.parseStream("<root><![CDATA[This is <CDATA> text with & special chars]]></root>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { "#text": "This is <CDATA> text with & special chars" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { "#text": "This is <CDATA> text with & special chars" } }],
		})
	})

	it("should handle unterminated CDATA section", () => {
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
		let streamResult = parser.parseStream("<root><![CDATA[Unterminated cdata")
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ root: { "#text": "Unterminated cdata" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ root: { "#text": "Unterminated cdata" } }],
		})
	})

	it("should handle CDATA at root level if it is the only content", () => {
		parser = new PartialXMLStreamParser()
		let streamResult = parser.parseStream("<![CDATA[Root CDATA]]>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: ["Root CDATA"],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: ["Root CDATA"],
		})
	})

	it("should handle unterminated comments", () => {
		parser = new PartialXMLStreamParser()
		let streamResult = parser.parseStream("<root><!-- This is an unterminated comment")
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ root: {} }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ root: {} }],
		})
	})

	it("should handle unterminated DOCTYPE", () => {
		parser = new PartialXMLStreamParser()
		let streamResult = parser.parseStream('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"')
		expect(streamResult).toEqual({ metadata: { partial: true }, xml: [] })
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({ metadata: { partial: false }, xml: [] })
	})

	it("should handle unterminated XML declaration", () => {
		parser = new PartialXMLStreamParser()
		let streamResult = parser.parseStream('<?xml version="1.0" encoding="UTF-8"')
		expect(streamResult).toEqual({ metadata: { partial: true }, xml: [] })
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({ metadata: { partial: false }, xml: [] })
	})

	it("should leniently handle mismatched closing tags", () => {
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
		let streamResult = parser.parseStream("<root><item>text</mismatched></item></root>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: { "#text": "text</mismatched>" } } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: { "#text": "text</mismatched>" } } }],
		})
	})

	it("should handle attributes without explicit values (boolean attributes) as true", () => {
		parser = new PartialXMLStreamParser({ attributeNamePrefix: "@" })
		let streamResult = parser.parseStream('<input disabled checked="checked" required />')
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				{
					input: {
						"@disabled": true,
						"@checked": "checked",
						"@required": true,
					},
				},
			],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				{
					input: {
						"@disabled": true,
						"@checked": "checked",
						"@required": true,
					},
				},
			],
		})
	})

	it("should correctly simplify text-only elements", () => {
		// This test now reflects alwaysCreateTextNode: true behavior from beforeEach
		let streamResult = parser.parseStream("<parent><child>simple text</child></parent>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ parent: { child: { "#text": "simple text" } } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ parent: { child: { "#text": "simple text" } } }],
		})
	})

	it("should not simplify elements with attributes even if they also have text", () => {
		// This test already aligns with alwaysCreateTextNode: true behavior
		parser = new PartialXMLStreamParser({
			textNodeName: "#text",
			attributeNamePrefix: "@",
		})
		let streamResult = parser.parseStream('<parent><child attr="val">text content</child></parent>')
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ parent: { child: { "@attr": "val", "#text": "text content" } } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ parent: { child: { "@attr": "val", "#text": "text content" } } }],
		})
	})

	it("should not simplify elements with child elements", () => {
		// This test's expectation doesn't change with alwaysCreateTextNode
		parser = new PartialXMLStreamParser() // Uses new default alwaysCreateTextNode: true
		let streamResult = parser.parseStream("<parent><child><grandchild/></child></parent>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ parent: { child: { grandchild: {} } } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ parent: { child: { grandchild: {} } } }],
		})
	})

	it("should ignore text nodes containing only whitespace by default", () => {
		// Expectation changes due to alwaysCreateTextNode: true from beforeEach
		let streamResult = parser.parseStream("<root>  <item>text</item>   </root>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: { "#text": "text" } } }], // Whitespace around item is trimmed, text inside item gets #text
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: { "#text": "text" } } }],
		})
	})

	it("should omit whitespace text nodes even if alwaysCreateTextNode is true", () => {
		parser = new PartialXMLStreamParser({
			textNodeName: "#text",
			alwaysCreateTextNode: true,
		})
		let streamResult = parser.parseStream("<root>  <item>text</item>   </root>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: { "#text": "text" } } }], // Whitespace-only nodes between tags are omitted
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: { "#text": "text" } } }],
		})
	})

	it("should handle text at root level before any tags", () => {
		parser = new PartialXMLStreamParser() // Uses new default
		let streamResult = parser.parseStream("Leading text<root/>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: ["Leading text", { root: {} }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: ["Leading text", { root: {} }],
		})
	})

	it("should handle text at root level after all tags are closed", () => {
		parser = new PartialXMLStreamParser() // Uses new default
		let streamResult = parser.parseStream("<root/>Trailing text")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: {} }, "Trailing text"],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: {} }, "Trailing text"],
		})
	})

	it("should handle multiple root elements", () => {
		// Expectation changes due to alwaysCreateTextNode: true from beforeEach
		let streamResult = parser.parseStream("<rootA/><rootB>text</rootB>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ rootA: {} }, { rootB: { "#text": "text" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ rootA: {} }, { rootB: { "#text": "text" } }],
		})
	})

	it("should handle multiple root elements in specific order", () => {
		// Expectation changes due to alwaysCreateTextNode: true from beforeEach
		const xml = "<thinking>a</thinking><some-tool></some-tool>"
		let streamResult = parser.parseStream(xml)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ thinking: { "#text": "a" } }, { "some-tool": {} }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ thinking: { "#text": "a" } }, { "some-tool": {} }],
		})
	})

	it("should handle Buffer input", () => {
		// Expectation changes due to alwaysCreateTextNode: true from beforeEach
		let streamResult = parser.parseStream(Buffer.from("<data>value</data>"))
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ data: { "#text": "value" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ data: { "#text": "value" } }],
		})
	})

	it("should handle multiple attributes correctly", () => {
		parser = new PartialXMLStreamParser({ attributeNamePrefix: "@" })
		let streamResult = parser.parseStream("<tag attr1=\"val1\" attr2='val2' attr3=val3 />")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ tag: { "@attr1": "val1", "@attr2": "val2", "@attr3": "val3" } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ tag: { "@attr1": "val1", "@attr2": "val2", "@attr3": "val3" } }],
		})
	})

	it("should handle incomplete tags at end of chunk and then completed", () => {
		parser = new PartialXMLStreamParser({
			// Uses new default alwaysCreateTextNode: true
			textNodeName: "#text",
			attributeNamePrefix: "@",
		})
		parser.parseStream("<root><item")
		let streamResult = parser.parseStream(" attr='1'>Text</item></r")
		expect(streamResult!.xml![0].root.item).toEqual({
			"@attr": "1",
			"#text": "Text",
		})
		expect(streamResult!.xml![0].root["#text"]).toBe("</r") // This part becomes text
		expect(streamResult!.metadata.partial).toBe(true)

		parser = new PartialXMLStreamParser({
			textNodeName: "#text",
			attributeNamePrefix: "@",
		})
		parser.parseStream("<root><item")
		streamResult = parser.parseStream(" attr='1'>Text</item></root>")
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: { "@attr": "1", "#text": "Text" } } }],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ root: { item: { "@attr": "1", "#text": "Text" } } }],
		})
	})

	it("should handle empty string chunks in midst of stream", () => {
		// Expectation changes due to alwaysCreateTextNode: true from beforeEach
		parser.parseStream("<doc>")
		parser.parseStream("")
		let streamResult = parser.parseStream("<content>Hello</content>")
		expect(streamResult!.xml![0].doc.content).toEqual({ "#text": "Hello" })
		expect(streamResult!.metadata.partial).toBe(true)

		let finalDocStreamResult = parser.parseStream("</doc>")
		expect(finalDocStreamResult!.xml![0].doc.content).toEqual({
			"#text": "Hello",
		})
		expect(finalDocStreamResult!.metadata.partial).toBe(false)

		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [{ doc: { content: { "#text": "Hello" } } }],
		})
	})

	it("should set partial:true when stream ends with an incomplete tag", () => {
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
		let streamResult = parser.parseStream("<root><incompleteTag")
		streamResult = parser.parseStream(null) // End stream
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ root: { "#text": "<incompleteTag" } }], // The fragment is treated as text of parent
		})

		parser.reset()
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
		streamResult = parser.parseStream("<root><item>Text</item></incompleteCl")
		streamResult = parser.parseStream(null) // End stream
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ root: { item: { "#text": "Text" }, "#text": "</incompleteCl" } }], // Fragment as text
		})

		parser.reset()
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
		streamResult = parser.parseStream("<root><item>Text</item><") // Just '<'
		streamResult = parser.parseStream(null) // End stream
		expect(streamResult).toEqual({
			metadata: { partial: true },
			xml: [{ root: { item: { "#text": "Text" }, "#text": "<" } }], // Fragment as text
		})

		parser.reset()
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
		streamResult = parser.parseStream("<root attr='val")
		streamResult = parser.parseStream(null) // End stream
		expect(streamResult).toEqual({
			metadata: { partial: true },
			// Depending on how strictly attributes are parsed before '>',
			// this might be an empty root or root with partial text.
			// Current behavior treats "<root attr='val" as text if not closed by ">"
			xml: [{ "#text": "<root attr='val" }],
		})
	})

	describe("maxDepth feature", () => {
		it("should treat tags beyond maxDepth as stopNodes", () => {
			parser = new PartialXMLStreamParser({
				maxDepth: 2,
				textNodeName: "#text",
			})
			let streamResult = parser.parseStream(
				"<root><level1><level2><level3>content</level3></level2></level1></root>",
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							level1: {
								level2: { "#text": "<level3>content</level3>" },
							},
						},
					},
				],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							level1: {
								level2: { "#text": "<level3>content</level3>" },
							},
						},
					},
				],
			})
		})

		it("should handle maxDepth with nested tags and attributes", () => {
			parser = new PartialXMLStreamParser({
				maxDepth: 3,
				textNodeName: "#text",
				attributeNamePrefix: "@",
			})
			let streamResult = parser.parseStream('<root><a><b><c id="test"><d>deep content</d></c></b></a></root>')
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							a: {
								b: {
									c: {
										"#text": "<d>deep content</d>",
										"@id": "test",
									},
								},
							},
						},
					},
				],
			})
		})

		it("should work with maxDepth 1 (only root level allowed)", () => {
			parser = new PartialXMLStreamParser({
				maxDepth: 1,
				textNodeName: "#text",
			})
			let streamResult = parser.parseStream("<root><child>content</child></root>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							child: { "#text": "content" },
						},
					},
				],
			})
		})

		it("should work with maxDepth 0 (treat everything as text)", () => {
			parser = new PartialXMLStreamParser({
				maxDepth: 0,
				textNodeName: "#text",
			})
			let streamResult = parser.parseStream("<root><child>content</child></root>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: ["<root><child>content</child></root>"],
			})
		})

		it("should combine maxDepth with existing stopNodes", () => {
			parser = new PartialXMLStreamParser({
				maxDepth: 3,
				stopNodes: ["root.level1.script"],
				textNodeName: "#text",
			})
			let streamResult = parser.parseStream(
				"<root><level1><script>code</script><level2><level3>content</level3></level2></level1></root>",
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							level1: {
								script: { "#text": "code" },
								level2: {
									level3: { "#text": "content" },
								},
							},
						},
					},
				],
			})
		})

		it("should handle self-closing tags at max depth", () => {
			parser = new PartialXMLStreamParser({
				maxDepth: 2,
				textNodeName: "#text",
			})
			let streamResult = parser.parseStream(
				"<root><level1><selfclosing/><level2>content</level2></level1></root>",
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							level1: {
								selfclosing: {},
								level2: { "#text": "content" },
							},
						},
					},
				],
			})
		})

		it("should handle null maxDepth (no depth limit)", () => {
			parser = new PartialXMLStreamParser({
				maxDepth: null,
				textNodeName: "#text",
			})
			let streamResult = parser.parseStream("<root><a><b><c><d><e>deep content</e></d></c></b></a></root>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							a: {
								b: {
									c: {
										d: {
											e: { "#text": "deep content" },
										},
									},
								},
							},
						},
					},
				],
			})
		})
	})

	describe("stopNodes feature", () => {
		it("should treat content of a stopNode as text", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["script"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream("<root><script>let a = 1; console.log(a);</script></root>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ root: { script: { "#text": "let a = 1; console.log(a);" } } }],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ root: { script: { "#text": "let a = 1; console.log(a);" } } }],
			})
		})

		it("should parse attributes of a stopNode", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["script"],
				attributeNamePrefix: "@",
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream(
				'<root><script type="text/javascript" src="app.js">let b = 2;</script></root>',
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							script: {
								"@type": "text/javascript",
								"@src": "app.js",
								"#text": "let b = 2;",
							},
						},
					},
				],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							script: {
								"@type": "text/javascript",
								"@src": "app.js",
								"#text": "let b = 2;",
							},
						},
					},
				],
			})
		})

		it("should not parse XML tags inside a stopNode", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["data"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream("<root><data><item>one</item><value>100</value></data></root>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: { data: { "#text": "<item>one</item><value>100</value>" } },
					},
				],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: { data: { "#text": "<item>one</item><value>100</value>" } },
					},
				],
			})
		})

		it("should handle multiple stopNode types", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["script", "style"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream(
				"<root><script>var c=3;</script><style>.cls{color:red}</style></root>",
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							script: { "#text": "var c=3;" },
							style: { "#text": ".cls{color:red}" },
						},
					},
				],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							script: { "#text": "var c=3;" },
							style: { "#text": ".cls{color:red}" },
						},
					},
				],
			})
		})

		it("should handle self-closing tags within stopNode content", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["htmlData"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream(
				'<doc><htmlData>Some text <br/> and more <img src="test.png"/></htmlData></doc>',
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						doc: {
							htmlData: {
								"#text": 'Some text <br/> and more <img src="test.png"/>',
							},
						},
					},
				],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						doc: {
							htmlData: {
								"#text": 'Some text <br/> and more <img src="test.png"/>',
							},
						},
					},
				],
			})
		})

		it("should handle unterminated stopNode at end of stream", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["raw"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream("<root><raw>This content is not closed")
			expect(streamResult).toEqual({
				metadata: { partial: true },
				xml: [{ root: { raw: { "#text": "This content is not closed" } } }],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: true },
				xml: [{ root: { raw: { "#text": "This content is not closed" } } }],
			})
		})

		it("should correctly handle nested stopNodes of the same name", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["codeblock"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			const xml = "<doc><codeblock>Outer <codeblock>Inner</codeblock> Content</codeblock></doc>"
			let streamResult = parser.parseStream(xml)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						doc: {
							codeblock: {
								"#text": "Outer <codeblock>Inner</codeblock> Content",
							},
						},
					},
				],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						doc: {
							codeblock: {
								"#text": "Outer <codeblock>Inner</codeblock> Content",
							},
						},
					},
				],
			})
		})

		it("should handle stopNode as the root element", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["rawhtml"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream("<rawhtml><head></head><body><p>Hello</p></body></rawhtml>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ rawhtml: { "#text": "<head></head><body><p>Hello</p></body>" } }],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ rawhtml: { "#text": "<head></head><body><p>Hello</p></body>" } }],
			})
		})

		it("should handle empty stopNode", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["emptyContent"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream("<data><emptyContent></emptyContent></data>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ data: { emptyContent: { "#text": "" } } }],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ data: { emptyContent: { "#text": "" } } }],
			})
		})

		it("should handle stopNode with only whitespace content", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["whitespaceNode"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream("<data><whitespaceNode>   \n\t   </whitespaceNode></data>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ data: { whitespaceNode: { "#text": "   \n\t   " } } }],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ data: { whitespaceNode: { "#text": "   \n\t   " } } }],
			})
		})

		it("should handle stopNode content split across multiple chunks", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["log"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			parser.parseStream("<system><log>Part 1 data ")
			let streamResult = parser.parseStream("Part 2 data <inner>tag</inner> and more")
			expect(streamResult).toEqual({
				metadata: { partial: true },
				xml: [
					{
						system: {
							log: {
								"#text": "Part 1 data Part 2 data <inner>tag</inner> and more",
							},
						},
					},
				],
			})

			streamResult = parser.parseStream(" final part.</log></system>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						system: {
							log: {
								"#text": "Part 1 data Part 2 data <inner>tag</inner> and more final part.",
							},
						},
					},
				],
			})

			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						system: {
							log: {
								"#text": "Part 1 data Part 2 data <inner>tag</inner> and more final part.",
							},
						},
					},
				],
			})
		})

		it("should handle stopNode with attributes and content split across chunks", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["customTag"],
				attributeNamePrefix: "@",
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			parser.parseStream('<root><customTag id="123" ')
			parser.parseStream('name="test">This is the ')
			let streamResult = parser.parseStream("content with  wewnętrzny tag <tag/>.</customTag></root>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							customTag: {
								"@id": "123",
								"@name": "test",
								"#text": "This is the content with  wewnętrzny tag <tag/>.",
							},
						},
					},
				],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							customTag: {
								"@id": "123",
								"@name": "test",
								"#text": "This is the content with  wewnętrzny tag <tag/>.",
							},
						},
					},
				],
			})
		})

		it("should handle stop node when stopNodes option is a string", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: "script",
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream('<root><script>alert("hello");</script></root>')
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ root: { script: { "#text": 'alert("hello");' } } }],
			})
		})

		it("should handle path-based stopNode correctly", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["read.file.metadata"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			const xml =
				"<read><metadata><item>one</item></metadata><file><metadata><item>two</item><subitem>three</subitem></metadata><other>data</other></file></read>"
			let streamResult = parser.parseStream(xml)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						read: {
							metadata: { item: { "#text": "one" } }, // Not a stopNode
							file: {
								metadata: {
									"#text": "<item>two</item><subitem>three</subitem>",
								}, // Is a stopNode
								other: { "#text": "data" }, // Not a stopNode
							},
						},
					},
				],
			})
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						read: {
							metadata: { item: { "#text": "one" } },
							file: {
								metadata: {
									"#text": "<item>two</item><subitem>three</subitem>",
								},
								other: { "#text": "data" },
							},
						},
					},
				],
			})
		})

		it("should prioritize path-based stopNode over simple name if both could match", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["read.file.metadata", "nomatch.metadata"], // read.file.metadata will match
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			const xml =
				"<read><metadata><item>one</item></metadata><file><metadata><item>two</item></metadata></file></read>"
			let streamResult = parser.parseStream(xml)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						read: {
							metadata: { item: { "#text": "one" } }, // Not a stopNode
							file: {
								metadata: { "#text": "<item>two</item>" }, // Is a stopNode due to path
							},
						},
					},
				],
			})
		})

		it("should handle simple stopNode alongside path-based stopNode", () => {
			parser = new PartialXMLStreamParser({
				stopNodes: ["script", "app.config.settings.value"],
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			const xml =
				"<app><script>let x=1;</script><config><settings><value>secret</value><other>val</other></settings></config></app>"
			let streamResult = parser.parseStream(xml)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						app: {
							script: { "#text": "let x=1;" }, // Simple stopNode
							config: {
								settings: {
									value: { "#text": "secret" }, // Path-based stopNode
									other: { "#text": "val" }, // Not a stopNode
								},
							},
						},
					},
				],
			})
		})

		it("should handle a stopNode whose text content contains its own closing tag string", () => {
			// Parser from beforeEach might have other defaults, re-initialize for clarity
			parser = new PartialXMLStreamParser({
				stopNodes: ["c"], // Make 'c' a stopNode
				textNodeName: "#text", // Consistent with other tests and default beforeEach
			})
			const message = `<a><b>src/file.ts</b><c>
\tfunction example() {
\t// This has XML-like content: &lt;/c&gt;
\treturn true;
\t}
\t</c></a>`
			const expectedOutput = {
				metadata: { partial: false },
				xml: [
					{
						a: {
							b: { "#text": "src/file.ts" },
							c: {
								"#text":
									"\n\tfunction example() {\n\t// This has XML-like content: &lt;/c&gt;\n\treturn true;\n\t}\n\t",
							},
						},
					},
				],
			}
			let streamResult = parser.parseStream(message)
			expect(streamResult).toEqual(expectedOutput)

			// Test with null to ensure final state is also correct and parser considers it complete
			streamResult = parser.parseStream(null)
			expect(streamResult).toEqual(expectedOutput)
		})

		describe("stopNode wildcard patterns", () => {
			it("should handle wildcard patterns with asterisk at end (prefix matching)", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["app.*"],
					textNodeName: "#text",
				})
				const xml =
					"<root><app><config><item>not parsed</item><value>123</value></config></app><app><settings><option>also not parsed</option></settings></app></root>"
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							root: {
								app: [
									{ config: { "#text": "<item>not parsed</item><value>123</value>" } },
									{ settings: { "#text": "<option>also not parsed</option>" } },
								],
							},
						},
					],
				})
			})

			it("should handle wildcard patterns with asterisk at beginning (suffix matching)", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["*.suggest"],
					textNodeName: "#text",
				})
				const xml =
					"<root><follow_up><suggest><option>Option 1</option><desc>Description</desc></suggest></follow_up><other><suggest><item>not parsed</item></suggest></other></root>"
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							root: {
								follow_up: {
									suggest: { "#text": "<option>Option 1</option><desc>Description</desc>" },
								},
								other: { suggest: { "#text": "<item>not parsed</item>" } },
							},
						},
					],
				})
			})

			it("should handle wildcard patterns in the middle", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["app.*.value"],
					textNodeName: "#text",
				})
				const xml =
					"<root><app><config><value><item>not parsed</item><data>123</data></value></config><settings><value><option>also not parsed</option></value></settings></app></root>"
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							root: {
								app: {
									config: { value: { "#text": "<item>not parsed</item><data>123</data>" } },
									settings: { value: { "#text": "<option>also not parsed</option>" } },
								},
							},
						},
					],
				})
			})

			it("should handle multiple wildcards in one pattern", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["*.config.*"],
					textNodeName: "#text",
				})
				const xml =
					"<root><app><config><value><item>not parsed</item></value><setting><data>also not parsed</data></setting></config></app><other><config><data><nested>not parsed either</nested></data></config></other></root>"
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							root: {
								app: {
									config: {
										value: { "#text": "<item>not parsed</item>" },
										setting: { "#text": "<data>also not parsed</data>" },
									},
								},
								other: {
									config: { data: { "#text": "<nested>not parsed either</nested>" } },
								},
							},
						},
					],
				})
			})

			it("should handle wildcard patterns with suffix matching for longer paths", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["follow_up.*"],
					textNodeName: "#text",
				})
				const xml =
					"<ask_followup_question><question>What?</question><follow_up><suggest><option>Option 1</option></suggest><suggest><option>Option 2</option></suggest></follow_up></ask_followup_question>"
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							ask_followup_question: {
								question: { "#text": "What?" },
								follow_up: {
									suggest: [
										{ "#text": "<option>Option 1</option>" },
										{ "#text": "<option>Option 2</option>" },
									],
								},
							},
						},
					],
				})
			})

			it("should handle complex wildcard patterns with exact and suffix matching", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["a.*"],
					textNodeName: "#text",
				})
				const xml =
					"<root><a><b><item>exact match not parsed</item></b></a><deep><nested><a><c><data>suffix match not parsed</data></c></a></nested></deep></root>"
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							root: {
								a: { b: { "#text": "<item>exact match not parsed</item>" } },
								deep: {
									nested: {
										a: { c: { "#text": "<data>suffix match not parsed</data>" } },
									},
								},
							},
						},
					],
				})
			})

			it("should handle wildcard patterns mixed with regular stopNodes", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["script", "app.*", "*.config"],
					textNodeName: "#text",
				})
				const xml =
					"<root><script>let x = <tag>not parsed</tag>;</script><app><settings><item>not parsed</item></settings></app><other><config><data>also not parsed</data></config></other></root>"
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							root: {
								script: { "#text": "let x = <tag>not parsed</tag>;" },
								app: { settings: { "#text": "<item>not parsed</item>" } },
								other: { config: { "#text": "<data>also not parsed</data>" } },
							},
						},
					],
				})
			})

			it("should not match partial wildcard patterns", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["app.config.*"],
					textNodeName: "#text",
				})
				const xml =
					"<root><app><other><item>normal parsing</item></other></app><different><config><value><data>also normal</data></value></config></different></root>"
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							root: {
								app: { other: { item: { "#text": "normal parsing" } } },
								different: {
									config: { value: { data: { "#text": "also normal" } } },
								},
							},
						},
					],
				})
			})

			it("should handle wildcard patterns with attributes", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["app.*"],
					textNodeName: "#text",
					attributeNamePrefix: "@",
				})
				const xml =
					'<root><app><config id="test"><item>not parsed</item><value attr="val">also not parsed</value></config></app></root>'
				let streamResult = parser.parseStream(xml)
				expect(streamResult).toEqual({
					metadata: { partial: false },
					xml: [
						{
							root: {
								app: {
									config: {
										"@id": "test",
										"#text": '<item>not parsed</item><value attr="val">also not parsed</value>',
									},
								},
							},
						},
					],
				})
			})
		})

		describe("stopNode CDATA handling", () => {
			it("should handle CDATA content inside stopnodes", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["script"],
					textNodeName: "#text",
				})

				const input = `<root>
<script type="text/javascript">
<![CDATA[
if (x < y && z > 0) {
  alert("Hello <world>!");
}
]]>
</script>
</root>`

				const result = parser.parseStream(input)

				// The CDATA content should be extracted and the CDATA markers should be removed
				expect(result!.xml![0].root.script["#text"]).toBe(`

if (x < y && z > 0) {
  alert("Hello <world>!");
}

`)
			})

			it("should handle multiple CDATA sections in stopnodes", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["code"],
					textNodeName: "#text",
				})

				const input = `<root>
<code>
Some text before
<![CDATA[<tag>content</tag>]]>
Some text between
<![CDATA[more & content]]>
Some text after
</code>
</root>`

				const result = parser.parseStream(input)

				// CDATA markers should be removed, content should be preserved
				expect(result!.xml![0].root.code["#text"]).toBe(`
Some text before
<tag>content</tag>
Some text between
more & content
Some text after
`)
			})

			it("should handle partial CDATA in streaming stopnodes", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["data"],
					textNodeName: "#text",
				})

				// Stream the content in chunks
				let result = parser.parseStream("<root><data><![CDATA[partial")
				expect(result!.metadata.partial).toBe(true)

				result = parser.parseStream(" content]]></data></root>")
				expect(result!.metadata.partial).toBe(false)

				// Should extract CDATA content properly
				expect(result!.xml![0].root.data["#text"]).toBe("partial content")
			})

			it("should handle CDATA spanning across tag boundaries in stopnodes", () => {
				parser = new PartialXMLStreamParser({
					stopNodes: ["a.b"],
					textNodeName: "#text",
				})

				const input = `<a><b><![CDATA[adsasdas</b>]]></b></a>`

				const result = parser.parseStream(input)

				// CDATA content should be extracted properly even when it spans across tag boundaries
				expect(result!.xml![0].a.b["#text"]).toBe("adsasdas</b>")
			})
		})
	})

	describe("alwaysCreateTextNode option", () => {
		it("should always create #text node when alwaysCreateTextNode is true for non-whitespace text", () => {
			parser = new PartialXMLStreamParser({
				alwaysCreateTextNode: true,
				textNodeName: "#text",
			})
			let streamResult = parser.parseStream("<doc>Text</doc>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ doc: { "#text": "Text" } }],
			})
		})

		it("should not simplify text-only elements if alwaysCreateTextNode is true", () => {
			parser = new PartialXMLStreamParser({
				alwaysCreateTextNode: true,
				textNodeName: "#text",
			})
			let streamResult = parser.parseStream("<parent><child>simple text</child></parent>")
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ parent: { child: { "#text": "simple text" } } }],
			})
		})

		it("should create #text for elements with attributes and text when alwaysCreateTextNode is true", () => {
			parser = new PartialXMLStreamParser({
				alwaysCreateTextNode: true,
				textNodeName: "#text",
				attributeNamePrefix: "@",
			})
			let streamResult = parser.parseStream('<parent><child attr="val">text content</child></parent>')
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [{ parent: { child: { "@attr": "val", "#text": "text content" } } }],
			})
		})

		it("should handle mixed content with alwaysCreateTextNode true, omitting whitespace-only nodes", () => {
			parser = new PartialXMLStreamParser({
				alwaysCreateTextNode: true,
				textNodeName: "#text",
			})
			const xml = "<root>text1 <item>itemtext</item> text2 <another/> text3</root>"
			let streamResult = parser.parseStream(xml)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						root: {
							"#text": "text1  text2  text3",
							item: { "#text": "itemtext" },
							another: {},
						},
					},
				],
			})
		})
	})

	describe("parsePrimitives option", () => {
		it("should parse numbers and booleans in text nodes if parsePrimitives is true", () => {
			parser = new PartialXMLStreamParser({
				parsePrimitives: true,
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream(
				"<data><num>123</num><bool>true</bool><str>false</str><neg>-45.6</neg><notnum>123a</notnum><strtrue>True</strtrue></data>",
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						data: {
							num: { "#text": 123 },
							bool: { "#text": true },
							str: { "#text": false },
							neg: { "#text": -45.6 },
							notnum: { "#text": "123a" },
							strtrue: { "#text": true },
						},
					},
				],
			})
		})

		it("should parse numbers and booleans in attribute values if parsePrimitives is true", () => {
			parser = new PartialXMLStreamParser({
				parsePrimitives: true,
				attributeNamePrefix: "@",
				textNodeName: "#text", // alwaysCreateTextNode is true by default
			})
			let streamResult = parser.parseStream(
				'<data num="456" bool="false" str="true" neg="-0.5" notbool="FALSEY" strbool="True"/>',
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						data: {
							"@num": 456,
							"@bool": false,
							"@str": true,
							"@neg": -0.5,
							"@notbool": "FALSEY",
							"@strbool": true,
						},
					},
				],
			})
		})

		it("should not parse primitives if option is false (default behavior)", () => {
			parser = new PartialXMLStreamParser({
				// textNodeName: "#text" is from beforeEach
				attributeNamePrefix: "@",
				// parsePrimitives: false is default in main code
			})
			let streamResult = parser.parseStream(
				'<data num="123" bool="true"><textnum>456</textnum><textbool>false</textbool></data>',
			)
			expect(streamResult).toEqual({
				metadata: { partial: false },
				xml: [
					{
						data: {
							"@num": "123",
							"@bool": "true",
							textnum: { "#text": "456" }, // alwaysCreateTextNode: true is default
							textbool: { "#text": "false" }, // alwaysCreateTextNode: true is default
						},
					},
				],
			})
		})
	})

	it("should handle multiple root elements with text nodes interspersed", () => {
		// Uses parser from beforeEach (alwaysCreateTextNode: true)
		const xml = "text1<tagA>contentA</tagA>text2<tagB/>text3"
		const streamResult = parser.parseStream(xml)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: ["text1", { tagA: { "#text": "contentA" } }, "text2", { tagB: {} }, "text3"],
		})
	})

	it("should handle a single root text node correctly", () => {
		parser = new PartialXMLStreamParser() // Uses new default alwaysCreateTextNode: true
		const xml = "Just a root text node"
		const streamResult = parser.parseStream(xml)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: ["Just a root text node"],
		})
	})

	it("should handle input with only text content (no XML tags), including whitespace-only", () => {
		parser = new PartialXMLStreamParser() // Fresh parser

		// Test with regular text and surrounding whitespace
		let textOnlyInput = "  Some plain text here.  "
		let streamResult = parser.parseStream(textOnlyInput)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [textOnlyInput],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [textOnlyInput],
		})

		parser.reset() // Reset for the next sub-test

		// Test with whitespace-only text
		let whitespaceOnlyInput = "   \t  \n  "
		streamResult = parser.parseStream(whitespaceOnlyInput)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [],
		})

		parser.reset()

		// Test with empty string input then null
		streamResult = parser.parseStream("")
		expect(streamResult).toEqual({ metadata: { partial: true }, xml: [] }) // Empty string is initially partial, no content
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({ metadata: { partial: false }, xml: [] }) // Ends as null if only empty string was passed
	})

	it("should handle complex nested structure with attributes and mixed content (alwaysCreateTextNode: true, whitespace omitted)", () => {
		parser = new PartialXMLStreamParser({
			attributeNamePrefix: "@",
			textNodeName: "#text",
			alwaysCreateTextNode: true,
		})
		const xmlData = `
            <root a="nice" checked>
                <a>
                    <b val="1">hello</b>
                    <b val="2" />
                </a>
                <a>
                    <c>world</c>
                </a>
                <b>wow phir se</b>
            </root>
        `
		let streamResult = parser.parseStream(xmlData)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				{
					root: {
						"@a": "nice",
						"@checked": true,
						a: [
							{
								b: [{ "@val": "1", "#text": "hello" }, { "@val": "2" }],
							},
							{
								c: { "#text": "world" },
							},
						],
						b: { "#text": "wow phir se" },
					},
				},
			],
		})
	})

	it("should handle complex nested structure with attributes and mixed content - no alwaysCreateTextNode (whitespace omitted)", () => {
		// This test will now behave like alwaysCreateTextNode: true because of the default change
		parser = new PartialXMLStreamParser({
			attributeNamePrefix: "@",
			textNodeName: "#text",
			// alwaysCreateTextNode: false, // To test the old behavior, this would be needed
		})
		const xmlData = `
            <root a="nice" checked>
                <a>
                    <b val="1">hello</b>
                    <b val="2" />
                </a>
                <a>
                    <c>world</c>
                </a>
                <b>wow phir se</b>
            </root>
        `
		let streamResult = parser.parseStream(xmlData)
		expect(streamResult).toEqual({
			// Expected output now reflects alwaysCreateTextNode: true
			metadata: { partial: false },
			xml: [
				{
					root: {
						"@a": "nice",
						"@checked": true,
						a: [
							{
								b: [{ "@val": "1", "#text": "hello" }, { "@val": "2" }],
							},
							{
								c: { "#text": "world" }, // Changed from "world"
							},
						],
						b: { "#text": "wow phir se" }, // Changed from "wow phir se"
					},
				},
			],
		})
	})

	it("should correctly parse CDATA content containing an XML-like closing tag string", () => {
		// Uses parser from beforeEach (alwaysCreateTextNode: true, textNodeName: "#text")
		const message = `<a><b>src/file.ts</b><c><![CDATA[
\tfunction example() {
\t// This has XML-like content: </c>
\treturn true;
\t}
\t]]></c></a>`
		const expectedOutput = {
			metadata: { partial: false },
			xml: [
				{
					a: {
						b: { "#text": "src/file.ts" },
						c: {
							"#text":
								"\n\tfunction example() {\n\t// This has XML-like content: </c>\n\treturn true;\n\t}\n\t",
						},
					},
				},
			],
		}
		let streamResult = parser.parseStream(message)
		expect(streamResult).toEqual(expectedOutput)

		streamResult = parser.parseStream(null) // Ensure final state is also correct
		expect(streamResult).toEqual(expectedOutput)
	})

	it("should reflect modifications to returned xml object due to direct reference", () => {
		// Uses parser from beforeEach (alwaysCreateTextNode: true)
		let streamResult = parser.parseStream("<root><item>A</item>")
		// Initial state
		expect(streamResult!.xml!).toEqual([{ root: { item: { "#text": "A" } } }])
		expect(streamResult!.metadata.partial).toBe(true)

		// Modify the returned object (which is now a direct reference)
		if (
			streamResult!.xml! &&
			streamResult!.xml![0] &&
			streamResult!.xml![0].root &&
			streamResult!.xml![0].root.item
		) {
			streamResult!.xml![0].root.item["#text"] = "B"
		}

		// Continue parsing or finalize
		let finalResult = parser.parseStream("</root>")
		expect(finalResult!.xml).toEqual([{ root: { item: { "#text": "B" } } }]) // Expect modification to be reflected
		expect(finalResult!.metadata.partial).toBe(false)

		finalResult = parser.parseStream(null) // Signal end of stream
		expect(finalResult!.xml).toEqual([{ root: { item: { "#text": "B" } } }])
		expect(finalResult!.metadata.partial).toBe(false)
	})

	it("should parse a simple tool-like XML string", () => {
		// parser is from beforeEach, implies alwaysCreateTextNode: true, textNodeName: "#text"
		const message = `<simple_tool><param>value</param></simple_tool>`
		let streamResult = parser.parseStream(message)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				{
					simple_tool: {
						param: { "#text": "value" },
					},
				},
			],
		})
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				{
					simple_tool: {
						param: { "#text": "value" },
					},
				},
			],
		})
	})

	it("should parse a complex message with mixed text and multiple XML elements", () => {
		// parser is from beforeEach, implies alwaysCreateTextNode: true, textNodeName: "#text"
		// parsePrimitives is false by default.
		const message =
			"I'll help you with that task.\\n\\n\\t" +
			"<read_file><path>src/index.ts</path></read_file>\\n\\n\\t" +
			"Now let's modify the file:\\n\\n\\t" +
			"<write_to_file><path>src/index.ts</path><content>\\n" +
			"// Updated content\\n" +
			'console.log("Hello world");\\n' +
			"</content><line_count>2</line_count></write_to_file>\\n\\n\\t" +
			"Let's run the code:\\n\\n\\t" +
			"<execute_command><command>node src/index.ts</command></execute_command>"

		let streamResult = parser.parseStream(message)
		expect(streamResult).toEqual({
			metadata: { partial: false }, // Entire message processed as one chunk
			xml: [
				"I'll help you with that task.\\n\\n\\t",
				{
					read_file: {
						path: { "#text": "src/index.ts" },
					},
				},
				"\\n\\n\\tNow let's modify the file:\\n\\n\\t",
				{
					write_to_file: {
						path: { "#text": "src/index.ts" },
						content: { "#text": '\\n// Updated content\\nconsole.log("Hello world");\\n' },
						line_count: { "#text": "2" }, // parsePrimitives is false
					},
				},
				"\\n\\n\\tLet's run the code:\\n\\n\\t",
				{
					execute_command: {
						command: { "#text": "node src/index.ts" },
					},
				},
			],
		})

		// Test with null to ensure final state is the same and parser considers it complete
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				"I'll help you with that task.\\n\\n\\t",
				{
					read_file: {
						path: { "#text": "src/index.ts" },
					},
				},
				"\\n\\n\\tNow let's modify the file:\\n\\n\\t",
				{
					write_to_file: {
						path: { "#text": "src/index.ts" },
						content: { "#text": '\\n// Updated content\\nconsole.log("Hello world");\\n' },
						line_count: { "#text": "2" },
					},
				},
				"\\n\\n\\tLet's run the code:\\n\\n\\t",
				{
					execute_command: {
						command: { "#text": "node src/index.ts" },
					},
				},
			],
		})
	})

	it("should parse a complex message with mixed text and multiple XML elements with allowRoot", () => {
		// parser is from beforeEach, implies alwaysCreateTextNode: true, textNodeName: "#text"
		// parsePrimitives is false by default.
		const message =
			"I'll help you with that task.\\n\\n\\t" +
			"<read_file><path>src/index.ts</path></read_file>\\n\\n\\t" +
			"Now let's modify the file:\\n\\n\\t" +
			"<write_to_file><path>src/index.ts</path><content>\\n" +
			"// Updated content\\n" +
			'console.log("Hello world");\\n' +
			"</content><line_count>2</line_count></write_to_file>\\n\\n\\t" +
			"Let's run the code:\\n\\n\\t" +
			"<execute_command><command>node src/index.ts</command></execute_command>"

		parser = new PartialXMLStreamParser({
			allowedRootNodes: ["read_file", "write_to_file", "execute_command"],
			textNodeName: "#text",
			parsePrimitives: false,
		})

		let streamResult = parser.parseStream(message)
		expect(streamResult).toEqual({
			metadata: { partial: false }, // Entire message processed as one chunk
			xml: [
				"I'll help you with that task.\\n\\n\\t",
				{
					read_file: {
						path: { "#text": "src/index.ts" },
					},
				},
				"\\n\\n\\tNow let's modify the file:\\n\\n\\t",
				{
					write_to_file: {
						path: { "#text": "src/index.ts" },
						content: { "#text": '\\n// Updated content\\nconsole.log("Hello world");\\n' },
						line_count: { "#text": "2" }, // parsePrimitives is false
					},
				},
				"\\n\\n\\tLet's run the code:\\n\\n\\t",
				{
					execute_command: {
						command: { "#text": "node src/index.ts" },
					},
				},
			],
		})

		// Test with null to ensure final state is the same and parser considers it complete
		streamResult = parser.parseStream(null)
		expect(streamResult).toEqual({
			metadata: { partial: false },
			xml: [
				"I'll help you with that task.\\n\\n\\t",
				{
					read_file: {
						path: { "#text": "src/index.ts" },
					},
				},
				"\\n\\n\\tNow let's modify the file:\\n\\n\\t",
				{
					write_to_file: {
						path: { "#text": "src/index.ts" },
						content: { "#text": '\\n// Updated content\\nconsole.log("Hello world");\\n' },
						line_count: { "#text": "2" },
					},
				},
				"\\n\\n\\tLet's run the code:\\n\\n\\t",
				{
					execute_command: {
						command: { "#text": "node src/index.ts" },
					},
				},
			],
		})
	})
})
describe("Conditional XML Parsing with allowedRootNodes", () => {
	let parser

	it("should parse as XML when root node matches allowedRootNodes", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: ["allowedRoot"], textNodeName: "#text" })
		let streamResult = parser.parseStream("<allowedRoot><item>content</item></allowedRoot>")
		expect(streamResult!.xml!).toEqual([{ allowedRoot: { item: { "#text": "content" } } }])
		expect(streamResult!.metadata.partial).toBe(false) // Assuming complete XML in one chunk
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual([{ allowedRoot: { item: { "#text": "content" } } }])
		expect(streamResult!.metadata.partial).toBe(false)

		parser.reset()
		streamResult = parser.parseStream("<allo")
		expect(streamResult!.xml!).toEqual([]) // No complete root tag yet, decision pending
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream("wedRoot><item>data</item></allowedRoot>")
		expect(streamResult!.xml!).toEqual([{ allowedRoot: { item: { "#text": "data" } } }])
		expect(streamResult!.metadata.partial).toBe(false) // Complete XML
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual([{ allowedRoot: { item: { "#text": "data" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should treat as plain text when root node does not match allowedRootNodes", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: ["validRoot"], textNodeName: "#text" })
		let streamResult = parser.parseStream("<notAll")
		expect(streamResult!.xml!).toEqual(["<notAll"])
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream("owed><item>text</item></notAllowed>")
		expect(streamResult!.xml!).toEqual(["<notAllowed><item>text</item></notAllowed>"])
		expect(streamResult!.metadata.partial).toBe(true) // Still partial until null
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual(["<notAllowed><item>text</item></notAllowed>"])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should parse as XML when allowedRootNodes is undefined", () => {
		parser = new PartialXMLStreamParser({ textNodeName: "#text" }) // allowedRootNodes is undefined
		let streamResult = parser.parseStream("<anyRoot><item>content</item></anyRoot>")
		expect(streamResult!.xml!).toEqual([{ anyRoot: { item: { "#text": "content" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual([{ anyRoot: { item: { "#text": "content" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should parse as XML when allowedRootNodes is an empty array", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: [], textNodeName: "#text" })
		let streamResult = parser.parseStream("<anyRoot><item>content</item></anyRoot>")
		expect(streamResult!.xml!).toEqual([{ anyRoot: { item: { "#text": "content" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual([{ anyRoot: { item: { "#text": "content" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should parse as XML when allowedRootNodes is a string and matches", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: "allowedRoot", textNodeName: "#text" })
		let streamResult = parser.parseStream("<allowedRoot><item>data</item></allowedRoot>")
		expect(streamResult!.xml!).toEqual([{ allowedRoot: { item: { "#text": "data" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual([{ allowedRoot: { item: { "#text": "data" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should treat as plain text when allowedRootNodes is a string and does not match", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: "allowedRoot", textNodeName: "#text" })
		let streamResult = parser.parseStream("<otherRoot>data</otherRoot>")
		expect(streamResult!.xml!).toEqual(["<otherRoot>data</otherRoot>"])
		expect(streamResult!.metadata.partial).toBe(true) // Will be plain text, but partial until null
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual(["<otherRoot>data</otherRoot>"])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should treat non-XML input as plain text when allowedRootNodes is active", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: ["root"], textNodeName: "#text" })
		let streamResult = parser.parseStream("this is plain text")
		expect(streamResult!.xml!).toEqual(["this is plain text"])
		// If it's the only chunk before null, it might be partial: false immediately.
		// However, the current logic might keep it partial until null.
		// Let's assume it's partial until null for consistency with other text cases.
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual(["this is plain text"])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should treat as plain text if stream ends before root tag is fully identified", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: ["root"], textNodeName: "#text" })
		let streamResult = parser.parseStream("<roo")
		expect(streamResult!.xml!).toEqual([]) // Decision pending
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual(["<roo"]) // Treated as plain text at EOS
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should continue as plain text if initial chunks determine non-XML", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: ["root"], textNodeName: "#text" })
		let streamResult = parser.parseStream("  leading text ")
		expect(streamResult!.xml!).toEqual(["  leading text "]) // Decision: plain text
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream("<notRoot>more</notRoot>")
		expect(streamResult!.xml!).toEqual(["  leading text <notRoot>more</notRoot>"])
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual(["  leading text <notRoot>more</notRoot>"])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should handle empty or whitespace-only input correctly with allowedRootNodes", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: ["root"], textNodeName: "#text" })
		let streamResult = parser.parseStream("")
		expect(streamResult!.xml!).toEqual([])
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual([]) // Empty input treated as no content
		expect(streamResult!.metadata.partial).toBe(false)

		parser.reset()
		streamResult = parser.parseStream("   ")
		expect(streamResult!.xml!).toEqual(["   "]) // Decision: plain text
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual(["   "])
		expect(streamResult!.metadata.partial).toBe(false)
	})

	it("should correctly identify root tag even if split across multiple small chunks", () => {
		parser = new PartialXMLStreamParser({ allowedRootNodes: ["veryLongRootElementName"], textNodeName: "#text" })
		let streamResult = parser.parseStream("<very")
		expect(streamResult!.xml!).toEqual([])
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream("LongRoo")
		expect(streamResult!.xml!).toEqual([])
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream("tElementNa")
		expect(streamResult!.xml!).toEqual([])
		expect(streamResult!.metadata.partial).toBe(true)
		streamResult = parser.parseStream("me><item>data</item></veryLongRootElementName>")
		expect(streamResult!.xml!).toEqual([{ veryLongRootElementName: { item: { "#text": "data" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
		streamResult = parser.parseStream(null)
		expect(streamResult!.xml!).toEqual([{ veryLongRootElementName: { item: { "#text": "data" } } }])
		expect(streamResult!.metadata.partial).toBe(false)
	})
})

describe("xmlObjectToString", () => {
	describe("Simple object with only text", () => {
		it("should convert simple text content", () => {
			const input = { tag: "text content" }
			const expected = "<tag>text content</tag>"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Object with attributes", () => {
		it("should convert object with attributes only", () => {
			const input = { tag: { "@attr": "value" } }
			const expected = '<tag attr="value"></tag>'
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Object with text and attributes", () => {
		it("should convert object with both attributes and text", () => {
			const input = { tag: { "@attr": "value", "#text": "text" } }
			const expected = '<tag attr="value">text</tag>'
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Nested objects", () => {
		it("should convert nested objects", () => {
			const input = { parent: { child: "text" } }
			const expected = "<parent><child>text</child></parent>"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Array of sibling elements", () => {
		it("should convert array of sibling elements as content of a root tag", () => {
			const input = { root: { item: ["1", "2"] } }
			const expected = "<root><item>1</item><item>2</item></root>"
			expect(xmlObjectToString(input)).toBe(expected)
		})

		it("should convert array of sibling elements at root level", () => {
			const input = [{ item: "1" }, { item: "2" }]
			const expected = "<item>1</item><item>2</item>"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Direct primitive input", () => {
		it("should handle string input", () => {
			const input = "just text"
			const expected = "just text"
			expect(xmlObjectToString(input)).toBe(expected)
		})

		it("should escape special characters in string input", () => {
			const input = "te&xt < > \" '"
			const expected = "te&xt < > \" '"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Text and attribute value escaping", () => {
		it("should escape special characters in both attributes and text", () => {
			const input = {
				tag: {
					"@attr": "<val & 'ok'>",
					"#text": "te&xt < > \" '",
				},
			}
			const expected = "<tag attr=\"<val & 'ok'>\">te&xt < > \" '</tag>"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Using custom options", () => {
		it("should use custom attributeNamePrefix and textNodeName", () => {
			const input = { tag: { _attr: "val", _text: "data" } }
			const options = { attributeNamePrefix: "_", textNodeName: "_text" }
			const expected = '<tag attr="val">data</tag>'
			expect(xmlObjectToString(input, options)).toBe(expected)
		})
	})

	describe("Empty object/array input", () => {
		it("should handle empty object", () => {
			const input = {}
			const expected = ""
			expect(xmlObjectToString(input)).toBe(expected)
		})

		it("should handle empty array", () => {
			const input: any[] = []
			const expected = ""
			expect(xmlObjectToString(input)).toBe(expected)
		})

		it("should handle tag with empty object", () => {
			const input = { tag: {} }
			const expected = "<tag></tag>"
			expect(xmlObjectToString(input)).toBe(expected)
		})

		it("should handle tag with empty array", () => {
			const input = { tag: [] }
			const expected = "<tag></tag>"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Specific example from previous discussions", () => {
		it("should convert the specific request example", () => {
			const input = {
				request: {
					id: { "#text": "123" },
					data: { "#text": "value<data>" },
				},
			}
			const expected = "<request><id>123</id><data>value<data></data></request>"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Object with multiple children of the same name", () => {
		it("should convert object with array of same-named children", () => {
			const input = { items: { item: ["one", "two"] } }
			const expected = "<items><item>one</item><item>two</item></items>"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Object with mixed content", () => {
		it("should handle array of text and element nodes under a single parent key", () => {
			const input = { mixed: { "#text": ["text1", { b: "bold" }, "text2"] } }
			const expected = "<mixed>text1<b>bold</b>text2</mixed>"
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Object with only an attribute, no text or children", () => {
		it("should handle tag with only attributes", () => {
			const input = { "my-tag": { "@my-attr": "xyz" } }
			const expected = '<my-tag my-attr="xyz"></my-tag>'
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Object with boolean/number attribute values", () => {
		it("should convert boolean and number attributes to strings", () => {
			const input = { data: { "@isValid": true, "@count": 100 } }
			const expected = '<data isValid="true" count="100"></data>'
			expect(xmlObjectToString(input)).toBe(expected)
		})
	})

	describe("Edge cases and null/undefined handling", () => {
		it("should handle null input", () => {
			expect(xmlObjectToString(null)).toBe("")
		})

		it("should handle undefined input", () => {
			expect(xmlObjectToString(undefined)).toBe("")
		})

		it("should handle number input", () => {
			expect(xmlObjectToString(42)).toBe("42")
		})

		it("should handle boolean input", () => {
			expect(xmlObjectToString(true)).toBe("true")
			expect(xmlObjectToString(false)).toBe("false")
		})
	})

	describe("Complex nested structures", () => {
		it("should handle deeply nested objects with mixed content", () => {
			const input = {
				root: {
					"@version": "1.0",
					header: {
						title: "Test Document",
						meta: { "@charset": "utf-8" },
					},
					body: {
						section: [
							{
								"@id": "intro",
								h1: "Introduction",
								p: "This is a test & example.",
							},
							{
								"@id": "content",
								h1: "Content",
								div: {
									"@class": "content",
									"#text": "Some content here",
								},
							},
						],
					},
				},
			}

			const expected =
				'<root version="1.0">' +
				'<header><title>Test Document</title><meta charset="utf-8"></meta></header>' +
				"<body>" +
				'<section id="intro"><h1>Introduction</h1><p>This is a test & example.</p></section>' +
				'<section id="content"><h1>Content</h1><div class="content">Some content here</div></section>' +
				"</body>" +
				"</root>"

			expect(xmlObjectToString(input)).toBe(expected)
		})
		describe("Round-trip Testing", () => {
			it("should maintain data integrity through parse -> serialize -> parse cycle", () => {
				const originalXml = '<root attr="value"><child>text & more</child><empty/></root>'
				const parser = new PartialXMLStreamParser({
					textNodeName: "#text",
					attributeNamePrefix: "@",
				})
				const parsed = parser.parseStream(originalXml)
				const serialized = xmlObjectToString(parsed!.xml![0])
				const reparsed = parser.parseStream(serialized)

				expect(reparsed!.xml).toEqual(parsed!.xml)
			})

			it("should handle round-trip with complex nested structures", () => {
				const complexObj = {
					document: {
						"@version": "1.0",
						header: { title: "Test & Demo" },
						body: {
							section: [
								{ "@id": "s1", p: "Paragraph 1" },
								{ "@id": "s2", p: "Paragraph 2 with <special> chars" },
							],
						},
					},
				}

				const serialized = xmlObjectToString(complexObj)
				const parser = new PartialXMLStreamParser({
					textNodeName: "#text",
					attributeNamePrefix: "@",
				})
				const parsed = parser.parseStream(serialized)
				const reserialized = xmlObjectToString(parsed.xml[0])

				expect(reserialized).toBe(serialized)
			})
		})

		describe("XML Entities Handling", () => {
			it("should properly escape and handle all XML entities", () => {
				const input = {
					test: {
						"@attr": "value with & < > \" ' entities",
						"#text": "Text with & < > \" ' entities",
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toContain('attr="value with & < > " \' entities"')
				expect(result).toContain("Text with & < > \" ' entities")
			})

			it("should handle numeric entities in round-trip", () => {
				const xmlWithNumericEntities = "<test>&#60;Hello&#x26;World&#62;</test>"
				const parser = new PartialXMLStreamParser({ textNodeName: "#text" })
				const parsed = parser.parseStream(xmlWithNumericEntities)
				const serialized = xmlObjectToString(parsed.xml[0])

				expect(serialized).toBe("<test><Hello&World></test>")
			})
		})

		describe("Self-closing Tags Simulation", () => {
			it("should handle empty objects as self-closing equivalent", () => {
				const input = {
					root: {
						empty1: {},
						empty2: {},
						withContent: "text",
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toBe("<root><empty1></empty1><empty2></empty2><withContent>text</withContent></root>")
			})

			it("should handle mixed empty and content elements", () => {
				const input = {
					form: {
						input: [
							{ "@type": "text", "@name": "username" },
							{ "@type": "password", "@name": "password" },
							{ "@type": "submit", "@value": "Login", "#text": "Submit" },
						],
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toContain('<input type="text" name="username"></input>')
				expect(result).toContain('<input type="password" name="password"></input>')
				expect(result).toContain('<input type="submit" value="Login">Submit</input>')
			})
		})

		describe("Complex Mixed Content", () => {
			it("should handle arrays of mixed text and elements", () => {
				const input = {
					paragraph: {
						"#text": [
							"Start text ",
							{ strong: "bold text" },
							" middle text ",
							{ em: "italic text" },
							" end text",
						],
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toBe(
					"<paragraph>Start text <strong>bold text</strong> middle text <em>italic text</em> end text</paragraph>",
				)
			})

			it("should handle deeply nested mixed content", () => {
				const input = {
					article: {
						"@id": "main",
						h1: "Title",
						"#text": "Introduction text",
						section: {
							h2: "Subtitle",
							p: [
								"First paragraph with ",
								{ a: { "@href": "link", "#text": "a link" } },
								" and more text.",
							],
						},
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toContain('<article id="main">')
				expect(result).toContain("<h1>Title</h1>")
				expect(result).toContain("Introduction text")
				expect(result).toContain('<a href="link">a link</a>')
			})
		})

		describe("Stop Nodes Simulation", () => {
			it("should handle script-like content preservation", () => {
				const input = {
					html: {
						head: { title: "Test" },
						body: {
							script: {
								"@type": "text/javascript",
								"#text": "function test() { return '<div>not parsed</div>'; }",
							},
						},
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toContain(
					"<script type=\"text/javascript\">function test() { return '<div>not parsed</div>'; }</script>",
				)
			})

			it("should preserve raw content with XML-like strings", () => {
				const input = {
					data: {
						raw: {
							"#text": "<item>not parsed</item><value>preserved</value>",
						},
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toBe("<data><raw><item>not parsed</item><value>preserved</value></raw></data>")
			})
		})

		describe("Multiple Root Elements", () => {
			it("should handle array of root elements", () => {
				const input = [
					{ thinking: "Planning the approach" },
					{ tool_use: { name: "read_file", args: { path: "test.js" } } },
					{ result: "File content here" },
				]
				const result = xmlObjectToString(input)
				expect(result).toBe(
					"<thinking>Planning the approach</thinking><tool_use><name>read_file</name><args><path>test.js</path></args></tool_use><result>File content here</result>",
				)
			})

			it("should handle mixed root content types", () => {
				const input = ["Text before", { element: "content" }, "Text after", { another: { "@attr": "value" } }]
				const result = xmlObjectToString(input)
				expect(result).toBe('Text before<element>content</element>Text after<another attr="value"></another>')
			})
		})

		describe("Streaming/Chunked Equivalent", () => {
			it("should produce same result as streaming parser would expect", () => {
				const streamingEquivalent = {
					read: {
						args: {
							file: {
								path: { "#text": "test.js" },
								line_range: { "#text": "1-100" },
							},
						},
					},
				}

				const result = xmlObjectToString(streamingEquivalent)
				const parser = new PartialXMLStreamParser({ textNodeName: "#text" })
				const parsed = parser.parseStream(result)

				expect(parsed.xml[0]).toEqual(streamingEquivalent)
				expect(parsed.metadata.partial).toBe(false)
			})

			it("should handle partial-like structures", () => {
				const partialStructure = {
					request: {
						id: { "#text": "123" },
						data: { "#text": "incomplete" },
					},
				}

				const result = xmlObjectToString(partialStructure)
				expect(result).toBe("<request><id>123</id><data>incomplete</data></request>")
			})
		})

		describe("Edge Cases and Special Characters", () => {
			it("should handle Unicode characters", () => {
				const input = {
					unicode: {
						"@title": "测试 🚀 émojis",
						"#text": "Content with 中文 and émojis 🎉",
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toBe('<unicode title="测试 🚀 émojis">Content with 中文 and émojis 🎉</unicode>')
			})

			it("should handle very long text content", () => {
				const longText = "a".repeat(10000)
				const input = { longContent: longText }
				const result = xmlObjectToString(input)
				expect(result).toBe(`<longContent>${longText}</longContent>`)
				expect(result.length).toBe(longText.length + 27) // tag overhead
			})

			it("should handle special XML-reserved tag names", () => {
				const input = {
					"xml-reserved": "content",
					"with-dashes": "more content",
					with_underscores: "even more",
				}
				const result = xmlObjectToString(input)
				expect(result).toContain("<xml-reserved>content</xml-reserved>")
				expect(result).toContain("<with-dashes>more content</with-dashes>")
				expect(result).toContain("<with_underscores>even more</with_underscores>")
			})
		})

		describe("Custom Options Comprehensive", () => {
			it("should work with all custom options combinations", () => {
				const input = {
					root: {
						_attr1: "value1",
						_attr2: "value2",
						textContent: "main text",
						child: {
							_childAttr: "childValue",
							textContent: "child text",
						},
					},
				}

				const options = {
					attributeNamePrefix: "_",
					textNodeName: "textContent",
				}

				const result = xmlObjectToString(input, options)
				expect(result).toBe(
					'<root attr1="value1" attr2="value2">main text<child childAttr="childValue">child text</child></root>',
				)
			})

			it("should handle empty prefix options", () => {
				const input = {
					tag: {
						attr: "value",
						text: "content",
					},
				}

				const options = {
					attributeNamePrefix: "",
					textNodeName: "text",
				}

				const result = xmlObjectToString(input, options)
				expect(result).toBe('<tag attr="value">content</tag>')
			})
		})

		describe("Performance/Stress Testing", () => {
			it("should handle deeply nested structures efficiently", () => {
				let deepStructure: Record<string, any> = { level0: {} }
				let current = deepStructure.level0

				for (let i = 1; i < 100; i++) {
					current[`level${i}`] = {}
					current = current[`level${i}`]
				}
				current["#text"] = "deep content"

				const start = Date.now()
				const result = xmlObjectToString(deepStructure)
				const duration = Date.now() - start

				expect(result).toContain("<level0><level1>")
				expect(result).toContain("deep content")
				expect(duration).toBeLessThan(1000) // Should complete within 1 second
			})

			it("should handle large arrays efficiently", () => {
				const largeArray = Array.from({ length: 1000 }, (_, i) => ({
					item: {
						"@id": i.toString(),
						"#text": `Item ${i}`,
					},
				}))

				const input = { container: { item: largeArray.map((item) => item.item) } }

				const start = Date.now()
				const result = xmlObjectToString(input)
				const duration = Date.now() - start

				expect(result).toContain('<item id="0">Item 0</item>')
				expect(result).toContain('<item id="999">Item 999</item>')
				expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
			})
		})

		describe("Whitespace and Formatting", () => {
			it("should preserve significant whitespace in text content", () => {
				const input = {
					pre: {
						"#text": "  line 1\n  line 2\n    indented\n",
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toBe("<pre>  line 1\n  line 2\n    indented\n</pre>")
			})

			it("should handle mixed whitespace scenarios", () => {
				const input = {
					mixed: {
						"#text": ["  start  ", { span: "  middle  " }, "  end  "],
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toBe("<mixed>  start  <span>  middle  </span>  end  </mixed>")
			})
		})

		describe("Array Handling Edge Cases", () => {
			it("should handle nested arrays correctly", () => {
				const input = {
					matrix: {
						row: [{ cell: ["A1", "A2", "A3"] }, { cell: ["B1", "B2", "B3"] }],
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toBe(
					"<matrix><row><cell>A1</cell><cell>A2</cell><cell>A3</cell></row><row><cell>B1</cell><cell>B2</cell><cell>B3</cell></row></matrix>",
				)
			})

			it("should handle arrays with mixed content types", () => {
				const input = [
					{ mixed: "string" },
					{ mixed: 42 },
					{ mixed: true },
					{ mixed: { element: "content" } },
					{ mixed: null },
					{ mixed: undefined },
				]
				const result = xmlObjectToString(input)
				expect(result).toBe(
					"<mixed>string</mixed><mixed>42</mixed><mixed>true</mixed><mixed><element>content</element></mixed><mixed></mixed><mixed></mixed>",
				)
			})
		})

		describe("Type Coercion and Edge Cases", () => {
			it("should handle various primitive types", () => {
				const input = {
					types: {
						string: "text",
						number: 42,
						boolean: true,
						zero: 0,
						emptyString: "",
						nullValue: null,
						undefinedValue: undefined,
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toContain("<string>text</string>")
				expect(result).toContain("<number>42</number>")
				expect(result).toContain("<boolean>true</boolean>")
				expect(result).toContain("<zero>0</zero>")
				expect(result).toContain("<emptyString></emptyString>")
				expect(result).toContain("<nullValue></nullValue>")
				expect(result).toContain("<undefinedValue></undefinedValue>")
			})

			it("should handle function and object edge cases", () => {
				const input = {
					edge: {
						date: new Date("2023-01-01").toISOString(),
						regex: /test/.toString(),
						array: [1, 2, 3],
					},
				}
				const result = xmlObjectToString(input)
				expect(result).toContain("<date>2023-01-01T00:00:00.000Z</date>")
				expect(result).toContain("<regex>/test/</regex>")
				expect(result).toContain("<array>1</array><array>2</array><array>3</array>")
			})
		})
	})
})
