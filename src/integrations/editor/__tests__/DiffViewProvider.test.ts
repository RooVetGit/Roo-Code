// @jest-environment node
import * as vscode from "vscode"
import { DiffViewProvider } from "../DiffViewProvider"

jest.mock("vscode", () => ({
	...jest.requireActual("vscode"),
	workspace: {
		// mock vscode.workspace.getConfiguration("roo-cline").get<boolean>("diffViewAutoFocus", true)
		getConfiguration: jest.fn(() => ({
			get: jest.fn((key: string) => {
				if (key === "diffViewAutoFocus") return true
				if (key === "autoCloseRooTabs") return true
				return undefined
			}),
		})),
	},
	window: {
		tabGroups: { all: [] },
		visibleTextEditors: [],
		onDidChangeActiveTextEditor: jest.fn(),
		showTextDocument: jest.fn(),
		createTextEditorDecorationType: jest.fn(),
	},
	commands: {
		executeCommand: jest.fn(),
	},
	Uri: {
		...jest.requireActual("vscode").Uri,
		parse: jest.fn((value: string) => ({
			scheme: "file",
			path: value,
			with: jest.fn((options) => ({
				...options,
				scheme: options.scheme || "file",
				path: options.path || value,
			})),
		})),
	},
	ViewColumn: { Beside: 2 },
	TextEditorRevealType: { AtTop: 1, InCenter: 2 },
	Position: jest.requireActual("vscode").Position,
	Range: jest.requireActual("vscode").Range,
	Selection: jest.requireActual("vscode").Selection,
}))

// mock cline provider
jest.mock("../../../core/webview/ClineProvider", () => ({
	__esModule: true,
	ClineProvider: {
		// This is the inner ClineProvider object/class
		getVisibleInstance: jest.fn(() => ({
			getValue: jest.fn((key: string) => {
				if (key === "autoApprovalEnabled") return true
				if (key === "alwaysAllowWrite") return true
				return undefined
			}),
		})),
	},
}))

describe("DiffViewProvider", () => {
	const cwd = "/mock"
	const relPath = "file.txt"
	let provider: DiffViewProvider

	beforeEach(() => {
		jest.clearAllMocks()
		provider = new DiffViewProvider(cwd)
		provider["relPath"] = relPath
		provider["editType"] = "modify"
		provider["originalContent"] = "original"
	})

	it("should pass preserveFocus: false when autoFocus is true", async () => {
		;(vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
			get: () => true,
		})
		const executeCommand = vscode.commands.executeCommand as jest.Mock
		executeCommand.mockResolvedValue(undefined)
		await provider["initialize"]()
		const promise = provider["openDiffEditor"]()
		// Simulate editor activation
		setTimeout(() => {
			const calls = (vscode.window.onDidChangeActiveTextEditor as jest.Mock).mock.calls
			expect(calls).toEqual([])
		}, 1_000)
		await promise.catch((error) => {
			// this is expected to fail because the editor is not activated, we just want to test the command
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
		;(vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
			get: () => false,
		})
		const executeCommand = vscode.commands.executeCommand as jest.Mock
		executeCommand.mockResolvedValue(undefined)
		// mock correct values for autoFocus false
		jest.mock("vscode", () => ({
			...jest.requireActual("vscode"),
			workspace: {
				// mock vscode.workspace.getConfiguration("roo-cline").get<boolean>("diffViewAutoFocus", true)
				getConfiguration: jest.fn(() => ({
					get: jest.fn((key: string) => {
						if (key === "diffViewAutoFocus") return false
						if (key === "autoCloseRooTabs") return true
						return undefined
					}),
				})),
			},
			window: {
				tabGroups: { all: [] },
				visibleTextEditors: [],
				onDidChangeActiveTextEditor: jest.fn(),
				showTextDocument: jest.fn(),
				createTextEditorDecorationType: jest.fn(),
			},
			commands: {
				executeCommand: jest.fn(),
			},
			Uri: {
				...jest.requireActual("vscode").Uri,
				parse: jest.fn((value: string) => ({
					scheme: "file",
					path: value,
					with: jest.fn((options) => ({
						...options,
						scheme: options.scheme || "file",
						path: options.path || value,
					})),
				})),
			},
			ViewColumn: { Beside: 2 },
			TextEditorRevealType: { AtTop: 1, InCenter: 2 },
			Position: jest.requireActual("vscode").Position,
			Range: jest.requireActual("vscode").Range,
			Selection: jest.requireActual("vscode").Selection,
		}))
		await provider["initialize"]()
		const promise = provider["openDiffEditor"]()
		// Simulate editor activation
		setTimeout(() => {
			const calls = (vscode.window.onDidChangeActiveTextEditor as jest.Mock).mock.calls
			expect(calls).toEqual([])
		}, 1_000)
		await promise.catch((error) => {
			// this is expected to fail because the editor is not activated, we just want to test the command
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

	it("should pass preserveFocus: false when autoFocus is true", async () => {
		const mockConfig = {
			get: jest.fn((key: string) => {
				if (key === "diffViewAutoFocus") return true
				if (key === "autoCloseRooTabs") return true
				if (key === "autoCloseAllRooTabs") return false
				return undefined
			}),
		}
		;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

		const executeCommand = vscode.commands.executeCommand as any
		executeCommand.mockResolvedValue(undefined)

		await provider.initialize()

		const promise = (provider as any).openDiffEditor()

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
			get: jest.fn((key: string) => {
				if (key === "diffViewAutoFocus") return false
				if (key === "autoCloseRooTabs") return true
				if (key === "autoCloseAllRooTabs") return false
				return undefined
			}),
		}
		;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

		const executeCommand = vscode.commands.executeCommand as any
		executeCommand.mockResolvedValue(undefined)

		await provider.initialize()

		const promise = (provider as any).openDiffEditor()

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

	it("should properly initialize UserInteractionProvider", () => {
		expect(provider).toBeDefined()
		expect((provider as any).userInteractionProvider).toBeDefined()
	})

	it("should update UserInteractionProvider options when disabling auto focus", async () => {
		await provider.initialize()

		// Mock the provider's enable method to verify it's called
		const enableSpy = jest.spyOn((provider as any).userInteractionProvider, "enable")

		provider.disableAutoFocusAfterUserInteraction()

		expect(enableSpy).toHaveBeenCalled()
	})
})
