import * as vscode from "vscode"
import { createSafeContentUri, MAX_SAFE_URI_LENGTH } from "../uri"

// Mock vscode.Uri to avoid VS Code dependency in tests
jest.mock("vscode", () => ({
	Uri: {
		parse: jest.fn((uriString: string) => ({
			toString: () => uriString,
			with: jest.fn(({ query }: { query: string }) => ({
				toString: () => `${uriString}?${query}`,
				scheme: uriString.split(":")[0],
				path: uriString.split(":")[1],
				query,
			})),
		})),
	},
}))

describe("uri utilities", () => {
	describe("createSafeContentUri", () => {
		const scheme = "test-scheme"
		const path = "test-file.txt"

		beforeEach(() => {
			jest.clearAllMocks()
		})

		it("should create a normal URI for small content", () => {
			const content = "small content"
			const result = createSafeContentUri(scheme, path, content)

			expect(vscode.Uri.parse).toHaveBeenCalledWith(`${scheme}:${path}`)
			expect(result.query).toBe(Buffer.from(content).toString("base64"))
		})

		it("should truncate content when URI would exceed safe length", () => {
			// Create content that would result in a very long URI
			const longContent = "x".repeat(10000) // 10KB of content
			const result = createSafeContentUri(scheme, path, longContent)

			// Verify the URI was created
			expect(vscode.Uri.parse).toHaveBeenCalledWith(`${scheme}:${path}`)

			// Decode the base64 query to check if content was truncated
			const decodedContent = Buffer.from(result.query, "base64").toString()
			expect(decodedContent).toContain("... [Content truncated to prevent LSP crashes]")
			expect(decodedContent.length).toBeLessThan(longContent.length)

			// Verify the total URI length is within safe limits
			const totalUriLength = result.toString().length
			expect(totalUriLength).toBeLessThanOrEqual(MAX_SAFE_URI_LENGTH)
		})

		it("should handle empty content", () => {
			const content = ""
			const result = createSafeContentUri(scheme, path, content)

			expect(result.query).toBe(Buffer.from(content).toString("base64"))
		})

		it("should handle content exactly at the safe limit", () => {
			// Calculate content size that would result in URI exactly at limit
			const baseUri = `${scheme}:${path}`
			const overhead = baseUri.length + 50
			const maxBase64Length = MAX_SAFE_URI_LENGTH - overhead
			const maxContentLength = Math.floor((maxBase64Length * 3) / 4)

			const content = "x".repeat(maxContentLength)
			const result = createSafeContentUri(scheme, path, content)

			const totalUriLength = result.toString().length
			expect(totalUriLength).toBeLessThanOrEqual(MAX_SAFE_URI_LENGTH)
		})

		it("should handle invalid characters gracefully", () => {
			// Test with potentially problematic content that might cause issues
			const problemContent = "\uFFFE\uFFFF\x00\x01\x02"
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

			const result = createSafeContentUri(scheme, path, problemContent)

			// Should still create a valid URI (may log error but shouldn't crash)
			expect(result).toBeDefined()
			expect(result.query).toBeDefined()

			consoleErrorSpy.mockRestore()
		})

		it("should use provided scheme and path correctly", () => {
			const customScheme = "cline-diff"
			const customPath = "src/components/Button.tsx"
			const content = "test content"

			createSafeContentUri(customScheme, customPath, content)

			expect(vscode.Uri.parse).toHaveBeenCalledWith(`${customScheme}:${customPath}`)
		})

		it("should preserve content when within safe limits", () => {
			const content = "This is some test content that should not be truncated"
			const result = createSafeContentUri(scheme, path, content)

			const decodedContent = Buffer.from(result.query, "base64").toString()
			expect(decodedContent).toBe(content)
			expect(decodedContent).not.toContain("... [Content truncated to prevent LSP crashes]")
		})

		it("should calculate base64 expansion correctly", () => {
			// Base64 encoding expands content by ~4/3
			const content = "x".repeat(1000)
			const base64Content = Buffer.from(content).toString("base64")

			// Verify our calculation assumption
			expect(base64Content.length).toBeCloseTo((content.length * 4) / 3, -1) // Within 10%
		})
	})

	describe("MAX_SAFE_URI_LENGTH constant", () => {
		it("should be set to a reasonable value", () => {
			expect(MAX_SAFE_URI_LENGTH).toBe(8192)
			expect(MAX_SAFE_URI_LENGTH).toBeGreaterThan(2000) // Above minimum
			expect(MAX_SAFE_URI_LENGTH).toBeLessThan(32768) // Below typical maximum
		})
	})
})
