import React from "react"
import { render, fireEvent, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import ChatView from "../ChatView"
import { vi } from "vitest"

const mockVscode = {
	postMessage: vi.fn(),
}
vi.stubGlobal("vscode", mockVscode)

const mockState = {
	sendingDisabled: true,
	clineMessages: [],
	taskHistory: [],
	apiConfiguration: {},
	organizationAllowList: {},
	mcpServers: [],
	alwaysAllowBrowser: false,
	alwaysAllowReadOnly: false,
	alwaysAllowReadOnlyOutsideWorkspace: false,
	alwaysAllowWrite: false,
	alwaysAllowWriteOutsideWorkspace: false,
	alwaysAllowWriteProtected: false,
	alwaysAllowExecute: false,
	alwaysAllowMcp: false,
	allowedCommands: [],
	deniedCommands: [],
	writeDelayMs: 0,
	followupAutoApproveTimeoutMs: 0,
	mode: "test-mode",
	setMode: () => {},
	autoApprovalEnabled: false,
	alwaysAllowModeSwitch: false,
	alwaysAllowSubtasks: false,
	openedTabs: [],
	filePaths: [],
	alwaysAllowFollowupQuestions: false,
	alwaysAllowUpdateTodoList: false,
	customModes: [],
	telemetrySetting: "off",
	hasSystemPromptOverride: false,
	historyPreviewCollapsed: false,
	soundEnabled: false,
	soundVolume: 0,
	cloudIsAuthenticated: false,
	isStreaming: false,
	currentTaskItem: null,
}

vi.mock("@/context/ExtensionStateContext", async () => {
	const originalModule = await vi.importActual("@/context/ExtensionStateContext")
	return {
		...originalModule,
		useExtensionState: () => mockState,
	}
})

describe("ChatView", () => {
	it("queues messages when sending is disabled and sends them when enabled", async () => {
		const queryClient = new QueryClient()
		const { rerender } = render(
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<ChatView isHidden={false} showAnnouncement={false} hideAnnouncement={() => {}} />
				</TooltipProvider>
			</QueryClientProvider>,
		)

		// Simulate user typing and sending a message
		const textArea = screen.getByPlaceholderText(/Type a task/i)
		fireEvent.change(textArea, { target: { value: "Test message 1" } })
		fireEvent.click(screen.getByLabelText("Send Message"))

		// Check if the message is in the queue
		expect(screen.getByText("Queued Messages:")).toBeInTheDocument()
		expect(screen.getByText("Test message 1")).toBeInTheDocument()
		expect(mockVscode.postMessage).not.toHaveBeenCalled()

		// Enable sending
		mockState.sendingDisabled = false

		rerender(
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<ChatView isHidden={false} showAnnouncement={false} hideAnnouncement={() => {}} />
				</TooltipProvider>
			</QueryClientProvider>,
		)

		// Check if the message is sent and queue is cleared
		expect(mockVscode.postMessage).toHaveBeenCalledWith({
			type: "newTask",
			text: "Test message 1",
			images: [],
		})
		expect(screen.queryByText("Queued Messages:")).not.toBeInTheDocument()
	})
})
