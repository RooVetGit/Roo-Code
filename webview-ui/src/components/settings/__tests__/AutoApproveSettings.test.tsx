import { render, screen, fireEvent } from "@testing-library/react"
import { AutoApproveSettings } from "../AutoApproveSettings"
import { vscode } from "@/utils/vscode"

jest.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

describe("AutoApproveSettings", () => {
	const mockSetCachedStateField = jest.fn()

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("does not update settings when adding default command", () => {
		render(
			<AutoApproveSettings
				allowedCommands={["npm test"]}
				setCachedStateField={mockSetCachedStateField}
				writeDelayMs={1000}
				requestDelaySeconds={5}
				alwaysAllowExecute={true}
			/>,
		)

		const input = screen.getByTestId("command-input")
		fireEvent.change(input, { target: { value: "git log" } })

		const addButton = screen.getByTestId("add-command-button")
		fireEvent.click(addButton)

		// Should not call setCachedStateField or postMessage for default commands
		expect(mockSetCachedStateField).not.toHaveBeenCalled()
		expect(vscode.postMessage).not.toHaveBeenCalled()
	})

	it("updates settings when adding non-default command", () => {
		render(
			<AutoApproveSettings
				allowedCommands={[]}
				setCachedStateField={mockSetCachedStateField}
				writeDelayMs={1000}
				requestDelaySeconds={5}
				alwaysAllowExecute={true}
			/>,
		)

		const input = screen.getByTestId("command-input")
		fireEvent.change(input, { target: { value: "custom-command" } })

		const addButton = screen.getByTestId("add-command-button")
		fireEvent.click(addButton)

		expect(mockSetCachedStateField).toHaveBeenCalledWith("allowedCommands", ["custom-command"])
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "allowedCommands",
			commands: ["custom-command"],
		})
	})

	it("does not update settings when removing command results in default list", () => {
		render(
			<AutoApproveSettings
				allowedCommands={["npm test", "git log", "custom-command"]}
				setCachedStateField={mockSetCachedStateField}
				writeDelayMs={1000}
				requestDelaySeconds={5}
				alwaysAllowExecute={true}
			/>,
		)

		// Remove custom command
		const removeButton = screen.getByTestId("remove-command-2")
		fireEvent.click(removeButton)

		// Should not call setCachedStateField or postMessage when result matches defaults
		expect(mockSetCachedStateField).not.toHaveBeenCalled()
		expect(vscode.postMessage).not.toHaveBeenCalled()
	})

	it("updates settings when removing command results in non-default list", () => {
		render(
			<AutoApproveSettings
				allowedCommands={["npm test", "custom-command"]}
				setCachedStateField={mockSetCachedStateField}
				writeDelayMs={1000}
				requestDelaySeconds={5}
				alwaysAllowExecute={true}
			/>,
		)

		// Remove custom command
		const removeButton = screen.getByTestId("remove-command-1")
		fireEvent.click(removeButton)

		expect(mockSetCachedStateField).toHaveBeenCalledWith("allowedCommands", ["npm test"])
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "allowedCommands",
			commands: ["npm test"],
		})
	})
})
