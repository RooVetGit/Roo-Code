// npx jest src/core/__tests__/getSymbolDocumentation.test.ts
import * as path from "path"
import * as vscode from "vscode"
import { getSymbolDocumentation } from "../tools/getSymbolDocumentation"

// Mock vscode APIs
jest.mock("vscode", () => ({
	commands: {
		executeCommand: jest.fn(),
	},
	workspace: {
		openTextDocument: jest.fn(),
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace/path" } }],
	},
	Uri: {
		file: (fsPath: string) => ({ fsPath }),
	},
	SymbolKind: {
		Class: 4,
		Function: 11,
		Method: 5,
		Property: 6,
		Variable: 12,
		Interface: 10,
		// Map numeric values back to strings for better test readability
		4: "Class",
		11: "Function",
		5: "Method",
		6: "Property",
		12: "Variable",
		10: "Interface",
	},
}))

// Define some types to help with type-checking in tests
type MockDocumentSymbol = {
	name: string
	kind: number
	containerName: string
	children: MockDocumentSymbol[]
	range: {
		start: { line: number; character: number }
		end: { line: number; character: number }
	}
	selectionRange: {
		start: { line: number; character: number }
		end: { line: number; character: number }
	}
}

type MockLocation = {
	uri: { fsPath: string }
	range: {
		start: { line: number; character: number }
		end: { line: number; character: number }
	}
}

/**
 * Helper function to create a document symbol for testing
 */
function createDocumentSymbol(
	name: string,
	kind: number,
	options: {
		containerName?: string
		children?: MockDocumentSymbol[]
		startLine?: number
		startChar?: number
		endLine?: number
		endChar?: number
	} = {},
): MockDocumentSymbol {
	const { containerName = "", children = [], startLine = 2, startChar = 6, endLine = 10, endChar = 1 } = options

	return {
		name,
		kind,
		containerName,
		children,
		range: {
			start: { line: startLine, character: 0 },
			end: { line: endLine, character: endChar },
		},
		selectionRange: {
			start: { line: startLine, character: startChar },
			end: { line: startLine, character: startChar + name.length },
		},
	}
}

/**
 * Helper to create workspace symbol information for testing
 */
function createWorkspaceSymbol(
	name: string,
	kind: number,
	options: {
		containerName?: string
		uri?: string
		startLine?: number
		startChar?: number
		endLine?: number
		endChar?: number
	} = {},
) {
	const {
		containerName = "",
		uri = "/mock/workspace/path/src/models/user.ts",
		startLine = 5,
		startChar = 0,
		endLine = 15,
		endChar = 1,
	} = options

	return {
		name,
		kind,
		containerName,
		location: {
			uri: { fsPath: uri },
			range: {
				start: { line: startLine, character: startChar },
				end: { line: endLine, character: endChar },
			},
		},
	}
}

/**
 * Helper to create mock document for tests
 */
function createMockDocument(text: string) {
	return {
		getText: () => text,
		lineAt: (line: number) => ({ text: text.split("\n")[line] || "" }),
		positionAt: (index: number) => {
			const textToIndex = text.substring(0, index)
			const lines = textToIndex.split("\n")
			const line = lines.length - 1
			const character = lines[line].length
			return { line, character }
		},
	}
}

/**
 * Tests for the getSymbolDocumentation function
 *
 * This test suite follows the structure recommended in contributing_tests.md:
 * - Main describe block for the function
 * - Nested describes for specific scenarios
 * - Individual it blocks with descriptive names
 * - Setup/execution/assertion pattern
 */
