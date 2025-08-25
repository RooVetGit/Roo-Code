import { describe, it, expect, vi } from "vitest"
import { QwenCodeHandler } from "../qwen-code"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock fs
vi.mock("fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}))

// Mock os
vi.mock("os", () => ({
	homedir: () => "/home/user",
}))

// Mock path
vi.mock("path", () => ({
	resolve: vi.fn((...args) => args.join("/")),
	join: vi.fn((...args) => args.join("/")),
}))

describe("QwenCodeHandler", () => {
	it("should initialize with correct model configuration", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "qwen3-coder-plus",
		}
		const handler = new QwenCodeHandler(options)

		const model = handler.getModel()
		expect(model.id).toBe("qwen3-coder-plus")
		expect(model.info).toBeDefined()
		expect(model.info?.supportsPromptCache).toBe(false)
	})

	it("should use default model when none specified", () => {
		const options: ApiHandlerOptions = {}
		const handler = new QwenCodeHandler(options)

		const model = handler.getModel()
		expect(model.id).toBe("qwen3-coder-plus") // default model
		expect(model.info).toBeDefined()
	})

	it("should use custom oauth path when provided", () => {
		const customPath = "/custom/path/oauth.json"
		const options: ApiHandlerOptions = {
			qwenCodeOAuthPath: customPath,
		}
		const handler = new QwenCodeHandler(options)

		// Handler should initialize without throwing
		expect(handler).toBeDefined()
	})
})
