
var Hi = class extends lt {
	static commandID = "vscode-augment.focusAugmentPanel"
	type = "public"
	constructor() {
		super()
	}
	async run() {
		await hCe.commands.executeCommand("augment-chat.focus")
	}
}