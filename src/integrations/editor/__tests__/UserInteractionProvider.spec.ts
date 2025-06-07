import { describe, it, expect, beforeEach, vi } from "vitest"
import * as vscode from "vscode"
import { UserInteractionProvider } from "../UserInteractionProvider"

vi.mock("vscode", () => ({
	window: {
		tabGroups: {
			onDidChangeTabs: vi.fn(),
			onDidChangeTabGroups: vi.fn(),
		},
		onDidChangeActiveTextEditor: vi.fn(),
		onDidChangeTextEditorSelection: vi.fn(),
	},
}))

describe("UserInteractionProvider", () => {
	let provider: UserInteractionProvider
	let mockOnUserInteraction: ReturnType<typeof vi.fn>
	let mockGetSuppressFlag: ReturnType<typeof vi.fn>
	let mockDisposable: { dispose: ReturnType<typeof vi.fn> }

	beforeEach(() => {
		vi.clearAllMocks()
		mockOnUserInteraction = vi.fn()
		mockGetSuppressFlag = vi.fn().mockReturnValue(false)
		mockDisposable = { dispose: vi.fn() }

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

		// Get the callback that was registered
		const selectionChangeCallback = (vscode.window.onDidChangeTextEditorSelection as any).mock.calls[0][0]

		// Simulate the event
		selectionChangeCallback({})

		expect(mockOnUserInteraction).toHaveBeenCalled()
	})

	it("should not call onUserInteraction when suppress flag is true", () => {
		mockGetSuppressFlag.mockReturnValue(true)
		provider.enable()

		// Get the callback that was registered
		const selectionChangeCallback = (vscode.window.onDidChangeTextEditorSelection as any).mock.calls[0][0]

		// Simulate the event
		selectionChangeCallback({})

		expect(mockOnUserInteraction).not.toHaveBeenCalled()
	})

	it("should call onUserInteraction when active text editor changes", () => {
		provider.enable()

		// Get the callback that was registered
		const activeEditorChangeCallback = (vscode.window.onDidChangeActiveTextEditor as any).mock.calls[0][0]

		// Simulate the event with a non-null editor
		activeEditorChangeCallback({ document: { uri: "test" } })

		expect(mockOnUserInteraction).toHaveBeenCalled()
	})

	it("should not call onUserInteraction when active editor is null", () => {
		provider.enable()

		// Get the callback that was registered
		const activeEditorChangeCallback = (vscode.window.onDidChangeActiveTextEditor as any).mock.calls[0][0]

		// Simulate the event with null editor
		activeEditorChangeCallback(null)

		expect(mockOnUserInteraction).not.toHaveBeenCalled()
	})

	it("should dispose all listeners when dispose is called", () => {
		provider.enable()
		provider.dispose()

		expect(mockDisposable.dispose).toHaveBeenCalledTimes(4) // 4 listeners
	})

	it("should update options correctly", () => {
		provider.updateOptions({ autoApproval: false, autoFocus: false })
		provider.enable()

		// Should not set up listeners with updated options
		expect(vscode.window.onDidChangeTextEditorSelection).not.toHaveBeenCalled()
	})

	it("should reset listeners when enable is called multiple times", () => {
		provider.enable()
		expect(mockDisposable.dispose).toHaveBeenCalledTimes(0)

		provider.enable()
		expect(mockDisposable.dispose).toHaveBeenCalledTimes(4) // Previous listeners disposed
	})
})
