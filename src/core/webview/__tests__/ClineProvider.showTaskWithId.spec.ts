import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { t } from "../../../i18n"

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		activeTextEditor: undefined,
		visibleTextEditors: [],
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeVisibleTextEditors: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextEditorSelection: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextEditorVisibleRanges: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextEditorOptions: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextEditorViewColumn: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() })),
		state: {
			focused: true,
		},
		terminals: [],
		showTextDocument: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		createStatusBarItem: vi.fn(() => ({
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		})),
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			dispose: vi.fn(),
			clear: vi.fn(),
		})),
		createWebviewPanel: vi.fn(),
		registerWebviewPanelSerializer: vi.fn(),
		createTerminal: vi.fn(),
		onDidOpenTerminal: vi.fn(() => ({ dispose: vi.fn() })),
		createTreeView: vi.fn(),
		createQuickPick: vi.fn(),
		createInputBox: vi.fn(),
		showQuickPick: vi.fn(),
		showInputBox: vi.fn(),
		showSaveDialog: vi.fn(),
		showOpenDialog: vi.fn(),
		withProgress: vi.fn(),
		createWebviewView: vi.fn(),
		registerTreeDataProvider: vi.fn(),
		registerUriHandler: vi.fn(),
		registerWebviewViewProvider: vi.fn(),
		registerCustomEditorProvider: vi.fn(),
		registerTerminalLinkProvider: vi.fn(),
		registerTerminalProfileProvider: vi.fn(),
		registerFileDecorationProvider: vi.fn(),
		tabGroups: {
			all: [],
			activeTabGroup: undefined,
			onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChangeTabGroups: vi.fn(() => ({ dispose: vi.fn() })),
			close: vi.fn(),
		},
	},
	ExtensionContext: vi.fn(),
	ExtensionMode: {
		Development: 1,
		Production: 2,
		Test: 3,
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
		parse: vi.fn(),
		joinPath: vi.fn(),
	},
	workspace: {
		workspaceFolders: [],
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn(),
			has: vi.fn(),
			inspect: vi.fn(),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn(),
		onDidChangeWorkspaceFolders: vi.fn(),
		onDidSaveTextDocument: vi.fn(),
		onDidChangeTextDocument: vi.fn(),
		onDidCreateFiles: vi.fn(),
		onDidDeleteFiles: vi.fn(),
		onDidRenameFiles: vi.fn(),
		onDidOpenTextDocument: vi.fn(),
		onDidCloseTextDocument: vi.fn(),
		applyEdit: vi.fn(),
		fs: {
			readFile: vi.fn(),
			writeFile: vi.fn(),
			delete: vi.fn(),
			createDirectory: vi.fn(),
			readDirectory: vi.fn(),
			stat: vi.fn(),
			rename: vi.fn(),
			copy: vi.fn(),
		},
		findFiles: vi.fn(),
		openTextDocument: vi.fn(),
		registerTextDocumentContentProvider: vi.fn(),
		registerTaskProvider: vi.fn(),
		registerFileSystemProvider: vi.fn(),
		saveAll: vi.fn(),
		textDocuments: [],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		getWorkspaceFolder: vi.fn(),
		asRelativePath: vi.fn(),
		updateWorkspaceFolders: vi.fn(),
		name: undefined,
		workspaceFile: undefined,
		registerNotebookSerializer: vi.fn(),
		isTrusted: true,
		requestWorkspaceTrust: vi.fn(),
		onDidGrantWorkspaceTrust: vi.fn(),
		notebookDocuments: [],
		onDidOpenNotebookDocument: vi.fn(),
		onDidCloseNotebookDocument: vi.fn(),
		onDidChangeNotebookDocument: vi.fn(),
		onDidSaveNotebookDocument: vi.fn(),
		registerNotebookCellStatusBarItemProvider: vi.fn(),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		machineId: "test-machine-id",
		sessionId: "test-session-id",
		clipboard: {
			readText: vi.fn(),
			writeText: vi.fn(),
		},
		openExternal: vi.fn(),
		asExternalUri: vi.fn(),
		appName: "Visual Studio Code",
		appRoot: "/test/app/root",
		appHost: "desktop",
		isNewAppInstall: false,
		isTelemetryEnabled: false,
		onDidChangeTelemetryEnabled: vi.fn(),
		remoteName: undefined,
		shell: "/bin/bash",
		uiKind: 1,
	},
	commands: {
		executeCommand: vi.fn(),
		getCommands: vi.fn(),
		registerCommand: vi.fn(),
		registerTextEditorCommand: vi.fn(),
	},
	Range: vi.fn(),
	Position: vi.fn(),
	Selection: vi.fn(),
	Location: vi.fn(),
	CallHierarchyItem: vi.fn(),
	SymbolKind: {
		File: 0,
		Module: 1,
		Namespace: 2,
		Package: 3,
		Class: 4,
		Method: 5,
		Property: 6,
		Field: 7,
		Constructor: 8,
		Enum: 9,
		Interface: 10,
		Function: 11,
		Variable: 12,
		Constant: 13,
		String: 14,
		Number: 15,
		Boolean: 16,
		Array: 17,
		Object: 18,
		Key: 19,
		Null: 20,
		EnumMember: 21,
		Struct: 22,
		Event: 23,
		Operator: 24,
		TypeParameter: 25,
	},
	SymbolTag: {
		Deprecated: 1,
	},
	TreeItem: vi.fn(),
	TreeItemCollapsibleState: {
		None: 0,
		Collapsed: 1,
		Expanded: 2,
	},
	ThemeIcon: vi.fn(),
	ThemeColor: vi.fn(),
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
	StatusBarAlignment: {
		Left: 1,
		Right: 2,
	},
	DecorationRangeBehavior: {
		OpenOpen: 0,
		ClosedClosed: 1,
		OpenClosed: 2,
		ClosedOpen: 3,
	},
	OverviewRulerLane: {
		Left: 1,
		Center: 2,
		Right: 4,
		Full: 7,
	},
	MarkdownString: vi.fn(),
	CommentThreadCollapsibleState: {
		Collapsed: 0,
		Expanded: 1,
	},
	CommentMode: {
		Editing: 0,
		Preview: 1,
	},
	CommentThreadState: {
		Unresolved: 0,
		Resolved: 1,
	},
	ProgressLocation: {
		SourceControl: 1,
		Window: 10,
		Notification: 15,
	},
	ViewColumn: {
		Active: -1,
		Beside: -2,
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
	DiagnosticSeverity: {
		Error: 0,
		Warning: 1,
		Information: 2,
		Hint: 3,
	},
	TextEditorRevealType: {
		Default: 0,
		InCenter: 1,
		InCenterIfOutsideViewport: 2,
		AtTop: 3,
	},
	TerminalLocation: {
		Panel: 1,
		Editor: 2,
	},
	FileType: {
		Unknown: 0,
		File: 1,
		Directory: 2,
		SymbolicLink: 64,
	},
	FilePermission: {
		Readonly: 1,
	},
	WorkspaceEdit: vi.fn(),
	EventEmitter: vi.fn(() => ({
		fire: vi.fn(),
		event: vi.fn(),
		dispose: vi.fn(),
	})),
	CancellationTokenSource: vi.fn(() => ({
		token: {
			isCancellationRequested: false,
			onCancellationRequested: vi.fn(),
		},
		cancel: vi.fn(),
		dispose: vi.fn(),
	})),
	Disposable: vi.fn(),
	TabInputText: vi.fn(),
	TabInputTextDiff: vi.fn(),
	TabInputCustom: vi.fn(),
	TabInputNotebook: vi.fn(),
	TabInputNotebookDiff: vi.fn(),
	TabInputTerminal: vi.fn(),
	TabInputWebview: vi.fn(),
	EndOfLine: {
		LF: 1,
		CRLF: 2,
	},
	EnvironmentVariableMutatorType: {
		Replace: 1,
		Append: 2,
		Prepend: 3,
	},
	UIKind: {
		Desktop: 1,
		Web: 2,
	},
	ColorThemeKind: {
		Light: 1,
		Dark: 2,
		HighContrast: 3,
		HighContrastLight: 4,
	},
	SourceControlInputBoxValidationType: {
		Error: 0,
		Warning: 1,
		Information: 2,
	},
}))

