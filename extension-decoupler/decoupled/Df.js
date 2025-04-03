
var df = class e extends lt {
	constructor(r, n) {
		super()
		this.extension = r
		this._commandID = n
	}
	static commandIDCommunity = "vscode-augment.manageAccountCommunity"
	static commandIDProfessional = "vscode-augment.manageAccountProfessional"
	static commandIDEnterprise = "vscode-augment.manageAccountEnterprise"
	type = "public"
	run() {
		XF.env.openExternal(XF.Uri.parse("https://app.augmentcode.com/account"))
	}
	canRun() {
		let r = this.extension.userTier,
			n =
				this._commandID === e.commandIDCommunity
					? "community"
					: this._commandID === e.commandIDProfessional
						? "professional"
						: "enterprise"
		return super.canRun() && r === n
	}
}