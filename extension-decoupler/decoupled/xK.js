
var Xk = class {
	constructor(t, r) {
		this._apiServer = t
		this._configListener = r
	}
	_logger = X("VSCodeRemoteInfo")
	async retrieveRemoteTools(t) {
		try {
			return (await this._apiServer.listRemoteTools(t)).tools
		} catch (r) {
			return this._logger.error("Failed to list remote tools", r), []
		}
	}
	filterToolsWithExtraInput(t) {
		let r = new Set()
		for (let n of t) this._getExtraToolInput(n) !== void 0 && r.add(n)
		return Promise.resolve(r)
	}
	async runRemoteTool(t, r, n, i, s) {
		return await this._apiServer.runRemoteTool(t, r, n, i, this._getExtraToolInput(i), s)
	}
	async checkToolSafety(t, r) {
		return await this._apiServer.checkToolSafety(t, r)
	}
	_getExtraToolInput(t) {
		switch (t) {
			case Li.Jira:
			case Li.Confluence:
				return this._configListener.config.integrations.atlassian
			case Li.Notion:
				return this._configListener.config.integrations.notion
			case Li.Linear:
				return this._configListener.config.integrations.linear
			case Li.GitHubApi:
				return this._configListener.config.integrations.github
			default:
				return
		}
	}
}