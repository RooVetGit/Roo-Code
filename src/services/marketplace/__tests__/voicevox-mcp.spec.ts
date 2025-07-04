import { describe, test, expect, beforeEach, vi } from "vitest"
import nock from "nock"
import { RemoteConfigLoader } from "../RemoteConfigLoader"
import type { MarketplaceItem, McpMarketplaceItem } from "@roo-code/types"

describe("VoiceVox MCP Server", () => {
	let configLoader: RemoteConfigLoader

	beforeEach(() => {
		// Mock all remote API calls to force fallback to local data
		nock("https://app.roocode.com").get("/api/marketplace/modes").reply(500, "Service unavailable").persist()

		nock("https://app.roocode.com").get("/api/marketplace/mcps").reply(500, "Service unavailable").persist()

		configLoader = new RemoteConfigLoader()
	})

	test("should load VoiceVox MCP server from marketplace data", async () => {
		const items = await configLoader.loadAllItems()
		const voiceVoxItem = items.find((item) => item.id === "voicevox-tts")

		expect(voiceVoxItem).toBeDefined()
		expect(voiceVoxItem?.type).toBe("mcp")
		expect(voiceVoxItem?.name).toBe("VoiceVox Text-to-Speech Server")
		expect(voiceVoxItem?.author).toBe("Sunwood AI Labs")

		// Type assertion for MCP item to access url property
		const mcpItem = voiceVoxItem as McpMarketplaceItem & { type: "mcp" }
		expect(mcpItem?.url).toBe("https://github.com/Sunwood-ai-labs/mcp-voicevox")
	})

	test("should have correct tags for VoiceVox MCP server", async () => {
		const items = await configLoader.loadAllItems()
		const voiceVoxItem = items.find((item) => item.id === "voicevox-tts")

		expect(voiceVoxItem?.tags).toContain("text-to-speech")
		expect(voiceVoxItem?.tags).toContain("japanese")
		expect(voiceVoxItem?.tags).toContain("audio")
		expect(voiceVoxItem?.tags).toContain("voice")
		expect(voiceVoxItem?.tags).toContain("accessibility")
		expect(voiceVoxItem?.tags).toContain("content-creation")
	})

	test("should have multiple installation methods", async () => {
		const items = await configLoader.loadAllItems()
		const voiceVoxItem = items.find((item) => item.id === "voicevox-tts")

		expect(voiceVoxItem).toBeDefined()

		// Type assertion for MCP item
		const mcpItem = voiceVoxItem as McpMarketplaceItem & { type: "mcp" }
		expect(Array.isArray(mcpItem.content)).toBe(true)

		const content = mcpItem.content as any[]
		expect(content).toHaveLength(3)

		// Check installation method names
		const methodNames = content.map((method) => method.name)
		expect(methodNames).toContain("uvx (Recommended)")
		expect(methodNames).toContain("pip install")
		expect(methodNames).toContain("Custom Configuration")
	})

	test("should have correct prerequisites", async () => {
		const items = await configLoader.loadAllItems()
		const voiceVoxItem = items.find((item) => item.id === "voicevox-tts")

		expect(voiceVoxItem?.prerequisites).toContain("VoiceVox Engine running (locally or remotely)")
		expect(voiceVoxItem?.prerequisites).toContain("Python 3.10+")
	})

	test("should have parameters for custom configuration", async () => {
		const items = await configLoader.loadAllItems()
		const voiceVoxItem = items.find((item) => item.id === "voicevox-tts")

		expect(voiceVoxItem).toBeDefined()

		// Type assertion for MCP item
		const mcpItem = voiceVoxItem as McpMarketplaceItem & { type: "mcp" }
		const content = mcpItem.content as any[]
		const customConfig = content.find((method) => method.name === "Custom Configuration")

		expect(customConfig).toBeDefined()
		expect(customConfig.parameters).toBeDefined()
		expect(customConfig.parameters).toHaveLength(3)

		const parameterKeys = customConfig.parameters.map((param: any) => param.key)
		expect(parameterKeys).toContain("voicevox-url")
		expect(parameterKeys).toContain("default-speaker")
		expect(parameterKeys).toContain("speed")
	})

	test("should be retrievable by ID and type", async () => {
		const voiceVoxItem = await configLoader.getItem("voicevox-tts", "mcp")

		expect(voiceVoxItem).toBeDefined()
		expect(voiceVoxItem?.id).toBe("voicevox-tts")
		expect(voiceVoxItem?.type).toBe("mcp")
	})

	test("should have valid JSON configuration content", async () => {
		const items = await configLoader.loadAllItems()
		const voiceVoxItem = items.find((item) => item.id === "voicevox-tts")

		expect(voiceVoxItem).toBeDefined()

		// Type assertion for MCP item
		const mcpItem = voiceVoxItem as McpMarketplaceItem & { type: "mcp" }
		const content = mcpItem.content as any[]

		for (const method of content) {
			expect(() => {
				JSON.parse(method.content)
			}).not.toThrow()

			const config = JSON.parse(method.content)
			expect(config.voicevox).toBeDefined()
			expect(config.voicevox.command).toBeDefined()
			expect(config.voicevox.args).toBeDefined()
			expect(Array.isArray(config.voicevox.args)).toBe(true)
		}
	})
})
