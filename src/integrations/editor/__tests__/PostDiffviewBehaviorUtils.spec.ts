// npx vitest run src/integrations/editor/__tests__/PostDiffViewBehaviorUtils.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { PostDiffViewBehaviorUtils } from "../PostDiffViewBehaviorUtils"
import { DIFF_VIEW_URI_SCHEME } from "../DiffViewProvider"

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		tabGroups: {
			all: [],
			close: vi.fn(),
		},
		showTextDocument: vi.fn(),
		createTextEditorDecorationType: vi.fn(),
	},
	workspace: {
		textDocuments: [],
	},
	TabInputTextDiff: class TabInputTextDiff {
		constructor(
			public original?: { scheme?: string },
			public modified?: any,
		) {}
	},
	TabInputText: class TabInputText {
		constructor(public uri: any) {}
	},
	Uri: {
		parse: vi.fn(),
		file: vi.fn(),
	},
}))

// Mock path utilities
vi.mock("../../../utils/path", () => ({
	arePathsEqual: vi.fn((a: string, b: string) => a === b),
}))

describe("PostDiffViewBehaviorUtils", () => {
	let utils: PostDiffViewBehaviorUtils
	let mockContext: any

	beforeEach(() => {
		vi.clearAllMocks()
		mockContext = {
			relPath: "test.txt",
			editType: "modify" as const,
			documentWasOpen: false,
			cwd: "/test",
			rooOpenedTabs: new Set<string>(),
			preDiffActiveEditor: undefined,
			autoCloseAllRooTabs: false,
		}
		utils = new PostDiffViewBehaviorUtils(mockContext)
	})

	describe("updateContext", () => {
		it("should update context with new values", () => {
			utils.updateContext({
				relPath: "new-file.txt",
				editType: "create",
			})

			// Since context is private, we can test this indirectly by calling a method that uses it
			expect(() => utils.handlePostDiffFocus()).not.toThrow()
		})
	})

	describe("tabToCloseFilter", () => {
		it("should always close DiffView tabs opened by Roo", () => {
			const mockTab = {
				input: new (vscode as any).TabInputTextDiff({ scheme: DIFF_VIEW_URI_SCHEME }),
			} as vscode.Tab

			const settings = {
				autoFocus: true,
				autoCloseRooTabs: false,
				autoCloseAllRooTabs: false,
			}

			const result = utils.tabToCloseFilter(mockTab, settings)
			expect(result).toBe(true)
		})

		it("should not close non-Roo opened tabs", () => {
			const mockTab = {
				input: new (vscode as any).TabInputText({ toString: () => "file:///other.txt" }),
			} as vscode.Tab

			const settings = {
				autoFocus: true,
				autoCloseRooTabs: false,
				autoCloseAllRooTabs: false,
			}

			const result = utils.tabToCloseFilter(mockTab, settings)
			expect(result).toBe(false)
		})

		it("should close all Roo-opened tabs when autoCloseAllRooTabs is true", () => {
			mockContext.rooOpenedTabs.add("file:///test.txt")
			utils.updateContext(mockContext)

			const mockTab = {
				input: new (vscode as any).TabInputText({
					scheme: "file",
					fsPath: "/test/test.txt",
					toString: () => "file:///test.txt",
				}),
			} as vscode.Tab

			const settings = {
				autoFocus: true,
				autoCloseRooTabs: false,
				autoCloseAllRooTabs: true,
			}

			// Mock Uri.parse to return the expected URI
			;(vscode.Uri.parse as any).mockReturnValue({
				scheme: "file",
				fsPath: "/test/test.txt",
				toString: () => "file:///test.txt",
			})

			const result = utils.tabToCloseFilter(mockTab, settings)
			expect(result).toBe(true)
		})
	})

	describe("handlePostDiffFocus", () => {
		it("should return early if no relPath is set", async () => {
			mockContext.relPath = undefined
			utils.updateContext(mockContext)

			// Should not throw and should complete quickly
			await expect(utils.handlePostDiffFocus()).resolves.toBeUndefined()
		})

		it("should focus on pre-diff active tab when autoCloseAllRooTabs is true", async () => {
			const mockEditor = {
				document: { uri: { toString: () => "file:///test.txt" } },
				viewColumn: 1,
			}
			mockContext.autoCloseAllRooTabs = true
			mockContext.preDiffActiveEditor = mockEditor
			utils.updateContext(mockContext)

			// Mock workspace.textDocuments to include the document
			;(vscode.workspace as any).textDocuments = [mockEditor.document]

			const showTextDocumentSpy = vi.spyOn(vscode.window, "showTextDocument")

			await utils.handlePostDiffFocus()

			expect(showTextDocumentSpy).toHaveBeenCalledWith(mockEditor.document.uri, {
				viewColumn: mockEditor.viewColumn,
				preserveFocus: false,
				preview: false,
			})
		})
	})

	describe("closeTab", () => {
		it("should close a tab successfully", async () => {
			const mockTab = {
				input: {},
				label: "test.txt",
			} as vscode.Tab

			const closeSpy = vi.spyOn(vscode.window.tabGroups, "close")
			closeSpy.mockResolvedValue(true)

			// Mock tabGroups.all to return the same tab
			;(vscode.window.tabGroups as any).all = [
				{
					tabs: [mockTab],
				},
			]

			await utils.closeTab(mockTab)

			expect(closeSpy).toHaveBeenCalledWith(mockTab, true)
		})

		it("should handle tab close errors gracefully", async () => {
			const mockTab = {
				input: {},
				label: "test.txt",
			} as vscode.Tab

			const closeSpy = vi.spyOn(vscode.window.tabGroups, "close")
			closeSpy.mockRejectedValue(new Error("Close failed"))

			// Mock tabGroups.all to return the same tab
			;(vscode.window.tabGroups as any).all = [
				{
					tabs: [mockTab],
				},
			]

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			await utils.closeTab(mockTab)

			expect(consoleErrorSpy).toHaveBeenCalled()
			consoleErrorSpy.mockRestore()
		})
	})

	describe("closeAllRooOpenedViews", () => {
		it("should close all tabs that match the filter", async () => {
			const mockTab1 = {
				input: new (vscode as any).TabInputTextDiff({ scheme: DIFF_VIEW_URI_SCHEME }),
				label: "diff-tab",
			} as vscode.Tab

			const mockTab2 = {
				input: new (vscode as any).TabInputText({
					scheme: "file",
					fsPath: "/test/other.txt",
					toString: () => "file:///other.txt",
				}),
				label: "other.txt",
			} as vscode.Tab

			// Mock tabGroups.all
			;(vscode.window.tabGroups as any).all = [
				{
					tabs: [mockTab1, mockTab2],
				},
			]

			const closeSpy = vi.spyOn(vscode.window.tabGroups, "close")
			closeSpy.mockResolvedValue(true)

			const settings = {
				autoFocus: true,
				autoCloseRooTabs: false,
				autoCloseAllRooTabs: false,
			}

			await utils.closeAllRooOpenedViews(settings)

			// Should only close the diff tab
			expect(closeSpy).toHaveBeenCalledTimes(1)
			expect(closeSpy).toHaveBeenCalledWith(mockTab1, true)
		})
	})
})