// Mock i18n
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => {
		const translations: Record<string, string> = {
			"common:errors.task_corrupt_deleted":
				"The selected task could not be loaded and has been removed from history. This usually happens when the task files are corrupted or missing.",
		}
		return translations[key] || key
	}),
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		hasInstance: vi.fn().mockReturnValue(true),
		createInstance: vi.fn(),
		get instance() {
			return {
				sendEvent: vi.fn(),
				sendError: vi.fn(),
				sendMetric: vi.fn(),
				setProvider: vi.fn(),
			}
		},
	},
}))

// Mock WorkspaceTracker
vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		initializeFilePaths: vi.fn(),
		dispose: vi.fn(),
	})),
}))

describe("ClineProvider - showTaskWithId", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel

	beforeEach(() => {
		// Setup mock context
		mockContext = {
			subscriptions: [],
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				setKeysForSync: vi.fn(),
			},
			extensionUri: { fsPath: "/mock/extension/path" } as vscode.Uri,
			extensionPath: "/mock/extension/path",
			globalStorageUri: { fsPath: "/mock/global/storage" } as vscode.Uri,
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
			},
		} as unknown as vscode.ExtensionContext

		mockOutputChannel = { appendLine: vi.fn() } as unknown as vscode.OutputChannel

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		// Mock methods
		provider.getCurrentCline = vi.fn()
		provider.getTaskWithId = vi.fn()
		provider.initClineWithHistoryItem = vi.fn()
		provider.postMessageToWebview = vi.fn()
		provider.postStateToWebview = vi.fn()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should handle successful task loading", async () => {
		const taskId = "test-task-id"
		const mockHistoryItem = {
			id: taskId,
			task: "Test task",
			number: 1,
			ts: Date.now(),
			tokensIn: 100,
			tokensOut: 200,
			totalCost: 0.01,
		}

		// Mock no current task
		vi.mocked(provider.getCurrentCline).mockReturnValue(undefined)

		// Mock successful getTaskWithId
		vi.mocked(provider.getTaskWithId).mockResolvedValue({
			historyItem: mockHistoryItem,
			taskDirPath: "/path/to/task",
			apiConversationHistoryFilePath: "/path/to/api.json",
			uiMessagesFilePath: "/path/to/ui.json",
			apiConversationHistory: [],
		})

		await provider.showTaskWithId(taskId)

		expect(provider.getTaskWithId).toHaveBeenCalledWith(taskId)
		expect(provider.initClineWithHistoryItem).toHaveBeenCalledWith(mockHistoryItem)
		expect(provider.postMessageToWebview).toHaveBeenCalledWith({
			type: "action",
			action: "chatButtonClicked",
		})
		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
	})

	it("should show error message when task fails to load", async () => {
		const taskId = "corrupt-task-id"

		// Mock no current task
		vi.mocked(provider.getCurrentCline).mockReturnValue(undefined)

		// Mock getTaskWithId throwing error (task not found)
		vi.mocked(provider.getTaskWithId).mockRejectedValue(new Error("Task not found"))

		await provider.showTaskWithId(taskId)

		expect(provider.getTaskWithId).toHaveBeenCalledWith(taskId)
		expect(provider.initClineWithHistoryItem).not.toHaveBeenCalled()
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			"The selected task could not be loaded and has been removed from history. This usually happens when the task files are corrupted or missing.",
		)
		expect(provider.postStateToWebview).toHaveBeenCalled()
		expect(provider.postMessageToWebview).not.toHaveBeenCalled()
	})

	it("should not reload if task is already current", async () => {
		const taskId = "current-task-id"
		const mockCline = { taskId }

		// Mock current task with same ID
		vi.mocked(provider.getCurrentCline).mockReturnValue(mockCline as any)

		await provider.showTaskWithId(taskId)

		expect(provider.getTaskWithId).not.toHaveBeenCalled()
		expect(provider.initClineWithHistoryItem).not.toHaveBeenCalled()
		expect(provider.postMessageToWebview).toHaveBeenCalledWith({
			type: "action",
			action: "chatButtonClicked",
		})
		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
	})

	it("should handle different error types gracefully", async () => {
		const taskId = "error-task-id"

		// Mock no current task
		vi.mocked(provider.getCurrentCline).mockReturnValue(undefined)

		// Mock getTaskWithId throwing a different error
		vi.mocked(provider.getTaskWithId).mockRejectedValue(new TypeError("Cannot read property"))

		await provider.showTaskWithId(taskId)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			"The selected task could not be loaded and has been removed from history. This usually happens when the task files are corrupted or missing.",
		)
		expect(provider.postStateToWebview).toHaveBeenCalled()
	})
})