describe("getSymbolDocumentation", () => {
	beforeEach(() => {
		// Reset mocks between tests for isolation
		jest.clearAllMocks()
	})

	/**
	 * Test scenario: Symbol is defined in the file
	 * This tests the primary "happy path" of finding a symbol directly in a file
	 */
	describe("when symbol is defined in the file", () => {
		it("should return documentation for a symbol defined in the specified file", async () => {
			// Setup: Mock document symbols provider to return a symbol
			const mockDocument = createMockDocument("class User { constructor(name) { this.name = name; } }")
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)

			const userSymbol = createDocumentSymbol("User", vscode.SymbolKind.Class)
			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeDocumentSymbolProvider") {
					return Promise.resolve([userSymbol])
				} else if (command === "vscode.executeHoverProvider") {
					return Promise.resolve([
						{
							contents: [
								{
									value: "```typescript\nclass User {\n  constructor(name: string);\n  getName(): string;\n}\n```\n\nUser class representing a user in the system",
								},
							],
						},
					])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation("User", "src/models/user.ts", "/mock/workspace/path")

			// Assert
			expect(result).toContain("Symbol: User")
			expect(result).toContain("Kind: Class") // Should show readable name
			expect(result).toContain("Status: Defined in file")
			expect(result).toContain("class User {")
			expect(result).toContain("User class representing a user")

			// Verify correct commands were called
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
				"vscode.executeDocumentSymbolProvider",
				expect.objectContaining({ fsPath: expect.stringContaining("src/models/user.ts") }),
			)
		})
	})

	/**
	 * Test scenario: Symbol is referenced (but not defined) in the file
	 * Tests finding a symbol that is referenced/imported in a file
	 */
	describe("when symbol is referenced in the file", () => {
		it("should return documentation for a symbol referenced in the specified file", async () => {
			// Setup: Document with an import
			const mockDocument = createMockDocument(
				"import { User } from './models/user';\n\nconst user = new User('John');",
			)
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)

			// Mock API calls
			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeDocumentSymbolProvider") {
					// No symbols defined in file
					return Promise.resolve([])
				} else if (command === "vscode.executeHoverProvider") {
					return Promise.resolve([
						{
							contents: [
								{
									value: "```typescript\nclass User {\n  constructor(name: string);\n  getName(): string;\n}\n```\n\nImported from './models/user'",
								},
							],
						},
					])
				} else if (command === "vscode.executeDefinitionProvider") {
					return Promise.resolve([
						{
							uri: { fsPath: "/mock/workspace/path/src/models/user.ts" },
							range: { start: { line: 5, character: 0 }, end: { line: 15, character: 1 } },
						},
					])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation("User", "src/example.ts", "/mock/workspace/path")

			// Assert
			expect(result).toContain("Symbol: User")
			expect(result).toContain("Location: /mock/workspace/path/src/models/user.ts")
			expect(result).toContain("Status: Imported/Referenced")
			expect(result).toContain("Referenced in: src/example.ts")
			expect(result).toContain("class User {")
			expect(result).toContain("Imported from")
		})
	})

	/**
	 * Test scenario: Using workspace symbols (when no file is specified)
	 * Tests the workspace search functionality when looking for symbols globally
	 */
	describe("when using workspace symbols", () => {
		it("should find symbol in workspace when no file is specified", async () => {
			// Setup: Mock workspace symbol provider
			const workspaceSymbol = createWorkspaceSymbol("User", vscode.SymbolKind.Class, { containerName: "models" })

			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeWorkspaceSymbolProvider") {
					return Promise.resolve([workspaceSymbol])
				} else if (command === "vscode.executeHoverProvider") {
					return Promise.resolve([
						{
							contents: [
								{
									value: "```typescript\nclass User {\n  constructor(name: string);\n  getName(): string;\n}\n```\n\nUser class from workspace",
								},
							],
						},
					])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation("User", undefined, "/mock/workspace/path")

			// Assert
			expect(result).toContain("Symbol: User")
			expect(result).toContain("Location: /mock/workspace/path/src/models/user.ts")
			expect(result).toContain("Kind: Class")
			expect(result).toContain("Container: models")
			expect(result).toContain("class User {")
			expect(result).toContain("User class from workspace")

			// Verify correct commands were called
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("vscode.executeWorkspaceSymbolProvider", "User")
		})
	})

	/**
	 * Edge cases and additional scenarios
	 * As recommended in contributing_tests.md lines 82-85, we test multiple scenarios including edge cases
	 */
	describe("additional scenarios", () => {
		/**
		 * Edge case: Multiple symbols with the same name
		 * Tests handling of ambiguous symbol names
		 */
		it("should handle multiple workspace symbol matches", async () => {
			// Setup: Multiple workspace symbols with the same name
			const classSymbol = createWorkspaceSymbol("User", vscode.SymbolKind.Class, {
				containerName: "models",
				uri: "/mock/workspace/path/src/models/user.ts",
			})

			const interfaceSymbol = createWorkspaceSymbol("User", vscode.SymbolKind.Interface, {
				containerName: "types",
				uri: "/mock/workspace/path/src/types/user.ts",
			})

			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeWorkspaceSymbolProvider") {
					return Promise.resolve([classSymbol, interfaceSymbol])
				} else if (command === "vscode.executeHoverProvider") {
					return Promise.resolve([
						{
							contents: [
								{
									value: "```typescript\nclass User {...}\n```\n\nUser class from models",
								},
							],
						},
					])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation("User", undefined, "/mock/workspace/path")

			// Assert - should use the first match
			expect(result).toContain("Symbol: User")
			expect(result).toContain("/mock/workspace/path/src/models/user.ts")
			expect(result).toContain("Container: models")
			expect(result).toContain("User class from models")
		})

		/**
		 * Edge case: Symbol without documentation
		 * Tests handling symbols that exist but have no hover documentation
		 */
		it("should handle scenario with no hover documentation but symbol is defined", async () => {
			// Setup: Document symbol without hover documentation
			const mockDocument = createMockDocument("class UndocumentedClass {}")
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)

			const undocumentedSymbol = createDocumentSymbol("UndocumentedClass", vscode.SymbolKind.Class, {
				startChar: 6,
				endChar: 22,
			})

			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeDocumentSymbolProvider") {
					return Promise.resolve([undocumentedSymbol])
				} else if (command === "vscode.executeHoverProvider") {
					// Return empty hover results
					return Promise.resolve([])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation(
				"UndocumentedClass",
				"src/models/undocumented.ts",
				"/mock/workspace/path",
			)

			// Assert
			expect(result).toContain("Symbol: UndocumentedClass")
			expect(result).toContain("Status: Defined in file")
			expect(result).toContain("No documentation available for this symbol")
		})

		/**
		 * Important behavior: Fallback to definition site for hover info
		 * Tests getting documentation from definition site when not available at usage site
		 */
		it("should use hover documentation at definition site when not available at usage site", async () => {
			// Setup: Document with an import but no hover at reference site
			const mockDocument = createMockDocument(
				"import { User } from './models/user';\n\nconst user = new User('John');",
			)
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)

			// Set up a sequence of calls
			let callCount = 0
			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeDocumentSymbolProvider") {
					return Promise.resolve([]) // No symbols defined in file
				} else if (command === "vscode.executeHoverProvider") {
					callCount++
					if (callCount === 1) {
						// First hover call at usage site - no documentation
						return Promise.resolve([])
					} else {
						// Second hover call at definition site - has documentation
						return Promise.resolve([
							{
								contents: [
									{
										value: "```typescript\nclass User {...}\n```\n\nDocumentation at definition site",
									},
								],
							},
						])
					}
				} else if (command === "vscode.executeDefinitionProvider") {
					return Promise.resolve([
						{
							uri: { fsPath: "/mock/workspace/path/src/models/user.ts" },
							range: { start: { line: 5, character: 0 }, end: { line: 15, character: 1 } },
						},
					])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation("User", "src/example.ts", "/mock/workspace/path")

			// Assert
			expect(result).toContain("Symbol: User")
			expect(result).toContain("Location: /mock/workspace/path/src/models/user.ts")
			expect(result).toContain("Documentation at definition site")
		})

		/**
		 * Edge case: Multiple definitions with the same name in the same file
		 * Tests selection of the correct definition when multiple matches exist
		 */
		it("should handle multiple definitions in the same file", async () => {
			// Setup: File with multiple definitions of the same name
			const mockDocument = createMockDocument(`
        function formatData(input) { return input.toString(); }
        
        function processData(data) {
          function formatData(item) { return JSON.stringify(item); }
          return data.map(formatData);
        }
      `)
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)

			// Create two symbols with the same name
			const globalFunction = createDocumentSymbol("formatData", vscode.SymbolKind.Function, {
				startLine: 1,
				endLine: 1,
				startChar: 9,
				endChar: 19,
			})

			const nestedFunction = createDocumentSymbol("formatData", vscode.SymbolKind.Function, {
				containerName: "processData",
				startLine: 4,
				endLine: 4,
				startChar: 11,
				endChar: 21,
			})

			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeDocumentSymbolProvider") {
					return Promise.resolve([globalFunction, nestedFunction])
				} else if (command === "vscode.executeHoverProvider") {
					return Promise.resolve([
						{
							contents: [
								{
									value: "```typescript\nfunction formatData(input: any): string\n```\n\nFormats data for output",
								},
							],
						},
					])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation("formatData", "src/utils/formatter.ts", "/mock/workspace/path")

			// Assert - should use the first match
			expect(result).toContain("Symbol: formatData")
			expect(result).toContain("Kind: Function")
			expect(result).toContain("Formats data for output")
			expect(result).toMatch(/Location:.*:[0-9]+:[0-9]+/)
		})

		/**
		 * Edge case: Multi-part hover documentation
		 * Tests handling of complex hover information with multiple parts
		 */
		it("should handle multi-part hover documentation", async () => {
			// Setup: Document with a complex API class
			const mockDocument = createMockDocument("class ComplexAPI { method1() {} method2() {} }")
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)

			const apiSymbol = createDocumentSymbol("ComplexAPI", vscode.SymbolKind.Class, {
				startLine: 0,
				endLine: 0,
				startChar: 6,
				endChar: 15,
			})

			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeDocumentSymbolProvider") {
					return Promise.resolve([apiSymbol])
				} else if (command === "vscode.executeHoverProvider") {
					return Promise.resolve([
						{
							contents: [
								// Multiple hover blocks
								{
									value: "```typescript\nclass ComplexAPI {\n  method1(): void;\n  method2(): string;\n}\n```",
								},
								"Part 1 of documentation",
								{
									value: "Part 2 of documentation with *markdown*",
								},
								"Part 3 of documentation",
							],
						},
					])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation("ComplexAPI", "src/api/complex.ts", "/mock/workspace/path")

			// Assert
			expect(result).toContain("Symbol: ComplexAPI")
			expect(result).toContain("```typescript\nclass ComplexAPI")
			expect(result).toContain("Part 1 of documentation")
			expect(result).toContain("Part 2 of documentation with *markdown*")
			expect(result).toContain("Part 3 of documentation")
		})

		/**
		 * Edge case: Definition outside the workspace
		 * Tests handling of symbols defined in external dependencies
		 */
		it("should handle definition found outside the workspace", async () => {
			// Setup: Referenced symbol with definition outside workspace
			// Note: We need to include "Express" (uppercase) in the document for the test to find it
			const mockDocument = createMockDocument(
				"import express, { Express } from 'express';\n\nconst app: Express = express();",
			)
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)

			// Mock the behavior differently to ensure the test passes
			// For this test, we'll simulate finding the express type at position 0,20 (where "Express" is)
			;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string, ...args: any[]) => {
				if (command === "vscode.executeDocumentSymbolProvider") {
					return Promise.resolve([])
				} else if (command === "vscode.executeHoverProvider") {
					// Check if we're looking at the position where "Express" appears
					const position = args[1]
					if (position && position.line === 0 && position.character >= 18 && position.character <= 25) {
						return Promise.resolve([
							{
								contents: [
									{
										value: "```typescript\ninterface Express {...}\n```\n\nExpress.js library interface",
									},
								],
							},
						])
					}
					return Promise.resolve([])
				} else if (command === "vscode.executeDefinitionProvider") {
					// Check if we're looking at the position where "Express" appears
					const position = args[1]
					if (position && position.line === 0 && position.character >= 18 && position.character <= 25) {
						return Promise.resolve([
							{
								uri: { fsPath: "/node_modules/express/index.d.ts" }, // Outside main workspace
								range: { start: { line: 100, character: 0 }, end: { line: 200, character: 1 } },
							},
						])
					}
					return Promise.resolve([])
				}
				return Promise.resolve([])
			})

			// Execute
			const result = await getSymbolDocumentation("Express", "src/server.ts", "/mock/workspace/path")

			// Assert
			expect(result).toContain("Symbol: Express")
			expect(result).toContain("Location: /node_modules/express/index.d.ts")
			expect(result).toContain("Status: Imported/Referenced")
			expect(result).toContain("Express.js library interface")
		})
	})

	/**
	 * Error handling tests
	 * Following the recommendation in contributing_tests.md lines 95-99
	 */
	describe("error handling", () => {
		it("should return appropriate message when symbol is not found", async () => {
			// Setup: Empty results from all providers
			const mockDocument = createMockDocument("// Empty file with no symbols")
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument)
			;(vscode.commands.executeCommand as jest.Mock).mockResolvedValue([])

			// Execute
			const result = await getSymbolDocumentation("NonExistentSymbol", "src/example.ts", "/mock/workspace/path")

			// Assert
			expect(result).toContain("No symbol 'NonExistentSymbol' found in file")
			expect(result).toContain("src/example.ts")
		})

		it("should return appropriate message when file doesn't exist", async () => {
			// Setup: openTextDocument throws an error
			;(vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error("File not found"))

			// Execute
			const result = await getSymbolDocumentation("User", "non/existent/file.ts", "/mock/workspace/path")

			// Assert
			expect(result).toContain("Error")
			expect(result).toContain("Could not analyze file")
			expect(result).toContain("non/existent/file.ts")
		})

		it("should handle exceptions during symbol lookup", async () => {
			// Setup: openTextDocument and executeCommand throw errors at different stages
			;(vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
				getText: () => "Some content",
				positionAt: () => ({ line: 0, character: 0 }),
			})
			;(vscode.commands.executeCommand as jest.Mock).mockRejectedValue(new Error("Language server error"))

			// Execute
			const result = await getSymbolDocumentation("User", "src/example.ts", "/mock/workspace/path")

			// Assert - match the actual error message pattern from the implementation
			expect(result).toContain("Error")
			expect(result).toContain("Could not analyze file")
			expect(result).toContain("Language server error")
		})
	})
})
