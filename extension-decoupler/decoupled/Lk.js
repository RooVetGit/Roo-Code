
var vx = "augment.sessions",
	ak = ["email"],
	lk = class extends z {
		constructor(r, n) {
			super()
			this._context = r
			this._config = n
			this.addDisposables(
				this.onDidChangeSession((i) => {
					;(this._isLoggedIn = !!i),
						Mh.commands.executeCommand("setContext", "vscode-augment.isLoggedIn", this._isLoggedIn)
				}),
				this._context.secrets.onDidChange(async (i) => {
					i.key === vx && this._sessionChangeEmitter.fire(await this.getSession())
				}),
				this._config.onDidChange(() => {
					Mh.commands.executeCommand("setContext", "vscode-augment.useOAuth", this.useOAuth)
				}),
			),
				(this._ready = this.initState())
		}
		_sessionChangeEmitter = new Mh.EventEmitter()
		_readyEmitter = new Mh.EventEmitter()
		_isLoggedIn
		_ready
		get onDidChangeSession() {
			return this._sessionChangeEmitter.event
		}
		get onReady() {
			return this._readyEmitter.event
		}
		get useOAuth() {
			let r = this._config.config
			return !!r.oauth && !!r.oauth.url && !!r.oauth.clientID && !r.apiToken && !r.completionURL
		}
		async initState() {
			;(this._isLoggedIn = !!(await this.getSession())),
				Mh.commands.executeCommand("setContext", "vscode-augment.isLoggedIn", this._isLoggedIn),
				Mh.commands.executeCommand("setContext", "vscode-augment.useOAuth", this.useOAuth),
				this._readyEmitter.fire()
		}
		get isLoggedIn() {
			return this._isLoggedIn
		}
		async saveSession(r, n) {
			await this._context.secrets.store(vx, JSON.stringify({ accessToken: r, tenantURL: n, scopes: ak }))
		}
		async getSession() {
			let r = await this._context.secrets.get(vx)
			if (r) {
				let n = JSON.parse(r)
				if ((0, VAe.isEqual)(n.scopes, ak)) return n
			}
			return null
		}
		async removeSession() {
			;(await this._context.secrets.get(vx)) && (await this._context.secrets.delete(vx))
		}
	}