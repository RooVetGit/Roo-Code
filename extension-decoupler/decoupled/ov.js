
var Ov = class e {
	_config
	_onStartupError
	_client = void 0
	_initializingPromise
	_closingPromise = void 0
	_cancelledByUser = !1
	_toolDefinitions = void 0
	_runningTool = void 0
	_serverName
	_stdErrGenerator = void 0
	static maxTimeoutMs = 2147483647
	constructor(t, r = void 0, n) {
		;(this._config = t),
			(this._onStartupError = n),
			(this._client = new qI({ name: "augment-mcp-client", version: "1.0.0" }, { capabilities: {} })),
			this.validateConfig(t),
			(this._serverName =
				t.name && t.name.length > 0 ? this.sanitizeServerName(t.name) : this.extractServerName(t.command)),
			(this._initializingPromise = (async () => {
				if ((await r, this._closingPromise !== void 0)) throw new Error("Client is closing")
				if (this._client === void 0) throw new Error("Client is undefined")
				let i = this._config.command,
					s = this._config.args || []
				this._config.useShellInterpolation &&
					(process.platform === "win32"
						? ((s = ["/c", i]), (i = "cmd.exe"))
						: ((s = ["-c", i]), (i = "/bin/sh")))
				let o = new BP({
					command: i,
					args: s,
					env: { ...SP(), ...this._config.env },
					stderr: "pipe",
				})
				;(this._stdErrGenerator = o), await this._client.connect(o)
				let a = await this._client.listTools()
				this._toolDefinitions =
					a?.tools.map((l) => {
						let c = this.createNamespacedToolName(l.name)
						return {
							definition: {
								name: c,
								description: l.description ?? "",
								input_schema_json: JSON.stringify(l.inputSchema),
								tool_safety: xt.Unsafe,
							},
							identifier: { hostName: Ro.mcpHost, toolId: c },
							isConfigured: !0,
							enabled: !0,
							toolSafety: xt.Unsafe,
						}
					}) ?? []
			})()
				.catch((i) => {
					let s
					this._client !== void 0 &&
						this._stdErrGenerator !== void 0 &&
						(s = this._stdErrGenerator.capturedStderr),
						this._onStartupError({
							command: this._config.command,
							args: this._config.args,
							error: i instanceof Error ? i.message : String(i),
							...(s !== void 0 && { stderr: s }),
						})
				})
				.finally(() => {
					this._stdErrGenerator?.stopCapturing()
				}))
	}
	isRequestActive(t, r) {
		return this._runningTool?.requestId === t && this._runningTool?.toolUseId === r
	}
	close(t = !1) {
		return (
			this._closingPromise === void 0 &&
				((this._cancelledByUser = t),
				(this._closingPromise = (async () => {
					await (await this.getClient()).close()
				})())),
			this._closingPromise
		)
	}
	closeAllToolProcesses() {
		return Promise.resolve()
	}
	async getToolDefinitions() {
		return await this.getClient(), this._toolDefinitions === void 0 ? [] : this._toolDefinitions
	}
	getAllToolDefinitions(t = !0) {
		return this.getToolDefinitions()
	}
	getTool(t) {}
	getName() {
		return Ro.mcpHost
	}
	async callTool(t, r, n, i, s) {
		let o = await this.getClient()
		if (this._closingPromise !== void 0) return { isError: !0, text: "MCP client is closing" }
		this._runningTool = { requestId: t, toolUseId: r }
		let a = this.extractOriginalToolName(n),
			l
		try {
			let f
			this._config.timeoutMs && (f = { timeout: this._config.timeoutMs }),
				(l = await o.callTool({ name: a, arguments: i }, cm, f))
		} catch (f) {
			if (this._cancelledByUser) return { isError: !0, text: "Cancelled by user." }
			throw f
		} finally {
			this._runningTool = void 0
		}
		let c = typeof l.isError == "boolean" ? l.isError : !1
		if (!Array.isArray(l.content)) throw new Error("Unexpected result format: content is not an array")
		let u = l.content.map((f) => (!("text" in f) || typeof f.text != "string" ? "" : f.text)).join("")
		return { isError: c, text: c && u.length === 0 ? "No result" : u }
	}
	async checkToolCallSafe(t, r) {
		return Promise.resolve(!1)
	}
	async getClient() {
		if ((await this._initializingPromise, this._client === void 0)) throw new Error("Client is undefined")
		return this._client
	}
	validateConfig(t) {
		if (t?.timeoutMs !== void 0 && t?.timeoutMs > e.maxTimeoutMs)
			throw new Error(`Timeout is too large: ${t.timeoutMs}, max is ${e.maxTimeoutMs}.`)
	}
	sanitizeServerName(t) {
		return t.replace(/[^a-zA-Z0-9_-]/g, "_")
	}
	extractServerName(t) {
		let n = t.split(/\s+/)[0].split(/[/\\]/).pop() || "mcp"
		return this.sanitizeServerName(n)
	}
	createNamespacedToolName(t) {
		return (0, LY.truncate)(`${t}_${this._serverName}`, {
			length: 64,
			omission: "",
		})
	}
	extractOriginalToolName(t) {
		let r = `${this._serverName}_`
		return t.startsWith(r) ? t.substring(r.length) : t
	}
	factory(t) {
		return new e(this._config, t, this._onStartupError)
	}
}