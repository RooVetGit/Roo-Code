import { describe, it, expect, beforeEach, vi } from "vitest"
import { createFetchWrapper, isOnPremMode } from "../fetch-wrapper"

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("fetch-wrapper", () => {
	beforeEach(() => {
		mockFetch.mockClear()
		delete process.env.ON_PREM
	})

	describe("isOnPremMode", () => {
		it("should return false when ON_PREM is not set", () => {
			expect(isOnPremMode()).toBe(false)
		})

		it("should return true when ON_PREM=true", () => {
			process.env.ON_PREM = "true"
			expect(isOnPremMode()).toBe(true)
		})

		it("should return false when ON_PREM=false", () => {
			process.env.ON_PREM = "false"
			expect(isOnPremMode()).toBe(false)
		})

		it("should return false when ON_PREM has invalid value", () => {
			process.env.ON_PREM = "invalid"
			expect(isOnPremMode()).toBe(false)
		})
	})

	describe("createFetchWrapper", () => {
		describe("when ON_PREM is false", () => {
			beforeEach(() => {
				process.env.ON_PREM = "false"
			})

			it("should pass through fetch calls", async () => {
				const wrappedFetch = createFetchWrapper(mockFetch)
				mockFetch.mockResolvedValue(new Response("success"))

				await wrappedFetch("https://example.com/api")

				expect(mockFetch).toHaveBeenCalledWith("https://example.com/api", undefined)
			})

			it("should pass through fetch calls with options", async () => {
				const wrappedFetch = createFetchWrapper(mockFetch)
				mockFetch.mockResolvedValue(new Response("success"))

				const options = { method: "POST", body: "data" }
				await wrappedFetch("https://example.com/api", options)

				expect(mockFetch).toHaveBeenCalledWith("https://example.com/api", options)
			})
		})

		describe("when ON_PREM is true", () => {
			beforeEach(() => {
				process.env.ON_PREM = "true"
			})

			it("should block external HTTP calls", async () => {
				const wrappedFetch = createFetchWrapper(mockFetch)

				await expect(wrappedFetch("https://external-api.com/data")).rejects.toThrow(
					"ON_PREM mode: External HTTP calls are disabled",
				)

				expect(mockFetch).not.toHaveBeenCalled()
			})

			it("should block external HTTPS calls", async () => {
				const wrappedFetch = createFetchWrapper(mockFetch)

				await expect(wrappedFetch("https://api.openai.com/v1/completions")).rejects.toThrow(
					"ON_PREM mode: External HTTP calls are disabled",
				)

				expect(mockFetch).not.toHaveBeenCalled()
			})

			it("should allow localhost calls", async () => {
				const wrappedFetch = createFetchWrapper(mockFetch)
				mockFetch.mockResolvedValue(new Response("local success"))

				await wrappedFetch("http://localhost:8080/api")

				expect(mockFetch).toHaveBeenCalledWith("http://localhost:8080/api", undefined)
			})

			it("should allow 127.0.0.1 calls", async () => {
				const wrappedFetch = createFetchWrapper(mockFetch)
				mockFetch.mockResolvedValue(new Response("local success"))

				await wrappedFetch("http://127.0.0.1:3000/api")

				expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:3000/api", undefined)
			})

			it("should allow relative URLs", async () => {
				const wrappedFetch = createFetchWrapper(mockFetch)
				mockFetch.mockResolvedValue(new Response("relative success"))

				await wrappedFetch("/api/local")

				expect(mockFetch).toHaveBeenCalledWith("/api/local", undefined)
			})

			it("should allow internal network calls", async () => {
				const wrappedFetch = createFetchWrapper(mockFetch)
				mockFetch.mockResolvedValue(new Response("internal success"))

				await wrappedFetch("http://internal-server:8080/api")

				expect(mockFetch).toHaveBeenCalledWith("http://internal-server:8080/api", undefined)
			})

			it("should block with custom error message", async () => {
				const customMessage = "Company policy: No external calls allowed"
				const wrappedFetch = createFetchWrapper(mockFetch, customMessage)

				await expect(wrappedFetch("https://external-api.com/data")).rejects.toThrow(customMessage)
			})
		})

		describe("URL validation", () => {
			beforeEach(() => {
				process.env.ON_PREM = "true"
			})

			const externalUrls = [
				"https://api.openai.com/v1/completions",
				"https://api.anthropic.com/v1/messages",
				"https://openrouter.ai/api/v1/models",
				"http://external-server.com/api",
				"https://us.i.posthog.com/capture",
			]

			const allowedUrls = [
				"http://localhost:3000/api",
				"https://localhost:8443/secure",
				"http://127.0.0.1:8080/api",
				"http://[::1]:3000/api", // IPv6 localhost
				"http://internal-llm:11434/api/generate", // Internal server
				"http://gpu-srv:1234/v1/chat/completions", // vLLM server
				"/api/local", // Relative URL
				"./relative/path", // Relative path
			]

			externalUrls.forEach((url) => {
				it(`should block external URL: ${url}`, async () => {
					const wrappedFetch = createFetchWrapper(mockFetch)

					await expect(wrappedFetch(url)).rejects.toThrow("ON_PREM mode: External HTTP calls are disabled")

					expect(mockFetch).not.toHaveBeenCalled()
				})
			})

			allowedUrls.forEach((url) => {
				it(`should allow internal URL: ${url}`, async () => {
					const wrappedFetch = createFetchWrapper(mockFetch)
					mockFetch.mockResolvedValue(new Response("success"))

					await wrappedFetch(url)

					expect(mockFetch).toHaveBeenCalledWith(url, undefined)
				})
			})
		})
	})
})
