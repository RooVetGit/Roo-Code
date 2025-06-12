// npx jest src/integrations/editor/__tests__/UserInteractionProvider.test.ts

import * as vscode from "vscode"
import { UserInteractionProvider } from "../UserInteractionProvider"

jest.mock("vscode", () => ({
	window: {
		tabGroups: {
			onDidChangeTabs: jest.fn(),
			onDidChangeTabGroups: jest.fn(),
		},
		onDidChangeActiveTextEditor: jest.fn(),
		onDidChangeTextEditorSelection: jest.fn(),
	},
}))

describe("UserInteractionProvider", () => {
	let provider: UserInteractionProvider
	let mockOnUserInteraction: jest.Mock
	let mockGetSuppressFlag: jest.Mock
	let mockDisposable: { dispose: jest.Mock }

	beforeEach(() => {
		jest.clearAllMocks()
		mockOnUserInteraction = jest.fn()
		mockGetSuppressFlag = jest.fn().mockReturnValue(false)
		mockDisposable = { dispose: jest.fn() }

		// Mock the event listeners to return disposables
		;(vscode.window.onDidChangeTextEditorSelection as any).mockReturnValue(mockDisposable)
		;(vscode.window.onDidChangeActiveTextEditor as any).mockReturnValue(mockDisposable)
		;(vscode.window.tabGroups.onDidChangeTabs as any).mockReturnValue(mockDisposable)
		;(vscode.window.tabGroups.onDidChangeTabGroups as any).mockReturnValue(mockDisposable)

		provider = new UserInteractionProvider({
			onUserInteraction: mockOnUserInteraction,
			getSuppressFlag: mockGetSuppressFlag,
			autoApproval: true,
			autoFocus: true,
		})
	})

	it("should create provider with initial options", () => {
		expect(provider).toBeDefined()
	})

	it("should set up listeners when enabled with autoApproval and autoFocus true", () => {
		provider.enable()

		expect(vscode.window.onDidChangeTextEditorSelection).toHaveBeenCalled()
		expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled()
		expect(vscode.window.tabGroups.onDidChangeTabs).toHaveBeenCalled()
		expect(vscode.window.tabGroups.onDidChangeTabGroups).toHaveBeenCalled()
	})

	it("should not set up listeners when autoApproval is false", () => {
		provider.updateOptions({ autoApproval: false })
		provider.enable()

		expect(vscode.window.onDidChangeTextEditorSelection).not.toHaveBeenCalled()
		expect(vscode.window.onDidChangeActiveTextEditor).not.toHaveBeenCalled()
		expect(vscode.window.tabGroups.onDidChangeTabs).not.toHaveBeenCalled()
		expect(vscode.window.tabGroups.onDidChangeTabGroups).not.toHaveBeenCalled()
	})

	it("should not set up listeners when autoFocus is false", () => {
		provider.updateOptions({ autoFocus: false })
		provider.enable()

		expect(vscode.window.onDidChangeTextEditorSelection).not.toHaveBeenCalled()
		expect(vscode.window.onDidChangeActiveTextEditor).not.toHaveBeenCalled()
		expect(vscode.window.tabGroups.onDidChangeTabs).not.toHaveBeenCalled()
		expect(vscode.window.tabGroups.onDidChangeTabGroups).not.toHaveBeenCalled()
	})

	it("should call onUserInteraction when text editor selection changes", () => {
		provider.enable()

		const selectionChangeCallback = (vscode.window.onDidChangeTextEditorSelection as any).mock.calls[0][0]
		selectionChangeCallback({})

		expect(mockOnUserInteraction).toHaveBeenCalled()
	})

	it("should not call onUserInteraction when suppress flag is true", () => {
		mockGetSuppressFlag.mockReturnValue(true)
		provider.enable()

		const selectionChangeCallback = (vscode.window.onDidChangeTextEditorSelection as any).mock.calls[0][0]
		selectionChangeCallback({})

		expect(mockOnUserInteraction).not.toHaveBeenCalled()
	})

	it("should call onUserInteraction when active text editor changes", () => {
		provider.enable()

		const activeEditorChangeCallback = (vscode.window.onDidChangeActiveTextEditor as any).mock.calls[0][0]
		activeEditorChangeCallback({ document: { uri: "test" } })

		expect(mockOnUserInteraction).toHaveBeenCalled()
	})

	it("should not call onUserInteraction when active editor is null", () => {
		provider.enable()

		const activeEditorChangeCallback = (vscode.window.onDidChangeActiveTextEditor as any).mock.calls[0][0]
		activeEditorChangeCallback(null)

		expect(mockOnUserInteraction).not.toHaveBeenCalled()
	})

	it("should dispose all listeners when dispose is called", () => {
		provider.enable()
		provider.dispose()

		expect(mockDisposable.dispose).toHaveBeenCalledTimes(4)
	})

	it("should update options correctly", () => {
		provider.updateOptions({ autoApproval: false, autoFocus: false })
		provider.enable()

		expect(vscode.window.onDidChangeTextEditorSelection).not.toHaveBeenCalled()
	})

	it("should reset listeners when enable is called multiple times", () => {
		provider.enable()
		expect(mockDisposable.dispose).toHaveBeenCalledTimes(0)

		provider.enable()
		expect(mockDisposable.dispose).toHaveBeenCalledTimes(4)
	})
})
