import { DIFF_VIEW_LABEL_CHANGES, DiffViewProvider } from "../DiffViewProvider"
import * as vscode from "vscode"
import { ViewColumn } from "vscode"

// Mock fs/promises
vi.mock("fs/promises", () => ({
	readFile: vi.fn().mockResolvedValue("file content"),
	writeFile: vi.fn().mockResolvedValue(undefined),
}))

// Mock utils
vi.mock("../../../utils/fs", () => ({
	createDirectoriesForFile: vi.fn().mockResolvedValue([]),
}))

// Mock path
vi.mock("path", () => ({
	resolve: vi.fn((cwd, relPath) => `${cwd}/${relPath}`),
	basename: vi.fn((path) => path.split("/").pop()),
}))

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		applyEdit: vi.fn(),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		textDocuments: [],
		fs: {
			stat: vi.fn(),
		},
		// mock vscode.workspace.getConfiguration("roo-cline").get<boolean>("diffViewAutoFocus", true)
		getConfiguration: vi.fn(() => ({
			get: vi.fn((key: string) => {
				if (key === "diffViewAutoFocus") return true
				if (key === "autoCloseRooTabs") return true
				return undefined
			}),
		})),
	},
	window: {
		createTextEditorDecorationType: vi.fn(),
		showTextDocument: vi.fn(),
		onDidChangeVisibleTextEditors: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextEditorSelection: vi.fn(() => ({ dispose: vi.fn() })),
		tabGroups: {
			all: [],
			close: vi.fn(),
			onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChangeTabGroups: vi.fn(() => ({ dispose: vi.fn() })),
		},
		visibleTextEditors: [],
		onDidChangeActiveTextEditor: vi.fn(),
		activeTextEditor: {
			document: {
				uri: { fsPath: "/mock/cwd/test.md" },
				getText: vi.fn(),
				lineCount: 10,
			},
			selection: {
				active: { line: 0, character: 0 },
				anchor: { line: 0, character: 0 },
			},
			edit: vi.fn().mockResolvedValue(true),
			revealRange: vi.fn(),
		},
	},
	commands: {
		executeCommand: vi.fn(),
	},
	languages: {
		getDiagnostics: vi.fn(() => []),
	},
	WorkspaceEdit: vi.fn().mockImplementation(() => ({
		replace: vi.fn(),
		delete: vi.fn(),
	})),
	ViewColumn: {
		Active: 1,
		Beside: 2,
		One: 1,
		Two: 2,
		Three: 3,
		Four: 4,
		Five: 5,
		Six: 6,
		Seven: 7,
		Eight: 8,
		Nine: 9,
	},
	Range: vi.fn(),
	Position: vi.fn(),
	Selection: vi.fn(),
	TextEditorRevealType: {
		InCenter: 2,
	},
	TabInputTextDiff: class TabInputTextDiff {},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
		parse: vi.fn((uri) => ({ with: vi.fn(() => ({})) })),
	},
}))

// Mock DecorationController
vi.mock("../DecorationController", () => ({
	DecorationController: vi.fn().mockImplementation(() => ({
		setActiveLine: vi.fn(),
		updateOverlayAfterLine: vi.fn(),
		addLines: vi.fn(),
		clear: vi.fn(),
	})),
}))

// mock cline diffViewProvider
vi.mock("../../../core/webview/ClineProvider", () => ({
	__esModule: true,
	ClineProvider: {
		// This is the inner ClineProvider object/class
		getVisibleInstance: vi.fn(() => ({
			getValue: vi.fn((key: string) => {
				if (key === "autoApprovalEnabled") return true
				if (key === "alwaysAllowWrite") return true
				return undefined
			}),
		})),
	},
}))

