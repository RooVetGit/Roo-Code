import { describe, it, expect, vi, beforeEach } from "vitest"
import { webviewMessageHandler } from "../webviewMessageHandler"
import { ClineProvider } from "../ClineProvider"

describe("Diagnostic Settings Bug Fix", () => {
	let mockProvider: any
	let mockUpdateGlobalState: any
	let mockPostStateToWebview: any

	beforeEach(() => {
		mockUpdateGlobalState = vi.fn()
		mockPostStateToWebview = vi.fn()

		mockProvider = {
			contextProxy: {
				getValue: vi.fn(),
				setValue: mockUpdateGlobalState,
			},
			postStateToWebview: mockPostStateToWebview,
			log: vi.fn(),
		}
	})

	it("should preserve false value for includeDiagnosticMessages when explicitly set", async () => {
		// Test that false is preserved (not defaulted to true)
		await webviewMessageHandler(mockProvider, {
			type: "includeDiagnosticMessages",
			bool: false,
		})

		expect(mockUpdateGlobalState).toHaveBeenCalledWith("includeDiagnosticMessages", false)
		expect(mockPostStateToWebview).toHaveBeenCalled()
	})

	it("should apply default true value only when includeDiagnosticMessages is undefined", async () => {
		// Test that undefined defaults to true
		await webviewMessageHandler(mockProvider, {
			type: "includeDiagnosticMessages",
			bool: undefined,
		})

		expect(mockUpdateGlobalState).toHaveBeenCalledWith("includeDiagnosticMessages", true)
		expect(mockPostStateToWebview).toHaveBeenCalled()
	})

	it("should handle the complete settings save flow correctly", async () => {
		// Simulate the bug scenario:
		// 1. User unchecks diagnostics (false)
		// 2. User changes slider
		// 3. User saves settings

		// First, set diagnostics to false
		await webviewMessageHandler(mockProvider, {
			type: "includeDiagnosticMessages",
			bool: false,
		})

		expect(mockUpdateGlobalState).toHaveBeenCalledWith("includeDiagnosticMessages", false)

		// Then update max messages
		await webviewMessageHandler(mockProvider, {
			type: "maxDiagnosticMessages",
			value: 75,
		})

		expect(mockUpdateGlobalState).toHaveBeenCalledWith("maxDiagnosticMessages", 75)

		// Verify that includeDiagnosticMessages remains false
		// (In real scenario, this would be verified by checking the state)
		const firstCall = mockUpdateGlobalState.mock.calls[0]
		expect(firstCall[0]).toBe("includeDiagnosticMessages")
		expect(firstCall[1]).toBe(false)
	})
})
