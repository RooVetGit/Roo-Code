// Define historyItems for test mock data
const historyItems = [
	{
		id: "1",
		number: 1,
		ts: Date.now(),
		task: "test",
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.001,
		cacheWrites: 0,
		cacheReads: 0,
	},
]

const vscode = {
	env: {
		language: "en", // Default language for tests
		appName: "Visual Studio Code Test",
		appHost: "desktop",
		appRoot: "/test/path",
		machineId: "test-machine-id",
		sessionId: "test-session-id",
		shell: "/bin/zsh",
	},
	window: {
		showInformationMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		createTextEditorDecorationType: jest.fn().mockReturnValue({
			dispose: jest.fn(),
		}),
		tabGroups: {
			onDidChangeTabs: jest.fn(() => {
				return {
					dispose: jest.fn(),
				}
			}),
			all: [],
		},
	},
	FileSystemError: class {
		constructor(message) {
			this.message = message
		}
	},
	workspace: {
		onDidSaveTextDocument: jest.fn(),
		createFileSystemWatcher: jest.fn().mockReturnValue({
			onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			dispose: jest.fn(),
		}),
		fs: {
			stat: jest.fn(),
			readFile: jest.fn().mockImplementation((uri) => {
				if (uri.path.includes("taskHistory.jsonl")) {
					// Return stringified historyItems with each item on a new line
					const content = historyItems.map((item) => JSON.stringify(item)).join("\n")
					return Promise.resolve(Buffer.from(content))
				}
				return Promise.reject(new vscode.FileSystemError("File not found"))
			}),
			writeFile: jest.fn(),
			delete: jest.fn(),
		},
	},
	Disposable: class {
		dispose() {}
	},
	Uri: {
		file: (path) => ({
			fsPath: path,
			scheme: "file",
			authority: "",
			path: path,
			query: "",
			fragment: "",
			with: jest.fn(),
			toJSON: jest.fn(),
		}),
		joinPath: jest.fn().mockImplementation((uri, ...pathSegments) => {
			const path = [uri.path, ...pathSegments].join("/")
			return {
				fsPath: path,
				scheme: "file",
				authority: "",
				path: path,
				query: "",
				fragment: "",
				with: jest.fn(),
				toJSON: jest.fn(),
			}
		}),
	},
	EventEmitter: class {
		constructor() {
			this.event = jest.fn()
			this.fire = jest.fn()
		}
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
	Position: class {
		constructor(line, character) {
			this.line = line
			this.character = character
		}
	},
	Range: class {
		constructor(startLine, startCharacter, endLine, endCharacter) {
			this.start = new vscode.Position(startLine, startCharacter)
			this.end = new vscode.Position(endLine, endCharacter)
		}
	},
	ThemeColor: class {
		constructor(id) {
			this.id = id
		}
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	FileType: {
		Unknown: 0,
		File: 1,
		Directory: 2,
		SymbolicLink: 64,
	},
	TabInputText: class {
		constructor(uri) {
			this.uri = uri
		}
	},
	RelativePattern: class {
		constructor(base, pattern) {
			this.base = base
			this.pattern = pattern
		}
	},
}

module.exports = vscode
// Export historyItems for use in tests
module.exports.historyItems = historyItems
