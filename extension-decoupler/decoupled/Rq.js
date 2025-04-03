
var RQ = class {
	constructor(t, r, n) {
		this.storage = t
		this.toolsModel = r
		this.getSettingsMcpServers = n
	}
	logger = X("ToolConfigStore")
	async get() {
		try {
			return (
				(await this.storage.load("toolsConfiguration")) ?? {
					version: jG,
					tools: [],
				}
			)
		} catch (t) {
			return this.logger.error(`Failed to load tool configurations: ${Ye(t)}`), { version: jG, tools: [] }
		}
	}
	async save(t) {
		try {
			await this.storage.save("toolsConfiguration", t)
		} catch (r) {
			let n = `Failed to save tool configurations: ${Ye(r)}`
			throw (this.logger.error(n), new Ml(n))
		}
	}
	async getMCPServers() {
		try {
			let t = await this.storage.load("mcpServers")
			return Array.isArray(t) ? t : []
		} catch (t) {
			return this.logger.error(`Failed to load MCP servers: ${Ye(t)}`), []
		}
	}
	async saveMCPServers(t) {
		try {
			await this.storage.save("mcpServers", t), await this.updateSidecarMCPServers()
		} catch (r) {
			let n = `Failed to save MCP servers: ${Ye(r)}`
			throw (this.logger.error(n), new Ml(n))
		}
	}
	async updateSidecarMCPServers() {
		try {
			let r = (await this.getMCPServers()).map((s) => ({
					name: s.name,
					command: s.command,
					args: [],
					useShellInterpolation: !0,
				})),
				n = this.getSettingsMcpServers ? this.getSettingsMcpServers() : [],
				i = [...r]
			n && n.length > 0 && i.push(...n), this.toolsModel && this.toolsModel.setMcpServers(i)
		} catch (t) {
			this.logger.error(`Failed to update sidecar MCP servers: ${Ye(t)}`)
		}
	}
}