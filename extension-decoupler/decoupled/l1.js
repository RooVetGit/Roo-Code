
var L1 = class extends z {
	constructor(r, n, i, s) {
		super()
		this._apiServer = r
		this._config = n
		this._oauthFlow = i
		this._actionsModel = s
	}
	_logger = X("SignInApp")
	_webview
	_signInFlow
	appType() {
		return "sign-in"
	}
	title() {
		return ""
	}
	register(r) {
		;(this._webview = r),
			this.addDisposable(r.onDidReceiveMessage((i) => this.onMessageFromWebview(i))),
			this.addDisposable(this._actionsModel.onDerivedStatesSatisfied(this.handleDerivedStateChange.bind(this)))
		let n = Ti(r)
		this.addDisposable(n),
			n.registerStreamHandler("chat-user-message", (i) => this.onUserSendMessage(i)),
			n.registerHandler(
				"chat-loaded",
				(i) => (
					this._actionsModel.isDerivedStateSatisfied("UserShouldSignIn") && this.sendSignInActions(),
					Promise.resolve({
						type: "chat-initialize",
						data: {
							enableDebugFeatures: this._config.config.enableDebugFeatures,
							fullFeatured: !1,
						},
					})
				),
			)
	}
	onMessageFromWebview(r) {
		switch (r.type) {
			case "main-panel-perform-action":
				this.performAction(r.data)
				break
			case "augment-link":
				switch (r.data) {
					case x4:
						this.performAction("sign-in")
						break
					default:
						this._logger.warn(`Unknown augment link: ${r.data}`)
						break
				}
		}
	}
	performAction(r) {
		switch (r) {
			case "cancel-sign-in":
				this._oauthFlow.doProgrammaticCancellation(), this.sendSignInActions()
				break
			case "sign-in": {
				this.sendInProgressActions()
				let n = this._oauthFlow.startFlow(!1)
				;(this._signInFlow = n),
					n.catch((i) => {
						this._signInFlow === n && this.sendSignInActions()
					})
				break
			}
		}
	}
	async sendSignInActions() {
		await this.sendActionsToWebview(["UserShouldSignIn"])
	}
	async sendInProgressActions() {
		await this.sendActionsToWebview(["SignInInProgress"])
	}
	handleDerivedStateChange(r) {
		for (let n of r) n.name === "UserShouldSignIn" && this.sendSignInActions()
	}
	async sendActionsToWebview(r) {
		await this._webview?.postMessage({ type: "main-panel-actions", data: r })
	}
	async *onUserSendMessage(r) {
		let n = this._apiServer.createRequestId(),
			i = dCe
		for (let s of i)
			yield {
				type: "chat-model-reply",
				data: { text: s, requestId: n, workspaceFileChunks: [], streaming: !0 },
			},
				await new Promise((o) => setTimeout(o, 8))
		yield {
			type: "chat-model-reply",
			data: { text: "", requestId: n, workspaceFileChunks: [], streaming: !1 },
		}
	}
}