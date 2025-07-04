import { describe, it, expect, vi } from "vitest"
import path from "path"
import { generateNormalizedAbsolutePath, generateRelativeFilePath } from "../get-relative-path"

// Mock the getWorkspacePath function
vi.mock("../../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/default/workspace"),
}))

describe("get-relative-path", () => {
	describe("generateNormalizedAbsolutePath", () => {
		it("should use provided workspace root", () => {
			const filePath = "src/file.ts"
			const workspaceRoot = "/custom/workspace"
			const result = generateNormalizedAbsolutePath(filePath, workspaceRoot)
			expect(result).toBe(path.normalize("/custom/workspace/src/file.ts"))
		})

		it("should fall back to getWorkspacePath when no workspace root provided", () => {
			const filePath = "src/file.ts"
			const result = generateNormalizedAbsolutePath(filePath)
			expect(result).toBe(path.normalize("/default/workspace/src/file.ts"))
		})

		it("should handle absolute paths", () => {
			const filePath = "/absolute/path/file.ts"
			const workspaceRoot = "/custom/workspace"
			const result = generateNormalizedAbsolutePath(filePath, workspaceRoot)
			expect(result).toBe(path.normalize("/absolute/path/file.ts"))
		})

		it("should normalize paths with . and .. segments", () => {
			const filePath = "./src/../src/file.ts"
			const workspaceRoot = "/custom/workspace"
			const result = generateNormalizedAbsolutePath(filePath, workspaceRoot)
			expect(result).toBe(path.normalize("/custom/workspace/src/file.ts"))
		})
	})

	describe("generateRelativeFilePath", () => {
		it("should use provided workspace root", () => {
			const absolutePath = "/custom/workspace/src/file.ts"
			const workspaceRoot = "/custom/workspace"
			const result = generateRelativeFilePath(absolutePath, workspaceRoot)
			expect(result).toBe(path.normalize("src/file.ts"))
		})

		it("should fall back to getWorkspacePath when no workspace root provided", () => {
			const absolutePath = "/default/workspace/src/file.ts"
			const result = generateRelativeFilePath(absolutePath)
			expect(result).toBe(path.normalize("src/file.ts"))
		})

		it("should handle paths outside workspace", () => {
			const absolutePath = "/outside/workspace/file.ts"
			const workspaceRoot = "/custom/workspace"
			const result = generateRelativeFilePath(absolutePath, workspaceRoot)
			// The result will have .. segments to navigate outside
			expect(result).toContain("..")
		})

		it("should handle same path as workspace", () => {
			const absolutePath = "/custom/workspace"
			const workspaceRoot = "/custom/workspace"
			const result = generateRelativeFilePath(absolutePath, workspaceRoot)
			expect(result).toBe(".")
		})

		it("should handle multi-workspace scenarios", () => {
			// Simulate the error scenario from the issue
			const absolutePath = "/Users/test/admin/.prettierrc.json"
			const workspaceRoot = "/Users/test/project"
			const result = generateRelativeFilePath(absolutePath, workspaceRoot)
			// Should generate a valid relative path, not throw an error
			expect(result).toBe(path.normalize("../admin/.prettierrc.json"))
		})
	})
})