describe("DiffViewProvider", () => {
	let diffViewProvider: DiffViewProvider
	const mockCwd = "/mock/cwd"
	let mockWorkspaceEdit: { replace: any; delete: any }

	beforeEach(() => {
		vi.clearAllMocks()
		mockWorkspaceEdit = {
			replace: vi.fn(),
			delete: vi.fn(),
		}
		vi.mocked(vscode.WorkspaceEdit).mockImplementation(() => mockWorkspaceEdit as any)

		diffViewProvider = new DiffViewProvider(mockCwd)
		// Mock the necessary properties and methods
		;(diffViewProvider as any).relPath = "test.md"
		;(diffViewProvider as any).activeDiffEditor = {
			document: {
				uri: { fsPath: `${mockCwd}/test.md` },
				getText: vi.fn(),
				lineCount: 10,
			},
			selection: {
				active: { line: 0, character: 0 },
				anchor: { line: 0, character: 0 },
			},
			edit: vi.fn().mockResolvedValue(true),
			revealRange: vi.fn(),
		}
		;(diffViewProvider as any).activeLineController = { setActiveLine: vi.fn(), clear: vi.fn() }
		;(diffViewProvider as any).fadedOverlayController = {
			updateOverlayAfterLine: vi.fn(),
			addLines: vi.fn(),
			clear: vi.fn(),
		}
	})

	describe("update method", () => {
		it("should preserve empty last line when original content has one", async () => {
			;(diffViewProvider as any).originalContent = "Original content\n"
			await diffViewProvider.update("New content", true)

			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				"New content\n",
			)
		})

		it("should not add extra newline when accumulated content already ends with one", async () => {
			;(diffViewProvider as any).originalContent = "Original content\n"
			await diffViewProvider.update("New content\n", true)

			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				"New content\n",
			)
		})

		it("should not add newline when original content does not end with one", async () => {
			;(diffViewProvider as any).originalContent = "Original content"
			await diffViewProvider.update("New content", true)

			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(expect.anything(), expect.anything(), "New content")
		})
	})

	describe("open method", () => {
		it("should pre-open file as text document before executing diff command", async () => {
			// Setup
			const mockEditor = {
				document: {
					uri: { fsPath: `${mockCwd}/test.md` },
					getText: vi.fn().mockReturnValue(""),
					lineCount: 0,
				},
				selection: {
					active: { line: 0, character: 0 },
					anchor: { line: 0, character: 0 },
				},
				edit: vi.fn().mockResolvedValue(true),
				revealRange: vi.fn(),
			}

			// Track the order of calls
			const callOrder: string[] = []

			// Mock showTextDocument to track when it's called
			vi.mocked(vscode.window.showTextDocument).mockImplementation(async (uri, options) => {
				callOrder.push("showTextDocument")
				if (Object.keys(uri).length > 0) {
					return mockEditor as any
				}
				expect(options).toEqual({ preview: false, preserveFocus: false, viewColumn: vscode.ViewColumn.Active })
				return mockEditor as any
			})

			// Mock executeCommand to track when it's called
			vi.mocked(vscode.commands.executeCommand).mockImplementation(async (command) => {
				callOrder.push("executeCommand")
				expect(command).toBe("vscode.diff")
				return undefined
			})

			// Mock workspace.onDidOpenTextDocument to trigger immediately
			vi.mocked(vscode.workspace.onDidOpenTextDocument).mockImplementation((callback) => {
				// Trigger the callback immediately with the document
				setTimeout(() => {
					callback({ uri: { fsPath: `${mockCwd}/test.md` } } as any)
				}, 0)
				return { dispose: vi.fn() }
			})

			// Mock window.visibleTextEditors to return our editor
			vi.mocked(vscode.window).visibleTextEditors = [mockEditor as any]

			// Set up for file
			;(diffViewProvider as any).editType = "modify"

			// Execute open
			await diffViewProvider.open("test.md", ViewColumn.Active)

			// Verify that showTextDocument was called before executeCommand
			expect(callOrder).toEqual(["showTextDocument", "executeCommand", "showTextDocument"])

			// Verify that showTextDocument was called with preview: false
			expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
				expect.objectContaining({ fsPath: `${mockCwd}/test.md` }),
				{ preview: false, preserveFocus: false, viewColumn: vscode.ViewColumn.Active },
			)

			// Verify that the diff command was executed
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
				"vscode.diff",
				expect.any(Object),
				expect.any(Object),
				`test.md: ${DIFF_VIEW_LABEL_CHANGES} (Editable)`,
				{ preserveFocus: false, preview: false, viewColumn: ViewColumn.Active },
			)
		})

		it("should handle showTextDocument failure", async () => {
			// Mock showTextDocument to fail
			vi.mocked(vscode.window.showTextDocument).mockRejectedValue(new Error("Cannot open file"))

			// Mock workspace.onDidOpenTextDocument
			vi.mocked(vscode.workspace.onDidOpenTextDocument).mockReturnValue({ dispose: vi.fn() })

			// Mock window.onDidChangeVisibleTextEditors
			vi.mocked(vscode.window.onDidChangeVisibleTextEditors).mockReturnValue({ dispose: vi.fn() })

			// Set up for file
			;(diffViewProvider as any).editType = "modify"

			// Try to open and expect rejection
			await expect(diffViewProvider.open("test.md", ViewColumn.Active)).rejects.toThrow(
				"Failed to execute diff command for /mock/cwd/test.md: Cannot open file",
			)
		})
	})

	it("should properly initialize UserInteractionProvider", () => {
		expect(diffViewProvider).toBeDefined()
		expect((diffViewProvider as any).userInteractionProvider).toBeDefined()
	})

	it("should update UserInteractionProvider options when disabling auto focus", async () => {
		await diffViewProvider.initialize()

		// Mock the diffViewProvider's enable method to verify it's called
		const enableSpy = vi.spyOn((diffViewProvider as any).userInteractionProvider, "enable")

		diffViewProvider.disableAutoFocusAfterUserInteraction()

		expect(enableSpy).toHaveBeenCalled()
	})

	describe("preserve focus config", () => {
		it("should pass preserveFocus: false when autoFocus is true", async () => {
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "diffViewAutoFocus") return true
					if (key === "autoCloseRooTabs") return true
					if (key === "autoCloseAllRooTabs") return false
					return undefined
				}),
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			const mockEditor = {
				document: {
					uri: { fsPath: `${mockCwd}/test.md` },
					getText: vi.fn().mockReturnValue(""),
					lineCount: 0,
				},
				selection: {
					active: { line: 0, character: 0 },
					anchor: { line: 0, character: 0 },
				},
				edit: vi.fn().mockResolvedValue(true),
				revealRange: vi.fn(),
			}

			// Mock showTextDocument to track when it's called
			vi.mocked(vscode.window.showTextDocument).mockImplementation(async (uri, options) => {
				if (Object.keys(uri).length > 0) {
					return mockEditor as any
				}
				expect(options).toEqual({ preview: false, preserveFocus: false, viewColumn: vscode.ViewColumn.Active })
				return mockEditor as any
			})

			// Mock executeCommand to track when it's called
			vi.mocked(vscode.commands.executeCommand).mockImplementation(async (command) => {
				expect(command).toBe("vscode.diff")
				return undefined
			})

			// Mock workspace.onDidOpenTextDocument to trigger immediately
			vi.mocked(vscode.workspace.onDidOpenTextDocument).mockImplementation((callback) => {
				// Trigger the callback immediately with the document
				setTimeout(() => {
					callback({ uri: { fsPath: `${mockCwd}/test.md` } } as any)
				}, 0)
				return { dispose: vi.fn() }
			})

			const executeCommand = vscode.commands.executeCommand as any
			executeCommand.mockResolvedValue(undefined)

			await diffViewProvider.initialize()

			const promise = (diffViewProvider as any).openDiffEditor()

			await promise.catch((error: any) => {
				// This is expected to fail because the editor is not activated, we just want to test the command
				console.error("Error:", error)
			})

			expect(executeCommand).toHaveBeenCalledWith(
				"vscode.diff",
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.objectContaining({ preserveFocus: false, preview: false, viewColumn: -1 }),
			)
		})

		it("should pass preserveFocus: true when autoFocus is false", async () => {
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === "diffViewAutoFocus") return false
					if (key === "autoCloseRooTabs") return true
					if (key === "autoCloseAllRooTabs") return false
					return undefined
				}),
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			const mockEditor = {
				document: {
					uri: { fsPath: `${mockCwd}/test.md` },
					getText: vi.fn().mockReturnValue(""),
					lineCount: 0,
				},
				selection: {
					active: { line: 0, character: 0 },
					anchor: { line: 0, character: 0 },
				},
				edit: vi.fn().mockResolvedValue(true),
				revealRange: vi.fn(),
			}

			// Mock showTextDocument to track when it's called
			vi.mocked(vscode.window.showTextDocument).mockImplementation(async (uri, options) => {
				if (Object.keys(uri).length > 0) {
					return mockEditor as any
				}
				expect(options).toEqual({ preview: false, preserveFocus: false, viewColumn: vscode.ViewColumn.Active })
				return mockEditor as any
			})

			// Mock executeCommand to track when it's called
			vi.mocked(vscode.commands.executeCommand).mockImplementation(async (command) => {
				expect(command).toBe("vscode.diff")
				return undefined
			})

			// Mock workspace.onDidOpenTextDocument to trigger immediately
			vi.mocked(vscode.workspace.onDidOpenTextDocument).mockImplementation((callback) => {
				// Trigger the callback immediately with the document
				setTimeout(() => {
					callback({ uri: { fsPath: `${mockCwd}/test.md` } } as any)
				}, 0)
				return { dispose: vi.fn() }
			})

			const executeCommand = vscode.commands.executeCommand as any
			executeCommand.mockResolvedValue(undefined)

			await diffViewProvider.initialize()

			const promise = (diffViewProvider as any).openDiffEditor()

			await promise.catch((error: any) => {
				// This is expected to fail because the editor is not activated, we just want to test the command
				console.error("Error:", error)
			})

			expect(executeCommand).toHaveBeenCalledWith(
				"vscode.diff",
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.objectContaining({ preserveFocus: true, preview: false, viewColumn: -1 }),
			)
		})
	})
})
