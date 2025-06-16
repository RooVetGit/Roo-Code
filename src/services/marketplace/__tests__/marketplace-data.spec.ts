import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { modeMarketplaceItemSchema, mcpMarketplaceItemSchema } from "@roo-code/types"

describe("Marketplace Data Validation", () => {
	const marketplaceDir = path.join(__dirname, "../../../../marketplace")

	describe("MCP Servers Configuration", () => {
		it("should have valid mcps.yml file", async () => {
			const mcpsPath = path.join(marketplaceDir, "mcps.yml")
			const content = await fs.readFile(mcpsPath, "utf-8")
			const data = yaml.parse(content)

			expect(data).toHaveProperty("items")
			expect(Array.isArray(data.items)).toBe(true)
		})

		it("should validate all MCP items against schema", async () => {
			const mcpsPath = path.join(marketplaceDir, "mcps.yml")
			const content = await fs.readFile(mcpsPath, "utf-8")
			const data = yaml.parse(content)

			for (const item of data.items) {
				expect(() => mcpMarketplaceItemSchema.parse(item)).not.toThrow()
			}
		})

		it("should contain Daft.ie MCP server", async () => {
			const mcpsPath = path.join(marketplaceDir, "mcps.yml")
			const content = await fs.readFile(mcpsPath, "utf-8")
			const data = yaml.parse(content)

			const daftieServer = data.items.find((item: any) => item.id === "daft-ie-mcp")
			expect(daftieServer).toBeDefined()
			expect(daftieServer.name).toBe("Daft.ie MCP Server")
			expect(daftieServer.author).toBe("amineremache")
			expect(daftieServer.url).toBe("https://github.com/amineremache/daft-ie-mcp")
			expect(daftieServer.tags).toContain("ireland")
			expect(daftieServer.tags).toContain("rental")
			expect(daftieServer.tags).toContain("property")
		})

		it("should have valid installation methods for Daft.ie MCP", async () => {
			const mcpsPath = path.join(marketplaceDir, "mcps.yml")
			const content = await fs.readFile(mcpsPath, "utf-8")
			const data = yaml.parse(content)

			const daftieServer = data.items.find((item: any) => item.id === "daft-ie-mcp")
			expect(daftieServer.content).toBeDefined()
			expect(Array.isArray(daftieServer.content)).toBe(true)
			expect(daftieServer.content.length).toBeGreaterThan(0)

			// Check NPM installation method
			const npmMethod = daftieServer.content.find((method: any) => method.name === "NPM Installation")
			expect(npmMethod).toBeDefined()
			expect(npmMethod.content).toContain("daft-ie")
			expect(npmMethod.content).toContain("npx")

			// Check local development method
			const localMethod = daftieServer.content.find((method: any) => method.name === "Local Development")
			expect(localMethod).toBeDefined()
			expect(localMethod.parameters).toBeDefined()
			expect(localMethod.parameters.length).toBeGreaterThan(0)
		})
	})

	describe("Modes Configuration", () => {
		it("should have valid modes.yml file", async () => {
			const modesPath = path.join(marketplaceDir, "modes.yml")
			const content = await fs.readFile(modesPath, "utf-8")
			const data = yaml.parse(content)

			expect(data).toHaveProperty("items")
			expect(Array.isArray(data.items)).toBe(true)
		})

		it("should validate all mode items against schema", async () => {
			const modesPath = path.join(marketplaceDir, "modes.yml")
			const content = await fs.readFile(modesPath, "utf-8")
			const data = yaml.parse(content)

			for (const item of data.items) {
				expect(() => modeMarketplaceItemSchema.parse(item)).not.toThrow()
			}
		})

		it("should contain Property Search mode", async () => {
			const modesPath = path.join(marketplaceDir, "modes.yml")
			const content = await fs.readFile(modesPath, "utf-8")
			const data = yaml.parse(content)

			const propertyMode = data.items.find((item: any) => item.id === "property-search-mode")
			expect(propertyMode).toBeDefined()
			expect(propertyMode.name).toBe("Property Search Mode")
			expect(propertyMode.tags).toContain("property")
			expect(propertyMode.tags).toContain("rental")
			expect(propertyMode.tags).toContain("ireland")
			expect(propertyMode.prerequisites).toContain("Daft.ie MCP Server")
		})

		it("should have valid mode content structure", async () => {
			const modesPath = path.join(marketplaceDir, "modes.yml")
			const content = await fs.readFile(modesPath, "utf-8")
			const data = yaml.parse(content)

			const propertyMode = data.items.find((item: any) => item.id === "property-search-mode")
			expect(propertyMode.content).toBeDefined()
			expect(propertyMode.content).toContain("name:")
			expect(propertyMode.content).toContain("slug:")
			expect(propertyMode.content).toContain("description:")
			expect(propertyMode.content).toContain("instructions:")
		})
	})

	describe("Cross-references", () => {
		it("should have matching tags between related MCP and mode", async () => {
			const mcpsPath = path.join(marketplaceDir, "mcps.yml")
			const modesPath = path.join(marketplaceDir, "modes.yml")

			const mcpsContent = await fs.readFile(mcpsPath, "utf-8")
			const modesContent = await fs.readFile(modesPath, "utf-8")

			const mcpsData = yaml.parse(mcpsContent)
			const modesData = yaml.parse(modesContent)

			const daftieServer = mcpsData.items.find((item: any) => item.id === "daft-ie-mcp")
			const propertyMode = modesData.items.find((item: any) => item.id === "property-search-mode")

			// Check that they share common tags
			const commonTags = ["property", "rental", "ireland"]
			for (const tag of commonTags) {
				expect(daftieServer.tags).toContain(tag)
				expect(propertyMode.tags).toContain(tag)
			}
		})
	})
})
