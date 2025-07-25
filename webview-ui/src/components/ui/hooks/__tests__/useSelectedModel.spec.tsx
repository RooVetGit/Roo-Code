// npx vitest run src/components/ui/hooks/__tests__/useSelectedModel.spec.ts

import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode } from "react"

import { useSelectedModel } from "../useSelectedModel"

// Mock the router models hooks
vi.mock("../useRouterModels", () => ({
	useRouterModels: () => ({
		data: {
			openrouter: {},
			requesty: {},
			glama: {},
			unbound: {},
			litellm: {},
			ollama: {},
			lmstudio: {},
		},
		isLoading: false,
		isError: false,
	}),
}))

vi.mock("../useOpenRouterModelProviders", () => ({
	useOpenRouterModelProviders: () => ({
		data: {},
		isLoading: false,
		isError: false,
	}),
}))

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	})
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	)
}

describe("useSelectedModel", () => {
	describe("vertex provider", () => {
		it("should return custom model when vertexCustomModelId is provided", () => {
			const { result } = renderHook(
				() =>
					useSelectedModel({
						apiProvider: "vertex",
						apiModelId: "claude-3-5-sonnet-v2@20241022",
						vertexCustomModelId: "claude-sonnet-4@20250514",
					}),
				{ wrapper: createWrapper() },
			)

			expect(result.current.id).toBe("claude-sonnet-4@20250514")
			expect(result.current.info).toBeDefined()
			expect(result.current.info?.maxTokens).toBe(8192) // Default model info
		})

		it("should trim whitespace from custom model ID", () => {
			const { result } = renderHook(
				() =>
					useSelectedModel({
						apiProvider: "vertex",
						apiModelId: "claude-3-5-sonnet-v2@20241022",
						vertexCustomModelId: "  claude-sonnet-4@20250514  ",
					}),
				{ wrapper: createWrapper() },
			)

			expect(result.current.id).toBe("claude-sonnet-4@20250514")
		})

		it("should fall back to predefined model when custom model is empty", () => {
			const { result } = renderHook(
				() =>
					useSelectedModel({
						apiProvider: "vertex",
						apiModelId: "claude-3-5-sonnet-v2@20241022",
						vertexCustomModelId: "",
					}),
				{ wrapper: createWrapper() },
			)

			expect(result.current.id).toBe("claude-3-5-sonnet-v2@20241022")
		})

		it("should fall back to predefined model when custom model is only whitespace", () => {
			const { result } = renderHook(
				() =>
					useSelectedModel({
						apiProvider: "vertex",
						apiModelId: "claude-3-5-sonnet-v2@20241022",
						vertexCustomModelId: "   ",
					}),
				{ wrapper: createWrapper() },
			)

			expect(result.current.id).toBe("claude-3-5-sonnet-v2@20241022")
		})

		it("should fall back to default model when no model is specified", () => {
			const { result } = renderHook(
				() =>
					useSelectedModel({
						apiProvider: "vertex",
					}),
				{ wrapper: createWrapper() },
			)

			expect(result.current.id).toBe("claude-sonnet-4@20250514") // Default vertex model
		})

		it("should prioritize custom model over predefined model", () => {
			const { result } = renderHook(
				() =>
					useSelectedModel({
						apiProvider: "vertex",
						apiModelId: "claude-3-5-sonnet-v2@20241022",
						vertexCustomModelId: "claude-sonnet-4@20250514",
					}),
				{ wrapper: createWrapper() },
			)

			expect(result.current.id).toBe("claude-sonnet-4@20250514")
			expect(result.current.id).not.toBe("claude-3-5-sonnet-v2@20241022")
		})

		it("should handle custom model without vertexCustomModelId field", () => {
			const { result } = renderHook(
				() =>
					useSelectedModel({
						apiProvider: "vertex",
						apiModelId: "claude-3-5-sonnet-v2@20241022",
					}),
				{ wrapper: createWrapper() },
			)

			expect(result.current.id).toBe("claude-3-5-sonnet-v2@20241022")
		})

		it("should use default model info for custom models", () => {
			const { result } = renderHook(
				() =>
					useSelectedModel({
						apiProvider: "vertex",
						apiModelId: "claude-3-5-sonnet-v2@20241022",
						vertexCustomModelId: "custom-model@latest",
					}),
				{ wrapper: createWrapper() },
			)

			expect(result.current.id).toBe("custom-model@latest")
			// Should use default model info as fallback
			expect(result.current.info?.maxTokens).toBe(8192)
			expect(result.current.info?.contextWindow).toBe(200_000)
			expect(result.current.info?.supportsImages).toBe(true)
			expect(result.current.info?.supportsPromptCache).toBe(true)
		})
	})
})
