import { describe, it, expect, beforeEach, vi } from "vitest"
import { createAxiosWrapper, isOnPremMode } from "../axios-wrapper"
import type { AxiosRequestConfig } from "axios"

// Mock axios
const mockAxios = {
	get: vi.fn(),
	post: vi.fn(),
	put: vi.fn(),
	delete: vi.fn(),
	patch: vi.fn(),
	request: vi.fn(),
}

describe("axios-wrapper", () => {
	beforeEach(() => {
		Object.values(mockAxios).forEach((mock) => mock.mockClear())
		delete process.env.ON_PREM
	})

	describe("createAxiosWrapper", () => {
		describe("when ON_PREM is false", () => {
			beforeEach(() => {
				process.env.ON_PREM = "false"
			})

			it("should pass through GET requests", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)
				mockAxios.get.mockResolvedValue({ data: "success" })

				await wrappedAxios.get("https://example.com/api")

				expect(mockAxios.get).toHaveBeenCalledWith("https://example.com/api", undefined)
			})

			it("should pass through POST requests with config", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)
				mockAxios.post.mockResolvedValue({ data: "created" })

				const config: AxiosRequestConfig = { timeout: 5000 }
				await wrappedAxios.post("https://example.com/api", { name: "test" }, config)

				expect(mockAxios.post).toHaveBeenCalledWith("https://example.com/api", { name: "test" }, config)
			})
		})

		describe("when ON_PREM is true", () => {
			beforeEach(() => {
				process.env.ON_PREM = "true"
			})

			it("should block external GET requests", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)

				await expect(wrappedAxios.get("https://api.external.com/data")).rejects.toThrow(
					"ON_PREM mode: External HTTP calls are disabled",
				)

				expect(mockAxios.get).not.toHaveBeenCalled()
			})

			it("should block external POST requests", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)

				await expect(wrappedAxios.post("https://api.external.com/data", { test: "data" })).rejects.toThrow(
					"ON_PREM mode: External HTTP calls are disabled",
				)

				expect(mockAxios.post).not.toHaveBeenCalled()
			})

			it("should allow localhost requests", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)
				mockAxios.get.mockResolvedValue({ data: "local success" })

				await wrappedAxios.get("http://localhost:8080/api")

				expect(mockAxios.get).toHaveBeenCalledWith("http://localhost:8080/api", undefined)
			})

			it("should allow internal server requests", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)
				mockAxios.get.mockResolvedValue({ data: "internal success" })

				await wrappedAxios.get("http://internal-server:3000/api")

				expect(mockAxios.get).toHaveBeenCalledWith("http://internal-server:3000/api", undefined)
			})

			it("should allow private IP requests", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)
				mockAxios.get.mockResolvedValue({ data: "private network" })

				await wrappedAxios.get("http://192.168.1.100:8080/api")

				expect(mockAxios.get).toHaveBeenCalledWith("http://192.168.1.100:8080/api", undefined)
			})

			it("should block Roo Code API calls", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)

				await expect(wrappedAxios.get("https://app.roocode.com/api/marketplace/modes")).rejects.toThrow(
					"ON_PREM mode: External HTTP calls are disabled",
				)

				expect(mockAxios.get).not.toHaveBeenCalled()
			})

			it("should block VS Code marketplace calls", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)

				await expect(
					wrappedAxios.post("https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery"),
				).rejects.toThrow("ON_PREM mode: External HTTP calls are disabled")

				expect(mockAxios.post).not.toHaveBeenCalled()
			})

			it("should block with custom error message", async () => {
				const customMessage = "Corporate firewall: External API access denied"
				const wrappedAxios = createAxiosWrapper(mockAxios as any, customMessage)

				await expect(wrappedAxios.get("https://external-api.com/data")).rejects.toThrow(customMessage)
			})

			it("should block request() method calls", async () => {
				const wrappedAxios = createAxiosWrapper(mockAxios as any)

				await expect(
					wrappedAxios.request({
						method: "GET",
						url: "https://external-api.com/data",
					}),
				).rejects.toThrow("ON_PREM mode: External HTTP calls are disabled")

				expect(mockAxios.request).not.toHaveBeenCalled()
			})

			describe("URL validation edge cases", () => {
				const wrappedAxios = () => createAxiosWrapper(mockAxios as any)

				const blockedUrls = [
					"https://app.roocode.com/api/marketplace/modes",
					"https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery",
					"https://api.anthropic.com/v1/messages",
					"https://openrouter.ai/api/v1/models",
					"http://external-service.example.com/api",
				]

				const allowedUrls = [
					"http://localhost:3000/api",
					"https://localhost:8443/secure",
					"http://127.0.0.1:8080/api",
					"http://vllm-server:1234/v1/chat/completions",
					"http://ollama-host:11434/api/generate",
					"http://10.0.1.100:8080/api", // Private IP
					"http://192.168.1.50:3000/api", // Private IP
					"http://172.16.0.10:8000/api", // Private IP
				]

				blockedUrls.forEach((url) => {
					it(`should block: ${url}`, async () => {
						await expect(wrappedAxios().get(url)).rejects.toThrow(
							"ON_PREM mode: External HTTP calls are disabled",
						)
					})
				})

				allowedUrls.forEach((url) => {
					it(`should allow: ${url}`, async () => {
						mockAxios.get.mockResolvedValue({ data: "success" })
						await wrappedAxios().get(url)
						expect(mockAxios.get).toHaveBeenCalledWith(url, undefined)
					})
				})
			})
		})
	})
})
