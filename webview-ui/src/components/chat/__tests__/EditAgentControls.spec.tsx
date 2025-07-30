import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { EditAgentControls } from "../EditAgentControls"
import { Mode } from "@roo/modes"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock the UI components
vi.mock("@/components/ui", () => ({
	Button: ({ children, onClick, disabled, ...props }: any) => (
		<button onClick={onClick} disabled={disabled} {...props}>
			{children}
		</button>
	),
	StandardTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
}))

// Mock AgentSelector
vi.mock("../AgentSelector", () => ({
	default: ({ value, onChange, title }: any) => (
		<select value={value} onChange={(e) => onChange(e.target.value)} title={title || "chat:selectAgent"}>
			<option value="code">Code</option>
			<option value="architect">Architect</option>
		</select>
	),
}))

// Mock ExtensionStateContext
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		hasOpenedModeSelector: false,
		setHasOpenedModeSelector: vi.fn(),
	}),
}))

// Mock other dependencies
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/components/ui/hooks/useRooPortal", () => ({
	useRooPortal: () => document.body,
}))

vi.mock("@/utils/TelemetryClient", () => ({
	telemetryClient: {
		capture: vi.fn(),
	},
}))

vi.mock("@roo/modes", () => ({
	getAllModes: () => [
		{ slug: "code", name: "Code", description: "Code mode" },
		{ slug: "architect", name: "Architect", description: "Architect mode" },
	],
}))

describe("EditAgentControls", () => {
	const defaultProps = {
		mode: "code" as Mode,
		onModeChange: vi.fn(),
		modeShortcutText: "Ctrl+M",
		customModes: [],
		customModePrompts: {},
		onCancel: vi.fn(),
		onSend: vi.fn(),
		onSelectImages: vi.fn(),
		sendingDisabled: false,
		shouldDisableImages: false,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders all controls correctly", () => {
		render(<EditAgentControls {...defaultProps} />)

		// Check for agent selector
		expect(screen.getByTitle("chat:selectAgent")).toBeInTheDocument()

		// Check for Cancel button
		expect(screen.getByText("Cancel")).toBeInTheDocument()

		// Check for image button
		expect(screen.getByTitle("chat:addImages")).toBeInTheDocument()

		// Check for send button
		expect(screen.getByTitle("chat:save.tooltip")).toBeInTheDocument()
	})

	it("calls onCancel when Cancel button is clicked", () => {
		render(<EditAgentControls {...defaultProps} />)

		const cancelButton = screen.getByText("Cancel")
		fireEvent.click(cancelButton)

		expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
	})

	it("calls onSend when send button is clicked", () => {
		render(<EditAgentControls {...defaultProps} />)

		const sendButton = screen.getByLabelText("chat:save.tooltip")
		fireEvent.click(sendButton)

		expect(defaultProps.onSend).toHaveBeenCalledTimes(1)
	})

	it("calls onSelectImages when image button is clicked", () => {
		render(<EditAgentControls {...defaultProps} />)

		const imageButton = screen.getByLabelText("chat:addImages")
		fireEvent.click(imageButton)

		expect(defaultProps.onSelectImages).toHaveBeenCalledTimes(1)
	})

	it("disables buttons when sendingDisabled is true", () => {
		render(<EditAgentControls {...defaultProps} sendingDisabled={true} />)

		const cancelButton = screen.getByText("Cancel")
		const sendButton = screen.getByLabelText("chat:save.tooltip")

		expect(cancelButton).toBeDisabled()
		expect(sendButton).toBeDisabled()
	})

	it("disables image button when shouldDisableImages is true", () => {
		render(<EditAgentControls {...defaultProps} shouldDisableImages={true} />)

		const imageButton = screen.getByLabelText("chat:addImages")
		expect(imageButton).toBeDisabled()
	})

	it("does not call onSelectImages when image button is disabled", () => {
		render(<EditAgentControls {...defaultProps} shouldDisableImages={true} />)

		const imageButton = screen.getByLabelText("chat:addImages")
		fireEvent.click(imageButton)

		expect(defaultProps.onSelectImages).not.toHaveBeenCalled()
	})

	it("does not call onSend when send button is disabled", () => {
		render(<EditAgentControls {...defaultProps} sendingDisabled={true} />)

		const sendButton = screen.getByLabelText("chat:save.tooltip")
		fireEvent.click(sendButton)

		expect(defaultProps.onSend).not.toHaveBeenCalled()
	})

	it("calls onModeChange when mode is changed", () => {
		render(<EditAgentControls {...defaultProps} />)

		const agentSelector = screen.getByTitle("chat:selectAgent")
		fireEvent.change(agentSelector, { target: { value: "architect" } })

		expect(defaultProps.onModeChange).toHaveBeenCalledWith("architect")
	})
})
