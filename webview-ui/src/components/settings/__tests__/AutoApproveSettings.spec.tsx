import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { AutoApproveSettings } from "../AutoApproveSettings"

// Mock UI components
jest.mock("@/components/ui", () => ({
	Button: ({ children, onClick, ...props }: any) => (
		<button onClick={onClick} {...props}>
			{children}
		</button>
	),
	Input: ({ onChange, onKeyDown, ...props }: any) => <input onChange={onChange} onKeyDown={onKeyDown} {...props} />,
	Slider: ({ value, onValueChange, ...props }: any) => (
		<input
			type="range"
			value={value?.[0] || 0}
			onChange={(e) => onValueChange?.([parseInt(e.target.value)])}
			{...props}
		/>
	),
}))

// Mock dependencies
jest.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: jest.fn((key: string) => {
			const translations: Record<string, string> = {
				"settings:sections.autoApprove": "Auto Approve",
				"settings:autoApprove.description": "Auto-approve certain actions",
				"settings:autoApprove.readOnly.label": "Read-only",
				"settings:autoApprove.write.label": "Write files",
				"settings:autoApprove.execute.label": "Execute",
				"settings:autoApprove.browser.label": "Browser",
				"settings:autoApprove.mcp.label": "MCP",
				"settings:autoApprove.modeSwitch.label": "Mode Switch",
				"settings:autoApprove.subtasks.label": "Subtasks",
				"settings:autoApprove.retry.label": "Retry",
				"settings:autoApprove.readOnly.outsideWorkspace.label": "Allow outside workspace",
				"settings:autoApprove.readOnly.outsideWorkspace.description":
					"Allow read-only operations outside the workspace",
				"settings:autoApprove.write.outsideWorkspace.label": "Allow outside workspace",
				"settings:autoApprove.write.outsideWorkspace.description":
					"Allow write operations outside the workspace",
				"settings:autoApprove.write.delayLabel": "Delay before writing files",
				"settings:autoApprove.retry.delayLabel": "Delay before retrying requests",
				"settings:autoApprove.execute.allowedCommands": "Allowed Commands",
				"settings:autoApprove.execute.allowedCommandsDescription": "Commands that can be auto-approved",
				"settings:autoApprove.execute.commandPlaceholder": "Enter command",
				"settings:autoApprove.execute.addButton": "Add",
			}
			return translations[key] || key
		}),
	}),
}))

