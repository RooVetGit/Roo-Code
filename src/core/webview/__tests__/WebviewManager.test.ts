import * as vscode from "vscode"
import { WebviewManager } from "../WebviewManager"
import { ExtensionMessage } from "../../../shared/ExtensionMessage"
import axios from "axios"

// Mock dependencies
jest.mock("axios")
jest.mock("../getNonce", () => ({
	getNonce: jest.fn().mockReturnValue("mock-nonce"),
}))
jest.mock("../getUri", () => ({
	getUri: jest.fn().mockImplementation((webview, extensionUri, pathComponents) => {
		return `mock-uri-for-${pathComponents.join("/")}`
	}),
}))

// Mock vscode workspace
jest.mock("vscode", () => ({
	workspace: {
		onDidChangeConfiguration: jest.fn().mockImplementation((callback) => ({
			dispose: jest.fn(),
		})),
	},
	window: {
		showErrorMessage: jest.fn(),
	},
	Uri: {
		joinPath: jest.fn(),
		file: jest.fn(),
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
}))

describe("WebviewManager", () => {
	let webviewManager: WebviewManager
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockWebview: vscode.Webview
	let mockDisposables: vscode.Disposable[]

	beforeEach(() => {
		// Mock context
		mockContext = {
			extensionUri: { fsPath: "/mock/extension/path" } as vscode.Uri,
			extensionMode: vscode.ExtensionMode.Production,
		} as vscode.ExtensionContext

		// Mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
		} as unknown as vscode.OutputChannel

		// Mock webview
		mockWebview = {
			html: "",
			options: {},
			onDidReceiveMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			postMessage: jest.fn().mockResolvedValue(true),
			cspSource: "mock-csp-source",
			asWebviewUri: jest.fn().mockImplementation((uri) => uri),
		}

		// Mock webview view
		mockWebviewView = {
			webview: mockWebview,
			visible: true,
			onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			onDidChangeVisibility: jest.fn().mockReturnValue({ dispose: jest.fn() }),
		} as unknown as vscode.WebviewView

		// Mock disposables array
		mockDisposables = []

		// Create WebviewManager instance
		webviewManager = new WebviewManager(mockContext, mockOutputChannel)
	})

	describe("postMessageToWebview", () => {
		it("should post a message to the webview", async () => {
			const message: ExtensionMessage = { type: "action", action: "chatButtonClicked" }
			await webviewManager.postMessageToWebview(mockWebviewView, message)
			expect(mockWebview.postMessage).toHaveBeenCalledWith(message)
		})

		it("should handle errors when posting a message", async () => {
			const message: ExtensionMessage = { type: "action", action: "chatButtonClicked" }
			mockWebview.postMessage = jest.fn().mockRejectedValue(new Error("Test error"))
			await webviewManager.postMessageToWebview(mockWebviewView, message)
			// Should not throw an error
		})
	})

	describe("getHtmlContent", () => {
		it("should return HTML content for production mode", () => {
			const html = webviewManager.getHtmlContent(mockWebview)
			expect(html).toContain("<!DOCTYPE html>")
			expect(html).toContain("mock-nonce")
			expect(html).toContain("mock-csp-source")
			expect(html).toContain("mock-uri-for-webview-ui/build/assets/index.css")
			expect(html).toContain("mock-uri-for-webview-ui/build/assets/index.js")
		})
	})

	describe("getHMRHtmlContent", () => {
		it("should return HTML content for development mode with HMR", async () => {
			// Mock axios to simulate dev server running
			;(axios.get as jest.Mock).mockResolvedValue({ data: "ok" })

			const html = await webviewManager.getHMRHtmlContent(mockWebview)
			expect(html).toContain("<!DOCTYPE html>")
			expect(html).toContain("mock-nonce")
			expect(html).toContain("mock-csp-source")
			expect(html).toContain("localhost:5173")
			expect(html).toContain("RefreshRuntime")
		})

		it("should fall back to production HTML when dev server is not running", async () => {
			// Mock axios to simulate dev server not running
			;(axios.get as jest.Mock).mockRejectedValue(new Error("Connection refused"))

			const getHtmlContentSpy = jest.spyOn(webviewManager, "getHtmlContent")

			await webviewManager.getHMRHtmlContent(mockWebview)
			expect(getHtmlContentSpy).toHaveBeenCalledWith(mockWebview)
		})
	})

	describe("resolveWebviewView", () => {
		it("should resolve a webview view with correct options", async () => {
			const messageListener = jest.fn()

			// Mock getHtmlContent to avoid implementation details
			jest.spyOn(webviewManager, "getHtmlContent").mockReturnValue("<html></html>")

			await webviewManager.resolveWebviewView(mockWebviewView, messageListener, mockDisposables)

			expect(mockWebview.options).toEqual({
				enableScripts: true,
				localResourceRoots: [mockContext.extensionUri],
			})
			expect(mockWebview.onDidReceiveMessage).toHaveBeenCalledWith(messageListener, null, mockDisposables)
			expect(mockWebviewView.onDidDispose).toHaveBeenCalled()
		})

		it("should set up visibility change listeners for WebviewView", async () => {
			const messageListener = jest.fn()

			// Mock getHtmlContent to avoid implementation details
			jest.spyOn(webviewManager, "getHtmlContent").mockReturnValue("<html></html>")

			await webviewManager.resolveWebviewView(mockWebviewView, messageListener, mockDisposables)

			// Get the visibility change callback
			const visibilityCallback = (mockWebviewView.onDidChangeVisibility as jest.Mock).mock.calls[0][0]

			// Call the callback
			visibilityCallback()

			// Since mockWebviewView.visible is true, it should post a message
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: "action",
				action: "didBecomeVisible",
			})
		})

		it("should set up view state change listeners for WebviewPanel", async () => {
			const messageListener = jest.fn()
			const mockWebviewPanel = {
				...mockWebviewView,
				onDidChangeVisibility: undefined,
				onDidChangeViewState: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			} as unknown as vscode.WebviewPanel

			// Mock getHtmlContent to avoid implementation details
			jest.spyOn(webviewManager, "getHtmlContent").mockReturnValue("<html></html>")

			await webviewManager.resolveWebviewView(mockWebviewPanel, messageListener, mockDisposables)

			// Get the view state change callback
			const viewStateCallback = (mockWebviewPanel.onDidChangeViewState as jest.Mock).mock.calls[0][0]

			// Call the callback
			viewStateCallback()

			// Since mockWebviewView.visible is true, it should post a message
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: "action",
				action: "didBecomeVisible",
			})
		})
	})
})
