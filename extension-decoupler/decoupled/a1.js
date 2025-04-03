
var A1 = class extends lt {
	constructor(r) {
		super()
		this._chatExtensionEvent = r
	}
	static commandID = "vscode-augment.startNewChat"
	type = "public"
	async run() {
		await nf("Start chat command"), this._chatExtensionEvent.fire("newThread")
	}
}