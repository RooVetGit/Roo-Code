import * as assert from "assert"
import * as vscode from "vscode"

suite("Roo Code Extension", () => {
	test("Commands should be registered", async () => {
		const expectedCommands = [
			"plusButtonClicked",
			"mcpButtonClicked",
			"historyButtonClicked",
			"popoutButtonClicked",
			"settingsButtonClicked",
			"openInNewTab",
			"explainCode",
			"fixCode",
			"improveCode",
		]

		const commands = await vscode.commands.getCommands(true)

		for (const cmd of expectedCommands) {
			const [_prefix, command] = cmd.split(".")
			assert.ok(commands.includes(command), `Command ${command} should be registered`)
		}
	})
})
