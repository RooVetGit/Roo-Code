// npx vitest run src/__tests__/playwright-mcp-validation.test.ts

import * as yaml from "yaml"
import * as fs from "fs/promises"
import { mcpMarketplaceItemSchema, marketplaceItemSchema, type McpMarketplaceItem } from "../marketplace"

/**
 * Test suite for validating the corrected Playwright MCP template
 * against the Roo Code MCP marketplace schema requirements.
 * 
 * This validates:
 * - Schema compliance with mcpMarketplaceItemSchema
 * - Parameter structure and substitution logic
 * - Content JSON parsing and validation
 * - Installation methods (Node.js/NPM and Docker)
 * - Prerequisites format validation
 */
describe("Playwright MCP Template Validation", () => {
	let templateContent: string
	let parsedTemplate: any
	let playwrightMcpItem: any

	beforeEach(async () => {
		// Read the corrected template file
		templateContent = await fs.readFile("../../../../playwright-mcp-integration/playwright-mcp.yaml", "utf-8")
		parsedTemplate = yaml.parse(templateContent)
		
		// Extract the MCP item from the template
		expect(parsedTemplate.items).toBeDefined()
		expect(Array.isArray(parsedTemplate.items)).toBe(true)
		expect(parsedTemplate.items).toHaveLength(1)
		
		playwrightMcpItem = parsedTemplate.items[0]
	})

	describe("Schema Compliance", () => {
		it("should have valid basic structure", () => {
			expect(playwrightMcpItem).toBeDefined()
			expect(playwrightMcpItem.id).toBe("playwright-mcp")
			expect(playwrightMcpItem.type).toBe("mcp")
			expect(playwrightMcpItem.name).toBe("Playwright MCP")
			expect(playwrightMcpItem.description).toContain("MCP server providing Playwright browser automation")
		})

		it("should validate against mcpMarketplaceItemSchema", () => {
			const result = mcpMarketplaceItemSchema.safeParse(playwrightMcpItem)
			
			if (!result.success) {
				console.error("Validation errors:", result.error.errors)
			}
			
			expect(result.success).toBe(true)
		})

		it("should validate against the full marketplaceItemSchema with discriminated union", () => {
			const result = marketplaceItemSchema.safeParse(playwrightMcpItem)
			
			if (!result.success) {
				console.error("Full schema validation errors:", result.error.errors)
			}
			
			expect(result.success).toBe(true)
		})

		it("should have required fields", () => {
			expect(playwrightMcpItem.id).toBeDefined()
			expect(playwrightMcpItem.name).toBeDefined()
			expect(playwrightMcpItem.description).toBeDefined()
			expect(playwrightMcpItem.url).toBeDefined()
			expect(playwrightMcpItem.content).toBeDefined()
		})

		it("should have valid URL format", () => {
			expect(playwrightMcpItem.url).toBe("https://github.com/microsoft/playwright-mcp")
			expect(() => new URL(playwrightMcpItem.url)).not.toThrow()
		})

		it("should have valid author URL format", () => {
			if (playwrightMcpItem.authorUrl) {
				expect(() => new URL(playwrightMcpItem.authorUrl)).not.toThrow()
			}
		})
	})

	describe("Content Structure Validation", () => {
		it("should have content as array of installation methods", () => {
			expect(Array.isArray(playwrightMcpItem.content)).toBe(true)
			expect(playwrightMcpItem.content).toHaveLength(2)
		})

		it("should have Node.js/NPM installation method", () => {
			const nodeMethod = playwrightMcpItem.content.find((method: any) => method.name === "Node.js/NPM")
			expect(nodeMethod).toBeDefined()
			expect(nodeMethod.content).toBeDefined()
			expect(nodeMethod.parameters).toBeDefined()
			expect(nodeMethod.prerequisites).toBeDefined()
		})

		it("should have Docker installation method", () => {
			const dockerMethod = playwrightMcpItem.content.find((method: any) => method.name === "Docker")
			expect(dockerMethod).toBeDefined()
			expect(dockerMethod.content).toBeDefined()
			expect(dockerMethod.parameters).toBeDefined()
			expect(dockerMethod.prerequisites).toBeDefined()
		})

		/**
		 * Validates that each installation method's content field contains valid JSON
		 * that can be parsed and contains the required MCP server configuration structure
		 */
		it("should have valid JSON content for each installation method", () => {
			playwrightMcpItem.content.forEach((method: any) => {
				expect(() => {
					const parsed = JSON.parse(method.content)
					
					// Validate MCP server configuration structure
					expect(parsed.command).toBeDefined()
					expect(parsed.args).toBeDefined()
					expect(Array.isArray(parsed.args)).toBe(true)
					expect(parsed.env).toBeDefined()
					expect(typeof parsed.disabled).toBe("boolean")
					expect(Array.isArray(parsed.alwaysAllow)).toBe(true)
					expect(Array.isArray(parsed.disabledTools)).toBe(true)
				}).not.toThrow()
			})
		})
	})

	describe("Parameter Handling and Substitution", () => {
		it("should have valid parameter structure for Node.js method", () => {
			const nodeMethod = playwrightMcpItem.content.find((method: any) => method.name === "Node.js/NPM")
			
			expect(nodeMethod.parameters).toHaveLength(1)
			const param = nodeMethod.parameters[0]
			
			expect(param.name).toBe("Playwright MCP Server Path")
			expect(param.key).toBe("serverPath")
			expect(param.placeholder).toBe("/absolute/path/to/playwright-mcp/dist/server.js")
			expect(param.optional).toBe(false)
		})

		it("should have valid parameter structure for Docker method", () => {
			const dockerMethod = playwrightMcpItem.content.find((method: any) => method.name === "Docker")
			
			expect(dockerMethod.parameters).toHaveLength(1)
			const param = dockerMethod.parameters[0]
			
			expect(param.name).toBe("Docker Host")
			expect(param.key).toBe("dockerHost")
			expect(param.placeholder).toBe("127.0.0.1")
			expect(param.optional).toBe(true)
		})

		it("should contain parameter placeholders in content", () => {
			const nodeMethod = playwrightMcpItem.content.find((method: any) => method.name === "Node.js/NPM")
			expect(nodeMethod.content).toContain("{{serverPath}}")
			
			const dockerMethod = playwrightMcpItem.content.find((method: any) => method.name === "Docker")
			expect(dockerMethod.content).toContain("{{dockerHost}}")
		})

		it("should have global parameters section", () => {
			expect(playwrightMcpItem.parameters).toBeDefined()
			expect(Array.isArray(playwrightMcpItem.parameters)).toBe(true)
			expect(playwrightMcpItem.parameters).toHaveLength(1)
			
			const globalParam = playwrightMcpItem.parameters[0]
			expect(globalParam.name).toBe("Node.js Executable")
			expect(globalParam.key).toBe("nodePath")
			expect(globalParam.placeholder).toBe("/usr/local/bin/node")
			expect(globalParam.optional).toBe(true)
		})

		/**
		 * Tests parameter substitution logic by simulating how the marketplace
		 * would replace parameter placeholders with actual values
		 */
		it("should support parameter substitution simulation", () => {
			const nodeMethod = playwrightMcpItem.content.find((method: any) => method.name === "Node.js/NPM")
			const originalContent = nodeMethod.content
			
			// Simulate parameter substitution
			const testValues = {
				serverPath: "/home/user/playwright-mcp/dist/server.js"
			}
			
			let substitutedContent = originalContent
			Object.entries(testValues).forEach(([key, value]) => {
				substitutedContent = substitutedContent.replace(new RegExp(`{{${key}}}`, 'g'), value)
			})
			
			expect(substitutedContent).not.toContain("{{serverPath}}")
			expect(substitutedContent).toContain(testValues.serverPath)
			
			// Verify the substituted content is still valid JSON
			expect(() => JSON.parse(substitutedContent)).not.toThrow()
		})
	})

	describe("Installation Methods Validation", () => {
		describe("Node.js/NPM Method", () => {
			let nodeMethod: any

			beforeEach(() => {
				nodeMethod = playwrightMcpItem.content.find((method: any) => method.name === "Node.js/NPM")
			})

			it("should have proper command structure", () => {
				const config = JSON.parse(nodeMethod.content)
				expect(config.command).toBe("node")
				expect(config.args).toEqual(["{{serverPath}}"])
			})

			it("should have valid prerequisites", () => {
				expect(nodeMethod.prerequisites).toHaveLength(4)
				expect(nodeMethod.prerequisites).toContain("Node.js (>=18)")
				expect(nodeMethod.prerequisites).toContain("Git for cloning repository")
				expect(nodeMethod.prerequisites.some((p: string) => p.includes("git clone"))).toBe(true)
				expect(nodeMethod.prerequisites.some((p: string) => p.includes("npm install"))).toBe(true)
			})

			it("should have required serverPath parameter", () => {
				const serverPathParam = nodeMethod.parameters.find((p: any) => p.key === "serverPath")
				expect(serverPathParam).toBeDefined()
				expect(serverPathParam.optional).toBe(false)
				expect(serverPathParam.placeholder).toMatch(/\.js$/)
			})
		})

		describe("Docker Method", () => {
			let dockerMethod: any

			beforeEach(() => {
				dockerMethod = playwrightMcpItem.content.find((method: any) => method.name === "Docker")
			})

			it("should have proper command structure", () => {
				const config = JSON.parse(dockerMethod.content)
				expect(config.command).toBe("docker")
				expect(config.args).toEqual([
					"run", "--rm", "-p", "{{dockerHost}}:8080:8080", "mcp/playwright:latest"
				])
			})

			it("should have valid prerequisites", () => {
				expect(dockerMethod.prerequisites).toHaveLength(2)
				expect(dockerMethod.prerequisites).toContain("Docker installed and running")
				expect(dockerMethod.prerequisites.some((p: string) => p.includes("docker pull"))).toBe(true)
			})

			it("should have optional dockerHost parameter", () => {
				const dockerHostParam = dockerMethod.parameters.find((p: any) => p.key === "dockerHost")
				expect(dockerHostParam).toBeDefined()
				expect(dockerHostParam.optional).toBe(true)
				expect(dockerHostParam.placeholder).toBe("127.0.0.1")
			})
		})
	})

	describe("Prerequisites Format Validation", () => {
		it("should have prerequisites as string arrays", () => {
			playwrightMcpItem.content.forEach((method: any) => {
				expect(Array.isArray(method.prerequisites)).toBe(true)
				method.prerequisites.forEach((prereq: any) => {
					expect(typeof prereq).toBe("string")
					expect(prereq.length).toBeGreaterThan(0)
				})
			})
		})

		it("should have meaningful prerequisite descriptions", () => {
			const nodeMethod = playwrightMcpItem.content.find((method: any) => method.name === "Node.js/NPM")
			const nodePrereqs = nodeMethod.prerequisites
			
			expect(nodePrereqs.some((p: string) => p.includes("Node.js"))).toBe(true)
			expect(nodePrereqs.some((p: string) => p.includes("Git"))).toBe(true)
			expect(nodePrereqs.some((p: string) => p.includes("npm install"))).toBe(true)
			
			const dockerMethod = playwrightMcpItem.content.find((method: any) => method.name === "Docker")
			const dockerPrereqs = dockerMethod.prerequisites
			
			expect(dockerPrereqs.some((p: string) => p.includes("Docker"))).toBe(true)
			expect(dockerPrereqs.some((p: string) => p.includes("docker pull"))).toBe(true)
		})
	})

	describe("Tags and Metadata Validation", () => {
		it("should have appropriate tags", () => {
			expect(Array.isArray(playwrightMcpItem.tags)).toBe(true)
			expect(playwrightMcpItem.tags).toContain("automation")
			expect(playwrightMcpItem.tags).toContain("testing")
			expect(playwrightMcpItem.tags).toContain("browser")
			expect(playwrightMcpItem.tags).toContain("playwright")
		})

		it("should have valid author information", () => {
			expect(playwrightMcpItem.author).toBe("Microsoft")
			expect(playwrightMcpItem.authorUrl).toBe("https://github.com/microsoft/playwright-mcp")
		})
	})

	describe("Error Cases and Edge Cases", () => {
		it("should fail validation with missing required fields", () => {
			const invalidItem = { ...playwrightMcpItem }
			delete invalidItem.url
			
			const result = mcpMarketplaceItemSchema.safeParse(invalidItem)
			expect(result.success).toBe(false)
		})

		it("should fail validation with invalid URL", () => {
			const invalidItem = { ...playwrightMcpItem, url: "not-a-valid-url" }
			
			const result = mcpMarketplaceItemSchema.safeParse(invalidItem)
			expect(result.success).toBe(false)
		})

		it("should fail validation with invalid parameter structure", () => {
			const invalidItem = { ...playwrightMcpItem }
			invalidItem.content[0].parameters = [{ name: "Invalid", key: "" }] // Empty key should fail
			
			const result = mcpMarketplaceItemSchema.safeParse(invalidItem)
			expect(result.success).toBe(false)
		})

		it("should handle malformed JSON in content gracefully", () => {
			const invalidContent = playwrightMcpItem.content[0].content.replace("}", "") // Malformed JSON
			
			expect(() => JSON.parse(invalidContent)).toThrow()
		})
	})

	describe("Template Structure Consistency", () => {
		it("should follow existing MCP patterns found in codebase", () => {
			// Verify structure matches what the marketplace expects
			expect(playwrightMcpItem.type).toBe("mcp")
			expect(typeof playwrightMcpItem.content).toBe("object")
			expect(Array.isArray(playwrightMcpItem.content)).toBe(true)
			
			// Each content item should be an installation method
			playwrightMcpItem.content.forEach((method: any) => {
				expect(method.name).toBeDefined()
				expect(method.content).toBeDefined()
				expect(typeof method.content).toBe("string")
			})
		})

		it("should be compatible with RemoteConfigLoader expectations", () => {
			// The template should be parseable as YAML and validate against the schema
			// This simulates what RemoteConfigLoader.loadMcpMarketplace() does
			const yamlData = yaml.parse(templateContent)
			expect(yamlData.items).toBeDefined()
			expect(Array.isArray(yamlData.items)).toBe(true)
			
			yamlData.items.forEach((item: any) => {
				const result = marketplaceItemSchema.safeParse(item)
				expect(result.success).toBe(true)
			})
		})
	})
})