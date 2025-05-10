import * as vscode from "vscode"
import { activate } from "../extension"
import { areArraysEqual } from "../core/settings/utils"

jest.mock("vscode")
jest.mock("../core/settings/utils")

describe("Extension Activation", () => {
	let mockContext: vscode.ExtensionContext

	beforeEach(() => {
		jest.clearAllMocks()

		mockContext = {
			subscriptions: [],
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
			},
		} as unknown as vscode.ExtensionContext

		// Mock vscode.workspace.getConfiguration
		const mockGetConfiguration = jest.fn().mockReturnValue({
			get: jest.fn().mockReturnValue(["npm test", "npm install", "tsc", "git log", "git diff", "git show"]),
		})
		;(vscode.workspace.getConfiguration as jest.Mock) = mockGetConfiguration
	})

	it("does not update globalState when current commands match defaults", async () => {
		const currentCommands = ["npm test", "npm install", "tsc", "git log", "git diff", "git show"]
		;(mockContext.globalState.get as jest.Mock).mockReturnValue(currentCommands)
		;(areArraysEqual as jest.Mock).mockReturnValue(true)

		await activate(mockContext)

		expect(mockContext.globalState.update).not.toHaveBeenCalled()
	})

	it("updates globalState when current commands differ from defaults", async () => {
		const currentCommands = ["custom-command"]
		;(mockContext.globalState.get as jest.Mock).mockReturnValue(currentCommands)
		;(areArraysEqual as jest.Mock).mockReturnValue(false)

		await activate(mockContext)

		expect(mockContext.globalState.update).toHaveBeenCalledWith("allowedCommands", expect.any(Array))
	})

	it("handles undefined current commands", async () => {
		;(mockContext.globalState.get as jest.Mock).mockReturnValue(undefined)
		;(areArraysEqual as jest.Mock).mockReturnValue(false)

		await activate(mockContext)

		expect(mockContext.globalState.update).toHaveBeenCalledWith("allowedCommands", expect.any(Array))
	})
})
