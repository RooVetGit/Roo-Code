
var KF = class extends cf {
	constructor(r, n) {
		super(n, "Show Extension Status")
		this._extension = r
	}
	static commandID = "vscode-augment.extensionStatus"
	async run() {
		this._extension.updateStatusTrace()
		let r = await JF.workspace.openTextDocument(AA.displayStatusUri)
		await JF.window.showTextDocument(r)
	}
}