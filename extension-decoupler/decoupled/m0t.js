
var M0t = X("CopySessionIdPanelCommand"),
	HF = class extends lt {
		constructor(r) {
			super()
			this._apiServer = r
		}
		static commandID = "vscode-augment.copySessionId"
		type = "public"
		async run() {
			try {
				let r = this._apiServer.sessionId
				await WF.env.clipboard.writeText(r),
					await WF.window.showInformationMessage("Copied session ID to clipboard")
			} catch (r) {
				M0t.error(`Failed to copy session ID: ${r}`)
			}
		}
	}