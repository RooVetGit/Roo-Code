// npx vitest core/prompts/utils/__tests__/schemaCompressor.spec.ts

import { describe, it, expect } from "vitest"
import { jsonSchemaToXml } from "../schemaCompressor"

describe("schemaCompressor", () => {
	describe("jsonSchemaToXml", () => {
		it("should handle empty schema", () => {
			expect(jsonSchemaToXml(null)).toBe("<schema></schema>")
			expect(jsonSchemaToXml(undefined)).toBe("<schema></schema>")
			expect(jsonSchemaToXml({})).toBe("<schema></schema>")
			expect(jsonSchemaToXml({ properties: {} })).toBe("<schema></schema>")
		})

		it("should compress simple string parameter", () => {
			const schema = {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "The search query",
					},
				},
				required: ["query"],
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>query*:string</schema>")
		})

		it("should handle multiple parameters with different types", () => {
			const schema = {
				type: "object",
				properties: {
					topic: {
						type: "string",
						description: "The topic to search",
					},
					count: {
						type: "number",
						description: "Number of results",
					},
					include_examples: {
						type: "boolean",
						description: "Whether to include examples",
					},
				},
				required: ["topic", "count"],
			}

			expect(jsonSchemaToXml(schema)).toBe(
				"<schema>topic*:string, count*:number, include_examples?:boolean</schema>",
			)
		})

		it("should handle array types", () => {
			const schema = {
				type: "object",
				properties: {
					tech_stack: {
						type: "array",
						items: {
							type: "string",
						},
					},
					numbers: {
						type: "array",
						items: {
							type: "number",
						},
					},
				},
				required: ["tech_stack"],
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>tech_stack*:array[string], numbers?:array[number]</schema>")
		})

		it("should handle array schema at root level", () => {
			const schema = {
				type: "array",
				items: {
					type: "string",
				},
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>array[string]</schema>")
		})

		it("should handle nested array types", () => {
			const schema = {
				type: "object",
				properties: {
					matrix: {
						type: "array",
						items: {
							type: "array",
							items: {
								type: "number",
							},
						},
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>matrix?:array[array[number]]</schema>")
		})

		it("should handle enum types", () => {
			const schema = {
				type: "object",
				properties: {
					format: {
						type: "string",
						enum: ["json", "xml", "csv"],
					},
					size: {
						type: "string",
						enum: ["small", "medium", "large", "xlarge", "xxlarge"],
					},
				},
				required: ["format"],
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>format*:enum(json|xml|csv), size?:enum</schema>")
		})

		it("should escape XML special characters in enum values", () => {
			const schema = {
				type: "object",
				properties: {
					operator: {
						type: "string",
						enum: ["<", ">", "&", '"', "'"],
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>operator?:enum</schema>")
		})

		it("should escape XML special characters in property names", () => {
			const schema = {
				type: "object",
				properties: {
					"<script>alert('xss')</script>": {
						type: "string",
					},
					"user&admin": {
						type: "boolean",
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe(
				"<schema>&lt;script&gt;alert(&apos;xss&apos;)&lt;/script&gt;?:string, user&amp;admin?:boolean</schema>",
			)
		})

		it("should handle object types", () => {
			const schema = {
				type: "object",
				properties: {
					requirements: {
						type: "object",
						properties: {
							description: { type: "string" },
							scale: { type: "string" },
						},
					},
				},
				required: ["requirements"],
			}

			expect(jsonSchemaToXml(schema)).toBe(
				"<schema>requirements*:object{description:string,scale:string}</schema>",
			)
		})

		it("should handle complex nested object types", () => {
			const schema = {
				type: "object",
				properties: {
					config: {
						type: "object",
						properties: {
							nested1: { type: "string" },
							nested2: { type: "number" },
							nested3: { type: "boolean" },
						},
					},
				},
			}

			// Should simplify to just "object" when more than 2 properties
			expect(jsonSchemaToXml(schema)).toBe("<schema>config?:object</schema>")
		})

		it("should handle date and url formats", () => {
			const schema = {
				type: "object",
				properties: {
					created_date: {
						type: "string",
						format: "date",
					},
					website: {
						type: "string",
						format: "uri",
					},
					email: {
						type: "string",
						format: "email",
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>created_date?:date, website?:url, email?:email</schema>")
		})

		it("should handle additional string formats", () => {
			const schema = {
				type: "object",
				properties: {
					id: {
						type: "string",
						format: "uuid",
					},
					timestamp: {
						type: "string",
						format: "date-time",
					},
					ipv4: {
						type: "string",
						format: "ipv4",
					},
					ipv6: {
						type: "string",
						format: "ipv6",
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe(
				"<schema>id?:uuid, timestamp?:datetime, ipv4?:ipv4, ipv6?:ipv6</schema>",
			)
		})

		it("should handle null type", () => {
			const schema = {
				type: "object",
				properties: {
					nullable_field: {
						type: "null",
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>nullable_field?:null</schema>")
		})

		it("should handle oneOf/anyOf union types", () => {
			const schema = {
				type: "object",
				properties: {
					union_field: {
						oneOf: [{ type: "string" }, { type: "number" }],
					},
					any_field: {
						anyOf: [{ type: "boolean" }, { type: "null" }],
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>union_field?:string|number, any_field?:boolean|null</schema>")
		})

		it("should handle malformed schemas gracefully", () => {
			const malformedSchemas = [
				{ properties: { field: null } },
				{ properties: { field: "not an object" } },
				{ properties: { field: [] } },
				{ properties: { field: { type: [] } } },
			]

			malformedSchemas.forEach((schema) => {
				expect(() => jsonSchemaToXml(schema as any)).not.toThrow()
			})
		})

		it("should handle arrays without items", () => {
			const schema = {
				type: "object",
				properties: {
					empty_array: {
						type: "array",
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>empty_array?:array[any]</schema>")
		})

		it("should handle arrays with enum items", () => {
			const schema = {
				type: "object",
				properties: {
					roles: {
						type: "array",
						items: {
							enum: ["admin", "user", "guest"],
						},
					},
				},
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>roles?:array[enum(admin|user|guest)]</schema>")
		})
	})

	describe("real MCP server examples", () => {
		it("should compress google-ai-search-mcp tool schema", () => {
			const schema = {
				type: "object",
				properties: {
					topic: {
						type: "string",
						description: "The software/library/framework topic (e.g., 'React Router', 'Python requests').",
					},
					query: {
						type: "string",
						description: "The specific question to answer based on the documentation.",
					},
				},
				required: ["topic", "query"],
			}

			expect(jsonSchemaToXml(schema)).toBe("<schema>topic*:string, query*:string</schema>")
		})

		it("should compress context7-enhanced tool schema", () => {
			const schema = {
				type: "object",
				properties: {
					libraryName: {
						type: "string",
						description: "Library name to search for and retrieve a Context7-compatible library ID.",
					},
					sort: {
						type: "string",
						enum: ["trust_score", "last_updated", "snippets"],
						description: "Sort results by trust score, last updated date, or snippet count",
					},
					minTrustScore: {
						type: "number",
						description: "Filter results to only show libraries with trust score >= this value",
					},
					maxTrustScore: {
						type: "number",
						description: "Filter results to only show libraries with trust score <= this value",
					},
				},
				required: ["libraryName"],
			}

			expect(jsonSchemaToXml(schema)).toBe(
				"<schema>libraryName*:string, sort?:enum(trust_score|last_updated|snippets), minTrustScore?:number, maxTrustScore?:number</schema>",
			)
		})

		it("should handle complex real-world schema with nested structures", () => {
			const schema = {
				type: "object",
				properties: {
					method: {
						type: "string",
						enum: ["GET", "POST", "PUT", "DELETE"],
					},
					headers: {
						type: "object",
						properties: {
							"Content-Type": { type: "string" },
							Authorization: { type: "string" },
						},
					},
					body: {
						oneOf: [{ type: "string" }, { type: "object" }],
					},
					timeout: {
						type: "integer",
						description: "Request timeout in milliseconds",
					},
				},
				required: ["method"],
			}

			const result = jsonSchemaToXml(schema)
			// Enum with 4 values should be simplified to just "enum" based on ENUM_DISPLAY_THRESHOLD = 3
			expect(result).toContain("method*:enum")
			expect(result).toContain("headers?:object{Content-Type:string,Authorization:string}")
			expect(result).toContain("body?:string|object")
			expect(result).toContain("timeout?:number")
		})
	})
})
