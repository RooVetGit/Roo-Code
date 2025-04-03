
var P1 = class extends z {
	_webview
	constructor() {
		super()
	}
	appType() {
		return "folder-selection"
	}
	title() {
		return "Select Folder"
	}
	register(t) {
		;(this._webview = t), this.addDisposables(this._webview.onDidReceiveMessage(this.onDidReceiveMessage))
	}
	onDidReceiveMessage = (t) => {
		switch (t.type) {
			case "main-panel-perform-action":
				this.performAction(t.data)
				break
			case "main-panel-create-project":
				this.createProject(t.data.name)
				break
		}
	}
	performAction(t) {
		switch (t) {
			case "open-folder": {
				tg.commands.executeCommand("vscode.openFolder")
				break
			}
			case "clone-repository": {
				tg.commands.executeCommand("git.clone")
				break
			}
		}
	}
	async createProject(t) {
		let r = "augment-projects",
			n = tCe()
		if (!n) return
		let i = tg.Uri.file(n),
			s = tg.Uri.joinPath(i, r),
			o = tg.Uri.joinPath(s, t)
		;(await $d(o.fsPath)) || (await Su(o.fsPath)), tg.commands.executeCommand("vscode.openFolder", o)
	}
}