import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest"
import * as vscode from "vscode"
import {
	getLocalLLMConfig,
	isOnPremModeEnabled,
	createLocalLLMProviderSettings,
	applyLocalLLMIfOnPrem,
	validateLocalLLMConnection,
	type LocalLLMConfig,
} from "../localLLMProvider"
import type { ProviderSettings } from "@roo-code/types"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
}))

// Mock fetch for connection validation
global.fetch = vi.fn()
const mockFetch = global.fetch as MockedFunction<typeof fetch>

describe("localLLMProvider", () => {
	const mockGetConfiguration = vi.mocked(vscode.workspace.getConfiguration)
	const mockConfig = {
		get: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockGetConfiguration.mockReturnValue(mockConfig as any)
		delete process.env.ON_PREM
	})

	describe("getLocalLLMConfig", () => {
		it("should return null when localLLM config is not set", () => {
			mockConfig.get.mockReturnValue(undefined)

			const result = getLocalLLMConfig()

			expect(result).toBeNull()
			expect(mockGetConfiguration).toHaveBeenCalledWith("roo-cline")
			expect(mockConfig.get).toHaveBeenCalledWith("localLLM")
		})

		it("should return null when localLLM type is missing", () => {
			mockConfig.get.mockReturnValue({
				url: "http://localhost:8000",
			})

			const result = getLocalLLMConfig()

			expect(result).toBeNull()
		})

		it("should return null when localLLM url is missing", () => {
			mockConfig.get.mockReturnValue({
				type: "vllm",
			})

			const result = getLocalLLMConfig()

			expect(result).toBeNull()
		})

		it("should return valid vLLM config", () => {
			const expectedConfig = {
				type: "vllm",
				url: "http://gpu-srv:8000",
				model: "llama-2-7b-chat",
				apiKey: "test-key",
			}
			mockConfig.get.mockReturnValue(expectedConfig)

			const result = getLocalLLMConfig()

			expect(result).toEqual(expectedConfig)
		})

		it("should return valid Ollama config without optional fields", () => {
			const configWithRequiredOnly = {
				type: "ollama",
				url: "http://localhost:11434",
			}
			mockConfig.get.mockReturnValue(configWithRequiredOnly)

			const result = getLocalLLMConfig()

			expect(result).toEqual({
				type: "ollama",
				url: "http://localhost:11434",
				model: undefined,
				apiKey: undefined,
			})
		})
	})

	describe("isOnPremModeEnabled", () => {
		it("should return false when ON_PREM is not set", () => {
			expect(isOnPremModeEnabled()).toBe(false)
		})

		it("should return true when ON_PREM=true", () => {
			process.env.ON_PREM = "true"
			expect(isOnPremModeEnabled()).toBe(true)
		})

		it("should return false when ON_PREM=false", () => {
			process.env.ON_PREM = "false"
			expect(isOnPremModeEnabled()).toBe(false)
		})

		it("should return false when ON_PREM has invalid value", () => {
			process.env.ON_PREM = "invalid"
			expect(isOnPremModeEnabled()).toBe(false)
		})
	})

	describe("createLocalLLMProviderSettings", () => {
		it("should create vLLM provider settings", () => {
			const localConfig: LocalLLMConfig = {
				type: "vllm",
				url: "http://gpu-srv:8000",
				model: "llama-2-13b-chat",
				apiKey: "vllm-key",
			}

			const result = createLocalLLMProviderSettings(localConfig)

			expect(result).toEqual({
				apiProvider: "vllm",
				apiKey: "vllm-key",
				vllmBaseUrl: "http://gpu-srv:8000",
				vllmModelId: "llama-2-13b-chat",
			})
		})

		it("should create vLLM settings with defaults", () => {
			const localConfig: LocalLLMConfig = {
				type: "vllm",
				url: "http://localhost:8000",
			}

			const result = createLocalLLMProviderSettings(localConfig)

			expect(result).toEqual({
				apiProvider: "vllm",
				apiKey: "",
				vllmBaseUrl: "http://localhost:8000",
				vllmModelId: "llama-2-7b-chat",
			})
		})

		it("should create Ollama provider settings", () => {
			const localConfig: LocalLLMConfig = {
				type: "ollama",
				url: "http://localhost:11434",
				model: "llama2:7b",
			}

			const result = createLocalLLMProviderSettings(localConfig)

			expect(result).toEqual({
				apiProvider: "ollama",
				apiKey: "",
				ollamaBaseUrl: "http://localhost:11434",
				ollamaModelId: "llama2:7b",
			})
		})

		it("should create Ollama settings with defaults", () => {
			const localConfig: LocalLLMConfig = {
				type: "ollama",
				url: "http://ollama-server:11434",
			}

			const result = createLocalLLMProviderSettings(localConfig)

			expect(result).toEqual({
				apiProvider: "ollama",
				apiKey: "",
				ollamaBaseUrl: "http://ollama-server:11434",
				ollamaModelId: "llama2",
			})
		})

		it("should merge with base settings", () => {
			const localConfig: LocalLLMConfig = {
				type: "vllm",
				url: "http://gpu-srv:8000",
				apiKey: "vllm-key",
			}

			const baseSettings: Partial<ProviderSettings> = {
				modelTemperature: 0.8,
				modelMaxTokens: 2048,
			}

			const result = createLocalLLMProviderSettings(localConfig, baseSettings)

			expect(result).toEqual({
				apiProvider: "vllm",
				apiKey: "vllm-key",
				vllmBaseUrl: "http://gpu-srv:8000",
				vllmModelId: "llama-2-7b-chat",
				modelTemperature: 0.8,
				modelMaxTokens: 2048,
			})
		})

		it("should throw error for unsupported LLM type", () => {
			const localConfig = {
				type: "unsupported",
				url: "http://localhost:8000",
			} as unknown as LocalLLMConfig

			expect(() => createLocalLLMProviderSettings(localConfig)).toThrow("Unsupported local LLM type: unsupported")
		})
	})

	describe("applyLocalLLMIfOnPrem", () => {
		const originalSettings: ProviderSettings = {
			apiProvider: "anthropic",
			apiKey: "claude-key",
			apiModelId: "claude-3-sonnet",
		}

		it("should return original settings when ON_PREM is false", () => {
			process.env.ON_PREM = "false"

			const result = applyLocalLLMIfOnPrem(originalSettings)

			expect(result).toBe(originalSettings)
		})

		it("should return original settings when ON_PREM is not set", () => {
			const result = applyLocalLLMIfOnPrem(originalSettings)

			expect(result).toBe(originalSettings)
		})

		it("should return original settings when localLLM config is missing", () => {
			process.env.ON_PREM = "true"
			mockConfig.get.mockReturnValue(null)

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const result = applyLocalLLMIfOnPrem(originalSettings)

			expect(result).toBe(originalSettings)
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("온프레미스 모드가 활성화되었지만 localLLM 설정이 없습니다"),
			)

			consoleSpy.mockRestore()
		})

		it("should apply vLLM settings when ON_PREM=true", () => {
			process.env.ON_PREM = "true"
			mockConfig.get.mockReturnValue({
				type: "vllm",
				url: "http://gpu-srv:8000",
				model: "llama-2-7b-chat",
				apiKey: "vllm-key",
			})

			const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {})

			const result = applyLocalLLMIfOnPrem(originalSettings)

			expect(result).toEqual({
				apiProvider: "vllm",
				apiKey: "vllm-key",
				vllmBaseUrl: "http://gpu-srv:8000",
				vllmModelId: "llama-2-7b-chat",
				apiModelId: "claude-3-sonnet", // preserved from original
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("로컬 LLM 제공자로 전환: vllm (http://gpu-srv:8000)"),
			)

			consoleSpy.mockRestore()
		})

		it("should handle errors in local LLM config conversion", () => {
			process.env.ON_PREM = "true"
			mockConfig.get.mockReturnValue({
				type: "invalid-type",
				url: "http://localhost:8000",
			})

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const result = applyLocalLLMIfOnPrem(originalSettings)

			expect(result).toBe(originalSettings)
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("로컬 LLM 설정 오류"))

			consoleSpy.mockRestore()
		})
	})

	describe("validateLocalLLMConnection", () => {
		beforeEach(() => {
			mockFetch.mockClear()
		})

		it("should validate vLLM connection successfully", async () => {
			const config: LocalLLMConfig = {
				type: "vllm",
				url: "http://gpu-srv:8000",
				apiKey: "vllm-key",
			}

			mockFetch.mockResolvedValue({
				ok: true,
			} as Response)

			const result = await validateLocalLLMConnection(config)

			expect(result).toBe(true)
			expect(mockFetch).toHaveBeenCalledWith(
				"http://gpu-srv:8000/v1/models",
				expect.objectContaining({
					method: "GET",
					headers: {
						Authorization: "Bearer vllm-key",
					},
					signal: expect.any(AbortSignal),
				}),
			)
		})

		it("should validate vLLM connection with /v1 suffix", async () => {
			const config: LocalLLMConfig = {
				type: "vllm",
				url: "http://gpu-srv:8000/v1",
			}

			mockFetch.mockResolvedValue({ ok: true } as Response)

			await validateLocalLLMConnection(config)

			expect(mockFetch).toHaveBeenCalledWith("http://gpu-srv:8000/v1/models", expect.any(Object))
		})

		it("should validate Ollama connection successfully", async () => {
			const config: LocalLLMConfig = {
				type: "ollama",
				url: "http://localhost:11434",
			}

			mockFetch.mockResolvedValue({ ok: true } as Response)

			const result = await validateLocalLLMConnection(config)

			expect(result).toBe(true)
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/tags",
				expect.objectContaining({
					method: "GET",
					signal: expect.any(AbortSignal),
				}),
			)
		})

		it("should validate Ollama connection with /api suffix", async () => {
			const config: LocalLLMConfig = {
				type: "ollama",
				url: "http://localhost:11434/api",
			}

			mockFetch.mockResolvedValue({ ok: true } as Response)

			await validateLocalLLMConnection(config)

			expect(mockFetch).toHaveBeenCalledWith("http://localhost:11434/api/tags", expect.any(Object))
		})

		it("should return false for failed connections", async () => {
			const config: LocalLLMConfig = {
				type: "vllm",
				url: "http://unreachable:8000",
			}

			mockFetch.mockResolvedValue({ ok: false } as Response)

			const result = await validateLocalLLMConnection(config)

			expect(result).toBe(false)
		})

		it("should return false for network errors", async () => {
			const config: LocalLLMConfig = {
				type: "ollama",
				url: "http://localhost:11434",
			}

			mockFetch.mockRejectedValue(new Error("Network error"))

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const result = await validateLocalLLMConnection(config)

			expect(result).toBe(false)
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("로컬 LLM 연결 확인 실패"))

			consoleSpy.mockRestore()
		})

		it("should return false for unsupported LLM types", async () => {
			const config = {
				type: "unsupported",
				url: "http://localhost:8000",
			} as unknown as LocalLLMConfig

			const result = await validateLocalLLMConnection(config)

			expect(result).toBe(false)
		})

		it("should include Authorization header when apiKey is provided", async () => {
			const config: LocalLLMConfig = {
				type: "vllm",
				url: "http://gpu-srv:8000",
				apiKey: "secret-key",
			}

			mockFetch.mockResolvedValue({ ok: true } as Response)

			await validateLocalLLMConnection(config)

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: {
						Authorization: "Bearer secret-key",
					},
				}),
			)
		})

		it("should not include Authorization header when apiKey is missing", async () => {
			const config: LocalLLMConfig = {
				type: "ollama",
				url: "http://localhost:11434",
			}

			mockFetch.mockResolvedValue({ ok: true } as Response)

			await validateLocalLLMConnection(config)

			const call = mockFetch.mock.calls[0]
			expect(call[1]).not.toHaveProperty("headers.Authorization")
		})
	})
})
