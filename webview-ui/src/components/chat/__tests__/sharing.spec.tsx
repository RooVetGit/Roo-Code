import { render, fireEvent, screen } from "@testing-library/react"
import { ShareButton } from "../ShareButton"
import { TaskActions } from "../TaskActions"
import { vscode } from "../../../utils/vscode"
import { useExtensionState } from "../../../context/ExtensionStateContext"

jest.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

jest.mock("../../../context/ExtensionStateContext", () => ({
	useExtensionState: jest.fn(),
}))

describe("Sharing", () => {
	beforeEach(() => {
		;(useExtensionState as jest.Mock).mockReturnValue({
			isCloudShareEnabled: true,
		})
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("ShareButton", () => {
		it("should render the share button", () => {
			render(<ShareButton onClick={() => {}} />)
			expect(screen.getByRole("button")).toBeInTheDocument()
		})

		it("should call onClick when the button is clicked", () => {
			const onClick = jest.fn()
			render(<ShareButton onClick={onClick} />)
			fireEvent.click(screen.getByRole("button"))
			expect(onClick).toHaveBeenCalled()
		})
	})

	describe("TaskActions", () => {
		it("should post exportTaskToCloud message when share button is clicked", () => {
			render(<TaskActions buttonsDisabled={false} />)
			const shareButton = screen.getByTitle("Share Task")
			fireEvent.click(shareButton)
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "exportTaskToCloud" })
		})

		it("should post importTaskFromCloud message when import button is clicked", () => {
			window.prompt = jest.fn().mockReturnValue("test-id")
			render(<TaskActions buttonsDisabled={false} />)
			const importButton = screen.getByTitle("Import Task")
			fireEvent.click(importButton)
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "importTaskFromCloud",
				values: { id: "test-id" },
			})
		})

		it("should post importTaskFromCloud message with url when import button is clicked with a url", () => {
			window.prompt = jest.fn().mockReturnValue("https://example.com/session/test-id")
			render(<TaskActions buttonsDisabled={false} />)
			const importButton = screen.getByTitle("Import Task")
			fireEvent.click(importButton)
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "importTaskFromCloud",
				values: { url: "https://example.com/session/test-id" },
			})
		})
	})
})
