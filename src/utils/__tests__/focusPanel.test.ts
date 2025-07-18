import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { focusPanel } from "../focusPanel"
import { ClineProvider } from "../../core/webview/ClineProvider"

// Mock vscode module
vi.mock("vscode", () => ({
	commands: {
		executeCommand: vi.fn(),
	},
	window: {
		activeTextEditor: undefined,
		visibleTextEditors: [],
	},
	ViewColumn: {
		Active: 1,
	},
}))

// Mock ClineProvider
vi.mock("../../core/webview/ClineProvider", () => ({
	ClineProvider: {
		sideBarId: "roo-code.SidebarProvider",
		getVisibleInstance: vi.fn(),
	},
}))

// Mock Package
vi.mock("../../shared/package", () => ({
	Package: {
		name: "roo-code",
	},
}))

describe("focusPanel", () => {
	const mockExecuteCommand = vi.mocked(vscode.commands.executeCommand)
	const mockGetVisibleInstance = vi.mocked(ClineProvider.getVisibleInstance)

	beforeEach(() => {
		vi.clearAllMocks()
		// Reset window state
		;(vscode.window as any).activeTextEditor = undefined
		;(vscode.window as any).visibleTextEditors = []
	})

	describe("when panels exist", () => {
		it("should reveal tab panel when it exists but is not active", async () => {
			const mockTabPanel = {
				active: false,
				reveal: vi.fn(),
			} as any

			await focusPanel(mockTabPanel, undefined)

			expect(mockTabPanel.reveal).toHaveBeenCalledWith(1, false)
			expect(mockExecuteCommand).not.toHaveBeenCalled()
		})

		it("should focus sidebar panel when it exists", async () => {
			const mockSidebarPanel = {} as any

			await focusPanel(undefined, mockSidebarPanel)

			expect(mockExecuteCommand).toHaveBeenCalledWith("roo-code.SidebarProvider.focus")
		})

		it("should prefer tab panel over sidebar panel when both exist", async () => {
			const mockTabPanel = {
				active: false,
				reveal: vi.fn(),
			} as any
			const mockSidebarPanel = {} as any

			await focusPanel(mockTabPanel, mockSidebarPanel)

			expect(mockTabPanel.reveal).toHaveBeenCalledWith(1, false)
			expect(mockExecuteCommand).not.toHaveBeenCalled()
		})
	})

	describe("when no panels exist", () => {
		it("should open sidebar when there is a visible Roo Code instance", async () => {
			mockGetVisibleInstance.mockReturnValue({} as any)

			await focusPanel(undefined, undefined)

			expect(mockExecuteCommand).toHaveBeenCalledWith("workbench.view.extension.roo-code-ActivityBar")
		})

		it("should open sidebar when there is an active editor (user is working in this window)", async () => {
			mockGetVisibleInstance.mockReturnValue(undefined)
			;(vscode.window as any).activeTextEditor = { document: { fileName: "test.ts" } }

			await focusPanel(undefined, undefined)

			expect(mockExecuteCommand).toHaveBeenCalledWith("workbench.view.extension.roo-code-ActivityBar")
		})

		it("should open sidebar when there are visible editors (user is working in this window)", async () => {
			mockGetVisibleInstance.mockReturnValue(undefined)
			;(vscode.window as any).visibleTextEditors = [{ document: { fileName: "test.ts" } }]

			await focusPanel(undefined, undefined)

			expect(mockExecuteCommand).toHaveBeenCalledWith("workbench.view.extension.roo-code-ActivityBar")
		})

		it("should NOT open sidebar when no visible instance and no editors (multi-window scenario)", async () => {
			mockGetVisibleInstance.mockReturnValue(undefined)
			// No active editor and no visible editors (default state)

			await focusPanel(undefined, undefined)

			expect(mockExecuteCommand).not.toHaveBeenCalled()
		})

		it("should open sidebar when detection fails (fallback to existing behavior)", async () => {
			mockGetVisibleInstance.mockImplementation(() => {
				throw new Error("Test error")
			})

			await focusPanel(undefined, undefined)

			expect(mockExecuteCommand).toHaveBeenCalledWith("workbench.view.extension.roo-code-ActivityBar")
		})
	})
})