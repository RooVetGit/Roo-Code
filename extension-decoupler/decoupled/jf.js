
var jF = class extends Jo {
	constructor(r, n) {
		super(n)
		this._extension = r
	}
	static commandID = "vscode-augment.insertCompletion"
	completionTimeoutMS = 1e4
	type = "public"
	async run() {
		let r = {
				location: Hu.ProgressLocation.Notification,
				title: "Waiting for completion...",
				cancellable: !0,
			},
			n,
			i = async (s, o) => {
				n = await this.requestCompletion(o)
			}
		if ((await Hu.window.withProgress(r, i), !n)) {
			await Hu.window.showWarningMessage("Failed to request a completion")
			return
		}
		switch (n.resultType) {
			case "timeout":
				await Hu.window.showWarningMessage("Failed to request a completion")
				break
			case "cancelled":
				await Hu.window.showInformationMessage("Completion request cancelled")
				break
			default:
				n.foundCompletion || (await Hu.window.showInformationMessage("No completions found"))
				break
		}
	}
	async requestCompletion(r) {
		let n = Promise.race([
			(async () => {
				let i = await Iu(Mc),
					s = !1
				return (
					i?.completions && i.completions.length > 0 && (s = !0),
					{ foundCompletion: s, resultType: "completion" }
				)
			})(),
			(async () => (await Iu(mA), { foundCompletion: !1, resultType: "cancelled" }))(),
			(async () => (await Iu(r.onCancellationRequested), { foundCompletion: !1, resultType: "cancelled" }))(),
			new Promise((i) => {
				setTimeout(() => {
					i({ foundCompletion: !1, resultType: "timeout" })
				}, this.completionTimeoutMS)
			}),
		])
		return Hu.commands.executeCommand("editor.action.inlineSuggest.trigger"), await n
	}
	canRun() {
		return super.canRun() && this._extension.ready
	}
}