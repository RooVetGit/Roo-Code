
var qI = class extends OI {
	_clientInfo
	_serverCapabilities
	_serverVersion
	_capabilities
	constructor(t, r) {
		super(r), (this._clientInfo = t), (this._capabilities = r.capabilities)
	}
	assertCapability(t, r) {
		if (!this._serverCapabilities?.[t]) throw new Error(`Server does not support ${t} (required for ${r})`)
	}
	async connect(t) {
		await super.connect(t)
		try {
			let r = await this.request(
				{
					method: "initialize",
					params: {
						protocolVersion: yP,
						capabilities: this._capabilities,
						clientInfo: this._clientInfo,
					},
				},
				CP,
			)
			if (r === void 0) throw new Error(`Server sent invalid initialize result: ${r}`)
			if (!IY.includes(r.protocolVersion))
				throw new Error(`Server's protocol version is not supported: ${r.protocolVersion}`)
			;(this._serverCapabilities = r.capabilities),
				(this._serverVersion = r.serverInfo),
				await this.notification({ method: "notifications/initialized" })
		} catch (r) {
			throw (this.close(), r)
		}
	}
	getServerCapabilities() {
		return this._serverCapabilities
	}
	getServerVersion() {
		return this._serverVersion
	}
	assertCapabilityForMethod(t) {
		switch (t) {
			case "logging/setLevel":
				if (!this._serverCapabilities?.logging)
					throw new Error(`Server does not support logging (required for ${t})`)
				break
			case "prompts/get":
			case "prompts/list":
				if (!this._serverCapabilities?.prompts)
					throw new Error(`Server does not support prompts (required for ${t})`)
				break
			case "resources/list":
			case "resources/templates/list":
			case "resources/read":
			case "resources/subscribe":
			case "resources/unsubscribe":
				if (!this._serverCapabilities?.resources)
					throw new Error(`Server does not support resources (required for ${t})`)
				if (t === "resources/subscribe" && !this._serverCapabilities.resources.subscribe)
					throw new Error(`Server does not support resource subscriptions (required for ${t})`)
				break
			case "tools/call":
			case "tools/list":
				if (!this._serverCapabilities?.tools)
					throw new Error(`Server does not support tools (required for ${t})`)
				break
			case "completion/complete":
				if (!this._serverCapabilities?.prompts)
					throw new Error(`Server does not support prompts (required for ${t})`)
				break
			case "initialize":
				break
			case "ping":
				break
		}
	}
	assertNotificationCapability(t) {
		switch (t) {
			case "notifications/roots/list_changed":
				if (!this._capabilities.roots?.listChanged)
					throw new Error(`Client does not support roots list changed notifications (required for ${t})`)
				break
			case "notifications/initialized":
				break
			case "notifications/cancelled":
				break
			case "notifications/progress":
				break
		}
	}
	assertRequestHandlerCapability(t) {
		switch (t) {
			case "sampling/createMessage":
				if (!this._capabilities.sampling)
					throw new Error(`Client does not support sampling capability (required for ${t})`)
				break
			case "roots/list":
				if (!this._capabilities.roots)
					throw new Error(`Client does not support roots capability (required for ${t})`)
				break
			case "ping":
				break
		}
	}
	async ping(t) {
		return this.request({ method: "ping" }, Vg, t)
	}
	async complete(t, r) {
		return this.request({ method: "completion/complete", params: t }, IP, r)
	}
	async setLoggingLevel(t, r) {
		return this.request({ method: "logging/setLevel", params: { level: t } }, Vg, r)
	}
	async getPrompt(t, r) {
		return this.request({ method: "prompts/get", params: t }, _P, r)
	}
	async listPrompts(t, r) {
		return this.request({ method: "prompts/list", params: t }, xP, r)
	}
	async listResources(t, r) {
		return this.request({ method: "resources/list", params: t }, vP, r)
	}
	async listResourceTemplates(t, r) {
		return this.request({ method: "resources/templates/list", params: t }, EP, r)
	}
	async readResource(t, r) {
		return this.request({ method: "resources/read", params: t }, bP, r)
	}
	async subscribeResource(t, r) {
		return this.request({ method: "resources/subscribe", params: t }, Vg, r)
	}
	async unsubscribeResource(t, r) {
		return this.request({ method: "resources/unsubscribe", params: t }, Vg, r)
	}
	async callTool(t, r = cm, n) {
		return this.request({ method: "tools/call", params: t }, r, n)
	}
	async listTools(t, r) {
		return this.request({ method: "tools/list", params: t }, wP, r)
	}
	async sendRootsListChanged() {
		return this.notification({ method: "notifications/roots/list_changed" })
	}
}