describe("AutoApproveSettings", () => {
	const defaultProps = {
		alwaysAllowReadOnly: false,
		alwaysAllowReadOnlyOutsideWorkspace: false,
		alwaysAllowWrite: false,
		alwaysAllowWriteOutsideWorkspace: false,
		writeDelayMs: 1000,
		alwaysAllowBrowser: false,
		alwaysApproveResubmit: false,
		requestDelaySeconds: 30,
		alwaysAllowMcp: false,
		alwaysAllowModeSwitch: false,
		alwaysAllowSubtasks: false,
		alwaysAllowExecute: false,
		allowedCommands: [],
		setCachedStateField: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("Additional settings visibility", () => {
		it("should show read-only additional settings when read-only is enabled", () => {
			render(<AutoApproveSettings {...defaultProps} alwaysAllowReadOnly={true} />)

			expect(screen.getByTestId("always-allow-readonly-outside-workspace-checkbox")).toBeInTheDocument()
		})

		it("should show write additional settings when write is enabled", () => {
			render(<AutoApproveSettings {...defaultProps} alwaysAllowWrite={true} />)

			expect(screen.getByTestId("always-allow-write-outside-workspace-checkbox")).toBeInTheDocument()
			expect(screen.getByTestId("write-delay-slider")).toBeInTheDocument()
		})

		it("should show retry additional settings when retry is enabled", () => {
			render(<AutoApproveSettings {...defaultProps} alwaysApproveResubmit={true} />)

			expect(screen.getByTestId("request-delay-slider")).toBeInTheDocument()
		})

		it("should show execute additional settings when execute is enabled", () => {
			render(<AutoApproveSettings {...defaultProps} alwaysAllowExecute={true} />)

			expect(screen.getByTestId("allowed-commands-heading")).toBeInTheDocument()
			expect(screen.getByTestId("command-input")).toBeInTheDocument()
			expect(screen.getByTestId("add-command-button")).toBeInTheDocument()
		})
	})

	describe("Command management", () => {
		it("should add a new command when add button is clicked", () => {
			const setCachedStateField = jest.fn()
			render(
				<AutoApproveSettings
					{...defaultProps}
					alwaysAllowExecute={true}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const commandInput = screen.getByTestId("command-input")
			const addButton = screen.getByTestId("add-command-button")

			fireEvent.change(commandInput, { target: { value: "npm test" } })
			fireEvent.click(addButton)

			expect(setCachedStateField).toHaveBeenCalledWith("allowedCommands", ["npm test"])
		})

		it("should add a new command when Enter key is pressed", () => {
			const setCachedStateField = jest.fn()
			render(
				<AutoApproveSettings
					{...defaultProps}
					alwaysAllowExecute={true}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const commandInput = screen.getByTestId("command-input")

			fireEvent.change(commandInput, { target: { value: "npm build" } })
			fireEvent.keyDown(commandInput, { key: "Enter" })

			expect(setCachedStateField).toHaveBeenCalledWith("allowedCommands", ["npm build"])
		})

		it("should not add duplicate commands", () => {
			const setCachedStateField = jest.fn()
			render(
				<AutoApproveSettings
					{...defaultProps}
					alwaysAllowExecute={true}
					allowedCommands={["npm test"]}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const commandInput = screen.getByTestId("command-input")
			const addButton = screen.getByTestId("add-command-button")

			fireEvent.change(commandInput, { target: { value: "npm test" } })
			fireEvent.click(addButton)

			expect(setCachedStateField).not.toHaveBeenCalled()
		})

		it("should remove commands when remove button is clicked", () => {
			const setCachedStateField = jest.fn()
			render(
				<AutoApproveSettings
					{...defaultProps}
					alwaysAllowExecute={true}
					allowedCommands={["npm test", "npm build"]}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const removeButton = screen.getByTestId("remove-command-0")
			fireEvent.click(removeButton)

			expect(setCachedStateField).toHaveBeenCalledWith("allowedCommands", ["npm build"])
		})
	})

	describe("Slider interactions", () => {
		it("should update write delay when slider changes", () => {
			const setCachedStateField = jest.fn()
			render(
				<AutoApproveSettings
					{...defaultProps}
					alwaysAllowWrite={true}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const slider = screen.getByTestId("write-delay-slider")
			fireEvent.change(slider, { target: { value: "2000" } })

			expect(setCachedStateField).toHaveBeenCalledWith("writeDelayMs", 2000)
		})

		it("should update request delay when slider changes", () => {
			const setCachedStateField = jest.fn()
			render(
				<AutoApproveSettings
					{...defaultProps}
					alwaysApproveResubmit={true}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const slider = screen.getByTestId("request-delay-slider")
			fireEvent.change(slider, { target: { value: "60" } })

			expect(setCachedStateField).toHaveBeenCalledWith("requestDelaySeconds", 60)
		})
	})

	describe("Checkbox interactions", () => {
		it("should update outside workspace setting for read-only", () => {
			const setCachedStateField = jest.fn()
			render(
				<AutoApproveSettings
					{...defaultProps}
					alwaysAllowReadOnly={true}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const checkbox = screen.getByTestId("always-allow-readonly-outside-workspace-checkbox")
			fireEvent.click(checkbox)

			expect(setCachedStateField).toHaveBeenCalledWith("alwaysAllowReadOnlyOutsideWorkspace", true)
		})

		it("should update outside workspace setting for write", () => {
			const setCachedStateField = jest.fn()
			render(
				<AutoApproveSettings
					{...defaultProps}
					alwaysAllowWrite={true}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const checkbox = screen.getByTestId("always-allow-write-outside-workspace-checkbox")
			fireEvent.click(checkbox)

			expect(setCachedStateField).toHaveBeenCalledWith("alwaysAllowWriteOutsideWorkspace", true)
		})
	})
})
