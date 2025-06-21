import React from "react"
import { render, screen } from "@testing-library/react"
import { ChatRowContent } from "../ChatRow"
import type { ClineMessage } from "@roo-code/types"

// Mock the entire i18n setup
jest.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock the translation hook
jest.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock the extension state context
jest.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		mcpServers: [],
		alwaysAllowMcp: false,
		currentCheckpoint: null,
	}),
}))

// Mock the clipboard hook
jest.mock("@src/utils/clipboard", () => ({
	useCopyToClipboard: () => ({
		copyWithFeedback: jest.fn(),
	}),
}))

// Mock the ProgressIndicator component
jest.mock("../ProgressIndicator", () => ({
	ProgressIndicator: () => <div data-testid="progress-indicator">Loading...</div>,
}))

describe("ChatRow Spinner Logic", () => {
	const baseMessage: ClineMessage = {
		ts: 1000,
		type: "say",
		say: "api_req_started",
		text: JSON.stringify({ cost: undefined, cancelReason: undefined }),
	}

	const baseProps = {
		isExpanded: false,
		isLast: true,
		isStreaming: false,
		onToggleExpand: jest.fn(),
		onSuggestionClick: jest.fn(),
		onBatchFileResponse: jest.fn(),
	}

	it("should show spinner for ongoing API request", () => {
		const modifiedMessages: ClineMessage[] = [baseMessage]

		render(
			<ChatRowContent
				{...baseProps}
				message={baseMessage}
				lastModifiedMessage={baseMessage}
				modifiedMessages={modifiedMessages}
			/>,
		)

		expect(screen.getByTestId("progress-indicator")).toBeInTheDocument()
	})

	it("should not show spinner when API request is finished", () => {
		const finishedMessage: ClineMessage = {
			...baseMessage,
			text: JSON.stringify({ cost: 0.001, cancelReason: undefined }),
		}
		const modifiedMessages: ClineMessage[] = [finishedMessage]

		render(
			<ChatRowContent
				{...baseProps}
				message={finishedMessage}
				lastModifiedMessage={finishedMessage}
				modifiedMessages={modifiedMessages}
			/>,
		)

		expect(screen.queryByTestId("progress-indicator")).not.toBeInTheDocument()
	})

	it("should show spinner for ongoing command execution", () => {
		const commandMessage: ClineMessage = {
			ts: 1000,
			type: "ask",
			ask: "command",
			text: "echo 'test'\n\n--- COMMAND OUTPUT ---\n",
		}
		const modifiedMessages: ClineMessage[] = [commandMessage]

		render(
			<ChatRowContent
				{...baseProps}
				message={commandMessage}
				lastModifiedMessage={commandMessage}
				modifiedMessages={modifiedMessages}
			/>,
		)

		expect(screen.getByTestId("progress-indicator")).toBeInTheDocument()
	})

	it("should not show spinner when command execution is completed", () => {
		const commandMessage: ClineMessage = {
			ts: 1000,
			type: "ask",
			ask: "command",
			text: "echo 'test'\n\n--- COMMAND OUTPUT ---\n",
		}
		const completionMessage: ClineMessage = {
			ts: 1001,
			type: "say",
			say: "api_req_finished",
		}
		const modifiedMessages: ClineMessage[] = [commandMessage, completionMessage]

		render(
			<ChatRowContent
				{...baseProps}
				message={commandMessage}
				lastModifiedMessage={commandMessage}
				modifiedMessages={modifiedMessages}
			/>,
		)

		expect(screen.queryByTestId("progress-indicator")).not.toBeInTheDocument()
	})

	it("should show spinner for ongoing MCP server request", () => {
		const mcpMessage: ClineMessage = {
			ts: 1000,
			type: "say",
			say: "mcp_server_request_started",
		}
		const modifiedMessages: ClineMessage[] = [mcpMessage]

		render(
			<ChatRowContent
				{...baseProps}
				message={mcpMessage}
				lastModifiedMessage={mcpMessage}
				modifiedMessages={modifiedMessages}
			/>,
		)

		expect(screen.getByTestId("progress-indicator")).toBeInTheDocument()
	})

	it("should not show spinner when MCP server request is completed", () => {
		const mcpRequestMessage: ClineMessage = {
			ts: 1000,
			type: "say",
			say: "mcp_server_request_started",
		}
		const mcpResponseMessage: ClineMessage = {
			ts: 1001,
			type: "say",
			say: "mcp_server_response",
		}
		const modifiedMessages: ClineMessage[] = [mcpRequestMessage, mcpResponseMessage]

		render(
			<ChatRowContent
				{...baseProps}
				message={mcpRequestMessage}
				lastModifiedMessage={mcpRequestMessage}
				modifiedMessages={modifiedMessages}
			/>,
		)

		expect(screen.queryByTestId("progress-indicator")).not.toBeInTheDocument()
	})

	it("should not show spinner when API request is cancelled", () => {
		const cancelledMessage: ClineMessage = {
			...baseMessage,
			text: JSON.stringify({ cost: undefined, cancelReason: "user_cancelled" }),
		}
		const modifiedMessages: ClineMessage[] = [cancelledMessage]

		render(
			<ChatRowContent
				{...baseProps}
				message={cancelledMessage}
				lastModifiedMessage={cancelledMessage}
				modifiedMessages={modifiedMessages}
			/>,
		)

		expect(screen.queryByTestId("progress-indicator")).not.toBeInTheDocument()
	})
})
