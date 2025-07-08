import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { OnPremTelemetryClient } from "../../../packages/telemetry/src/OnPremTelemetryClient"
import { createFetchWrapper, initializeOnPremMode } from "../../utils/fetch-wrapper"
import { applyLocalLLMIfOnPrem } from "../../utils/localLLMProvider"
import { TelemetryEventName } from "@roo-code/types"
import type { ProviderSettings } from "@roo-code/types"

/**
 * ON_PREM 모드 통합 테스트
 *
 * 다음을 확인합니다:
 * 1. 텔레메트리 완전 차단
 * 2. 외부 HTTP 호출 차단
 * 3. 로컬 LLM 자동 적용
 * 4. 내부/로컬 호출만 허용
 */
describe("ON_PREM Integration Tests", () => {
	let originalEnv: string | undefined
	let originalFetch: typeof global.fetch
	let mockFetch: ReturnType<typeof vi.fn>

	beforeEach(() => {
		originalEnv = process.env.ON_PREM
		originalFetch = global.fetch
		mockFetch = vi.fn()
		global.fetch = mockFetch

		// VS Code 설정 모킹
		vi.doMock("vscode", () => ({
			workspace: {
				getConfiguration: vi.fn(() => ({
					get: vi.fn(),
				})),
			},
		}))
	})

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.ON_PREM = originalEnv
		} else {
			delete process.env.ON_PREM
		}
		global.fetch = originalFetch
		vi.clearAllMocks()
	})

	describe("Full ON_PREM mode activation", () => {
		beforeEach(() => {
			process.env.ON_PREM = "true"
		})

		it("should block all telemetry in ON_PREM mode", async () => {
			const telemetryClient = new OnPremTelemetryClient(false) // production mode

			expect(telemetryClient.isTelemetryEnabled()).toBe(false)

			// 텔레메트리 호출이 무시되어야 함
			const result = await telemetryClient.capture({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskType: "code_analysis" },
			})

			expect(result).toBeUndefined()
		})

		it("should block external HTTP calls via fetch wrapper", async () => {
			const wrappedFetch = createFetchWrapper(mockFetch)

			// 외부 API 호출들이 차단되어야 함
			const externalCalls = [
				"https://api.openai.com/v1/completions",
				"https://api.anthropic.com/v1/messages",
				"https://openrouter.ai/api/v1/models",
				"https://us.i.posthog.com/capture",
				"https://api.github.com/repos/owner/repo",
			]

			for (const url of externalCalls) {
				await expect(wrappedFetch(url)).rejects.toThrow("ON_PREM mode: External HTTP calls are disabled")
			}

			expect(mockFetch).not.toHaveBeenCalled()
		})

		it("should allow internal/local HTTP calls", async () => {
			const wrappedFetch = createFetchWrapper(mockFetch)
			mockFetch.mockResolvedValue(new Response("success"))

			// 내부/로컬 호출들은 허용되어야 함
			const allowedCalls = [
				"http://localhost:8000/v1/chat/completions", // vLLM
				"http://127.0.0.1:11434/api/generate", // Ollama
				"http://gpu-srv:1234/v1/models", // 내부 서버
				"http://internal-llm:8080/api", // 내부 네트워크
				"/api/local/status", // 상대 경로
			]

			for (const url of allowedCalls) {
				await wrappedFetch(url)
				expect(mockFetch).toHaveBeenCalledWith(url, undefined)
				mockFetch.mockClear()
			}
		})

		it("should apply local LLM settings automatically", () => {
			// VS Code 설정 모킹
			const { workspace } = require("vscode")
			workspace.getConfiguration.mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === "localLLM") {
						return {
							type: "vllm",
							url: "http://gpu-srv:8000",
							model: "llama-2-13b-chat",
							apiKey: "local-key",
						}
					}
					return undefined
				}),
			})

			const originalSettings: ProviderSettings = {
				apiProvider: "anthropic",
				apiKey: "claude-key",
				apiModelId: "claude-3-sonnet",
			}

			const result = applyLocalLLMIfOnPrem(originalSettings)

			expect(result).toEqual({
				apiProvider: "vllm",
				apiKey: "local-key",
				vllmBaseUrl: "http://gpu-srv:8000",
				vllmModelId: "llama-2-13b-chat",
				apiModelId: "claude-3-sonnet", // 보존됨
			})
		})

		it("should initialize global fetch wrapper in ON_PREM mode", () => {
			// 실제 global fetch 교체 시뮬레이션
			const originalGlobalFetch = globalThis.fetch

			initializeOnPremMode()

			// global fetch가 교체되었는지 확인
			expect(globalThis.fetch).not.toBe(originalGlobalFetch)

			// 복원
			globalThis.fetch = originalGlobalFetch
		})
	})

	describe("Mixed scenarios", () => {
		it("should gracefully handle missing local LLM config in ON_PREM mode", () => {
			process.env.ON_PREM = "true"

			// VS Code 설정에 localLLM 없음
			const { workspace } = require("vscode")
			workspace.getConfiguration.mockReturnValue({
				get: vi.fn(() => null),
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const originalSettings: ProviderSettings = {
				apiProvider: "anthropic",
				apiKey: "claude-key",
			}

			const result = applyLocalLLMIfOnPrem(originalSettings)

			expect(result).toBe(originalSettings) // 원본 설정 유지
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("온프레미스 모드가 활성화되었지만 localLLM 설정이 없습니다"),
			)

			consoleSpy.mockRestore()
		})

		it("should work normally when ON_PREM is disabled", () => {
			process.env.ON_PREM = "false"

			// 텔레메트리 활성화
			const telemetryClient = new OnPremTelemetryClient(true)
			expect(telemetryClient.isTelemetryEnabled()).toBe(true)

			// 외부 호출 허용
			const wrappedFetch = createFetchWrapper(mockFetch)
			mockFetch.mockResolvedValue(new Response("success"))

			wrappedFetch("https://api.openai.com/v1/models")
			expect(mockFetch).toHaveBeenCalledWith("https://api.openai.com/v1/models", undefined)

			// 로컬 LLM 설정 적용 안됨
			const originalSettings: ProviderSettings = {
				apiProvider: "anthropic",
				apiKey: "claude-key",
			}

			const result = applyLocalLLMIfOnPrem(originalSettings)
			expect(result).toBe(originalSettings)
		})
	})

	describe("Error handling and edge cases", () => {
		beforeEach(() => {
			process.env.ON_PREM = "true"
		})

		it("should handle invalid URLs gracefully", async () => {
			const wrappedFetch = createFetchWrapper(mockFetch)
			mockFetch.mockResolvedValue(new Response("success"))

			// 잘못된 URL 형식들이 안전하게 처리되어야 함
			const urls = ["not-a-url", "ftp://example.com/file", "../relative/path", ""]

			for (const url of urls) {
				// 상대 경로나 비HTTP URL들은 통과시켜야 함
				await wrappedFetch(url)
				expect(mockFetch).toHaveBeenCalledWith(url, undefined)
				mockFetch.mockClear()
			}
		})

		it("should handle network failures appropriately", async () => {
			const wrappedFetch = createFetchWrapper(mockFetch)
			mockFetch.mockRejectedValue(new Error("Network timeout"))

			// 내부 호출의 네트워크 실패는 그대로 전파되어야 함
			await expect(wrappedFetch("http://localhost:8000/api")).rejects.toThrow("Network timeout")
		})

		it("should preserve original fetch behavior for allowed URLs", async () => {
			const wrappedFetch = createFetchWrapper(mockFetch)
			const mockResponse = new Response("local api response")
			mockFetch.mockResolvedValue(mockResponse)

			const options = {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ test: "data" }),
			}

			const result = await wrappedFetch("http://localhost:3000/api", options)

			expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api", options)
			expect(result).toBe(mockResponse)
		})
	})

	describe("Real-world scenarios", () => {
		beforeEach(() => {
			process.env.ON_PREM = "true"
		})

		it("should simulate complete vLLM setup", async () => {
			// vLLM 설정
			const { workspace } = require("vscode")
			workspace.getConfiguration.mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === "localLLM") {
						return {
							type: "vllm",
							url: "http://gpu-srv:8000",
							model: "llama-2-7b-chat",
						}
					}
					return undefined
				}),
			})

			// 설정 적용
			const originalSettings: ProviderSettings = {
				apiProvider: "anthropic",
				apiKey: "external-key",
			}

			const localSettings = applyLocalLLMIfOnPrem(originalSettings)
			expect(localSettings.apiProvider).toBe("vllm")
			expect(localSettings.vllmBaseUrl).toBe("http://gpu-srv:8000")

			// vLLM 서버로의 호출 허용 확인
			const wrappedFetch = createFetchWrapper(mockFetch)
			mockFetch.mockResolvedValue(
				new Response(
					JSON.stringify({
						data: [{ id: "llama-2-7b-chat" }],
					}),
				),
			)

			await wrappedFetch("http://gpu-srv:8000/v1/models")
			expect(mockFetch).toHaveBeenCalledWith("http://gpu-srv:8000/v1/models", undefined)

			// 외부 API 호출은 여전히 차단
			await expect(wrappedFetch("https://api.anthropic.com/v1/messages")).rejects.toThrow(
				"ON_PREM mode: External HTTP calls are disabled",
			)
		})

		it("should simulate complete Ollama setup", async () => {
			// Ollama 설정
			const { workspace } = require("vscode")
			workspace.getConfiguration.mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === "localLLM") {
						return {
							type: "ollama",
							url: "http://localhost:11434",
							model: "llama2:13b",
						}
					}
					return undefined
				}),
			})

			const localSettings = applyLocalLLMIfOnPrem({
				apiProvider: "openai",
				apiKey: "openai-key",
			})

			expect(localSettings).toEqual({
				apiProvider: "ollama",
				apiKey: "",
				ollamaBaseUrl: "http://localhost:11434",
				ollamaModelId: "llama2:13b",
			})

			// Ollama API 호출 허용 확인
			const wrappedFetch = createFetchWrapper(mockFetch)
			mockFetch.mockResolvedValue(
				new Response(
					JSON.stringify({
						models: [{ name: "llama2:13b" }],
					}),
				),
			)

			await wrappedFetch("http://localhost:11434/api/tags")
			expect(mockFetch).toHaveBeenCalledWith("http://localhost:11434/api/tags", undefined)
		})
	})
})
