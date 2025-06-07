import { vi } from "vitest"

// Mock vscode module before any imports
vi.mock("vscode", () => {
	// Initialize ThemeIcon class first
	class ThemeIcon {
		static File: any
		static Folder: any
		constructor(
			public id: string,
			public color?: any,
		) {}
	}

	const vscode: any = {
		env: {
			appRoot: "/mock/app/root",
			appName: "Mock VS Code",
			uriScheme: "vscode",
			language: "en",
			clipboard: {
				readText: vi.fn(),
				writeText: vi.fn(),
			},
			openExternal: vi.fn(),
			asExternalUri: vi.fn(),
			uiKind: 1,
		},
		window: {
			showInformationMessage: vi.fn(),
			showErrorMessage: vi.fn(),
			createTextEditorDecorationType: vi.fn().mockReturnValue({
				dispose: vi.fn(),
			}),
			showTextDocument: vi.fn(),
			createOutputChannel: vi.fn().mockReturnValue({
				appendLine: vi.fn(),
				show: vi.fn(),
				clear: vi.fn(),
				dispose: vi.fn(),
			}),
			createWebviewPanel: vi.fn(),
			showWarningMessage: vi.fn(),
			showQuickPick: vi.fn(),
			showInputBox: vi.fn(),
			withProgress: vi.fn(),
			createStatusBarItem: vi.fn().mockReturnValue({
				show: vi.fn(),
				hide: vi.fn(),
				dispose: vi.fn(),
			}),
			activeTextEditor: undefined,
			visibleTextEditors: [],
			onDidChangeActiveTextEditor: vi.fn(),
			onDidChangeVisibleTextEditors: vi.fn(),
			onDidChangeTextEditorSelection: vi.fn(),
			onDidChangeTextEditorVisibleRanges: vi.fn(),
			onDidChangeTextEditorOptions: vi.fn(),
			onDidChangeTextEditorViewColumn: vi.fn(),
			onDidCloseTerminal: vi.fn(),
			state: {
				focused: true,
			},
			onDidChangeWindowState: vi.fn(),
			terminals: [],
			onDidOpenTerminal: vi.fn(),
			onDidChangeActiveTerminal: vi.fn(),
			onDidChangeTerminalState: vi.fn(),
			activeTerminal: undefined,
		},
		workspace: {
			getConfiguration: vi.fn().mockReturnValue({
				get: vi.fn(),
				has: vi.fn(),
				inspect: vi.fn(),
				update: vi.fn(),
			}),
			workspaceFolders: [],
			onDidChangeConfiguration: vi.fn(),
			onDidChangeWorkspaceFolders: vi.fn(),
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
			openTextDocument: vi.fn(),
			onDidOpenTextDocument: vi.fn(),
			onDidCloseTextDocument: vi.fn(),
			onDidChangeTextDocument: vi.fn(),
			onDidSaveTextDocument: vi.fn(),
			onWillSaveTextDocument: vi.fn(),
			textDocuments: [],
			createFileSystemWatcher: vi.fn().mockReturnValue({
				onDidChange: vi.fn(),
				onDidCreate: vi.fn(),
				onDidDelete: vi.fn(),
				dispose: vi.fn(),
			}),
			findFiles: vi.fn(),
			saveAll: vi.fn(),
			applyEdit: vi.fn(),
			registerTextDocumentContentProvider: vi.fn(),
			registerTaskProvider: vi.fn(),
			registerFileSystemProvider: vi.fn(),
			rootPath: undefined,
			name: undefined,
			onDidGrantWorkspaceTrust: vi.fn(),
			requestWorkspaceTrust: vi.fn(),
			onDidChangeWorkspaceTrust: vi.fn(),
			isTrusted: true,
			trustOptions: undefined,
			workspaceFile: undefined,
			getWorkspaceFolder: vi.fn(),
			asRelativePath: vi.fn(),
			updateWorkspaceFolders: vi.fn(),
			openNotebookDocument: vi.fn(),
			registerNotebookContentProvider: vi.fn(),
			registerFileSearchProvider: vi.fn(),
			registerTextSearchProvider: vi.fn(),
			onDidCreateFiles: vi.fn(),
			onDidDeleteFiles: vi.fn(),
			onDidRenameFiles: vi.fn(),
			onWillCreateFiles: vi.fn(),
			onWillDeleteFiles: vi.fn(),
			onWillRenameFiles: vi.fn(),
			notebookDocuments: [],
			onDidOpenNotebookDocument: vi.fn(),
			onDidCloseNotebookDocument: vi.fn(),
			onDidChangeNotebookDocument: vi.fn(),
			onWillSaveNotebookDocument: vi.fn(),
			onDidSaveNotebookDocument: vi.fn(),
			onDidChangeNotebookCellExecutionState: vi.fn(),
			registerNotebookCellStatusBarItemProvider: vi.fn(),
		},
		Uri: {
			parse: vi.fn((str) => ({ fsPath: str, toString: () => str })),
			file: vi.fn((path) => ({ fsPath: path, toString: () => path })),
			joinPath: vi.fn(),
		},
		Position: class {
			constructor(
				public line: number,
				public character: number,
			) {}
		},
		Range: class {
			constructor(
				public start: { line: number; character: number } | number,
				public end?: { line: number; character: number } | number,
				public endLine?: number,
				public endCharacter?: number,
			) {
				if (typeof start === "number") {
					// Handle constructor(startLine, startCharacter, endLine, endCharacter)
					this.start = { line: start, character: end as number }
					this.end = { line: endLine!, character: endCharacter! }
				}
			}
		},
		Location: class {
			constructor(
				public uri: any,
				public range: any,
			) {}
		},
		Selection: class {
			constructor(
				public anchor: { line: number; character: number },
				public active: { line: number; character: number },
			) {}
		},
		TextEdit: {
			insert: vi.fn(),
			delete: vi.fn(),
			replace: vi.fn(),
			setEndOfLine: vi.fn(),
		},
		WorkspaceEdit: class {
			set = vi.fn()
			replace = vi.fn()
			insert = vi.fn()
			delete = vi.fn()
			has = vi.fn()
			entries = vi.fn()
			renameFile = vi.fn()
			createFile = vi.fn()
			deleteFile = vi.fn()
		},
		commands: {
			executeCommand: vi.fn(),
			registerCommand: vi.fn(),
			registerTextEditorCommand: vi.fn(),
			getCommands: vi.fn(),
		},
		languages: {
			registerCompletionItemProvider: vi.fn(),
			registerCodeActionsProvider: vi.fn(),
			registerCodeLensProvider: vi.fn(),
			registerDefinitionProvider: vi.fn(),
			registerImplementationProvider: vi.fn(),
			registerTypeDefinitionProvider: vi.fn(),
			registerHoverProvider: vi.fn(),
			registerDocumentHighlightProvider: vi.fn(),
			registerReferenceProvider: vi.fn(),
			registerRenameProvider: vi.fn(),
			registerDocumentSymbolProvider: vi.fn(),
			registerDocumentFormattingEditProvider: vi.fn(),
			registerDocumentRangeFormattingEditProvider: vi.fn(),
			registerOnTypeFormattingEditProvider: vi.fn(),
			registerSignatureHelpProvider: vi.fn(),
			registerDocumentLinkProvider: vi.fn(),
			registerColorProvider: vi.fn(),
			registerFoldingRangeProvider: vi.fn(),
			registerDeclarationProvider: vi.fn(),
			registerSelectionRangeProvider: vi.fn(),
			registerCallHierarchyProvider: vi.fn(),
			registerLinkedEditingRangeProvider: vi.fn(),
			registerInlayHintsProvider: vi.fn(),
			registerDocumentSemanticTokensProvider: vi.fn(),
			registerDocumentRangeSemanticTokensProvider: vi.fn(),
			registerEvaluatableExpressionProvider: vi.fn(),
			registerInlineValuesProvider: vi.fn(),
			registerWorkspaceSymbolProvider: vi.fn(),
			registerDocumentDropEditProvider: vi.fn(),
			registerDocumentPasteEditProvider: vi.fn(),
			setLanguageConfiguration: vi.fn(),
			onDidChangeDiagnostics: vi.fn(),
			getDiagnostics: vi.fn(),
			createDiagnosticCollection: vi.fn(),
			getLanguages: vi.fn(),
			setTextDocumentLanguage: vi.fn(),
			match: vi.fn(),
			onDidEncounterLanguage: vi.fn(),
			registerInlineCompletionItemProvider: vi.fn(),
		},
		extensions: {
			getExtension: vi.fn(),
			onDidChange: vi.fn(),
			all: [],
		},
		EventEmitter: class {
			event = vi.fn()
			fire = vi.fn()
			dispose = vi.fn()
		},
		CancellationTokenSource: class {
			token = { isCancellationRequested: false, onCancellationRequested: vi.fn() }
			cancel = vi.fn()
			dispose = vi.fn()
		},
		Disposable: class {
			static from = vi.fn()
			constructor(public dispose: () => void) {}
		},
		StatusBarAlignment: {
			Left: 1,
			Right: 2,
		},
		ConfigurationTarget: {
			Global: 1,
			Workspace: 2,
			WorkspaceFolder: 3,
		},
		RelativePattern: class {
			constructor(
				public base: string,
				public pattern: string,
			) {}
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
		TextDocumentSaveReason: {
			Manual: 1,
			AfterDelay: 2,
			FocusOut: 3,
		},
		TextEditorRevealType: {
			Default: 0,
			InCenter: 1,
			InCenterIfOutsideViewport: 2,
			AtTop: 3,
		},
		OverviewRulerLane: {
			Left: 1,
			Center: 2,
			Right: 4,
			Full: 7,
		},
		DecorationRangeBehavior: {
			OpenOpen: 0,
			ClosedClosed: 1,
			OpenClosed: 2,
			ClosedOpen: 3,
		},
		MarkdownString: class {
			constructor(
				public value: string,
				public supportThemeIcons?: boolean,
			) {}
			isTrusted = false
			supportHtml = false
			baseUri: any
			appendText = vi.fn()
			appendMarkdown = vi.fn()
			appendCodeblock = vi.fn()
		},
		ThemeColor: class {
			constructor(public id: string) {}
		},
		ThemeIcon: ThemeIcon,
		TreeItem: class {
			constructor(
				public label: string,
				public collapsibleState?: number,
			) {}
			id?: string
			iconPath?: any
			description?: string
			contextValue?: string
			command?: any
			tooltip?: string | any
			accessibilityInformation?: any
			checkboxState?: any
		},
		TreeItemCollapsibleState: {
			None: 0,
			Collapsed: 1,
			Expanded: 2,
		},
		ExtensionKind: {
			UI: 1,
			Workspace: 2,
		},
		ExtensionMode: {
			Production: 1,
			Development: 2,
			Test: 3,
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
		FileType: {
			Unknown: 0,
			File: 1,
			Directory: 2,
			SymbolicLink: 64,
		},
		FilePermission: {
			Readonly: 1,
		},
		FileChangeType: {
			Changed: 1,
			Created: 2,
			Deleted: 3,
		},
		GlobPattern: class {},
	}

	// Set static properties after vscode is defined
	ThemeIcon.File = new ThemeIcon("file")
	ThemeIcon.Folder = new ThemeIcon("folder")

	return vscode
})

// Mock other modules that might be needed
vi.mock("../utils/logging", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
		child: vi.fn().mockReturnValue({
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			fatal: vi.fn(),
		}),
	},
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			track: vi.fn(),
			trackEvent: vi.fn(),
			trackError: vi.fn(),
			trackPerformance: vi.fn(),
			flush: vi.fn(),
			dispose: vi.fn(),
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureTaskCompleted: vi.fn(),
			captureTaskCancelled: vi.fn(),
			captureTaskFailed: vi.fn(),
			captureToolUse: vi.fn(),
			captureApiRequest: vi.fn(),
			captureApiResponse: vi.fn(),
			captureApiError: vi.fn(),
		},
		initialize: vi.fn(),
	},
	BaseTelemetryClient: class {
		track = vi.fn()
		trackEvent = vi.fn()
		trackError = vi.fn()
		trackPerformance = vi.fn()
		flush = vi.fn()
		dispose = vi.fn()
	},
}))

// Add toPosix method to String prototype
declare global {
	interface String {
		toPosix(): string
	}
}

function toPosixPath(p: string) {
	const isExtendedLengthPath = p.startsWith("\\\\?\\")
	if (isExtendedLengthPath) {
		return p
	}
	return p.replace(/\\/g, "/")
}

if (!String.prototype.toPosix) {
	String.prototype.toPosix = function (this: string): string {
		return toPosixPath(this)
	}
}
