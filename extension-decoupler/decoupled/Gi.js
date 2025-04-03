
var GI = class e {
		_remoteInfoSource
		_abortController = void 0
		_toolMap = new Map()
		_logger = dn("RemoteToolHost")
		_transformationMap
		_cachedToolDefinitions = null
		_lastCacheUpdateTime = 0
		_cacheExpirationMs = 60 * 60 * 1e3
		constructor(t) {
			this._remoteInfoSource = t
			let r = new WI()
			this._transformationMap = new Map([[r.toolId, r]])
		}
		async getToolDefinitions(t = !0) {
			let r = (await this._getToolDefinitions(t)).filter((n) => n.isConfigured)
			return (
				this._toolMap.clear(),
				r.forEach((n) => {
					this._toolMap.set(n.identifier.toolId, n)
				}),
				r
			)
		}
		async getAllToolDefinitions(t = !0) {
			return await this._getToolDefinitions(t)
		}
		getTool(t) {}
		getName() {
			return Ro.remoteToolHost
		}
		async _getToolDefinitions(t = !0) {
			if (
				t &&
				this._cachedToolDefinitions !== null &&
				Date.now() - this._lastCacheUpdateTime < this._cacheExpirationMs
			)
				return this._cachedToolDefinitions
			this._logger.debug("Fetching remote tool definitions from backend")
			try {
				let r = UY(Li),
					n = await this._remoteInfoSource.retrieveRemoteTools(r),
					i = n.filter((c) => c.availabilityStatus === dm.UserConfigRequired).map((c) => c.remoteToolId),
					s = await this._remoteInfoSource.filterToolsWithExtraInput(i),
					o = (c) =>
						c.availabilityStatus === dm.Available
							? !0
							: c.availabilityStatus === dm.UserConfigRequired
								? s.has(c.remoteToolId)
								: !1,
					l = (
						await Promise.all(
							n.map(async (c) => {
								let u = this._transformationMap.get(c.remoteToolId)
								if (u) {
									this._logger.debug(`Applying transformation for ${c.remoteToolId}`)
									let f = await u.transform(c.toolDefinition)
									return { ...c, toolDefinition: f }
								}
								return c
							}),
						)
					).map((c) => ({
						definition: c.toolDefinition,
						identifier: { hostName: Ro.remoteToolHost, toolId: c.remoteToolId },
						isConfigured: o(c),
						enabled: !0,
						toolSafety: c.toolSafety,
						oauthUrl: c.oauthUrl,
					}))
				return (this._cachedToolDefinitions = l), (this._lastCacheUpdateTime = Date.now()), l
			} catch (r) {
				return (
					this._logger.error("Failed to list remote tools", r),
					this._cachedToolDefinitions !== null
						? (this._logger.info("Using expired cache due to error fetching remote tools"),
							this._cachedToolDefinitions)
						: []
				)
			}
		}
		findToolIdByName(t) {
			for (let [r, n] of this._toolMap.entries()) if (n.definition.name.toString() === t) return r
			return Li.Unknown
		}
		async callTool(t, r, n, i, s) {
			try {
				let o = (this._abortController = new AbortController()),
					a = this.findToolIdByName(n)
				if (!this._toolMap.get(a))
					return this._logger.error(`Tool not found: ${n}`), { text: `Tool ${n} not found.`, isError: !0 }
				let c = pd(),
					u = await this._remoteInfoSource.runRemoteTool(c, n, JSON.stringify(i), a, o.signal)
				return (
					u.status !== qv.ExecutionSuccess &&
						this._logger.error(`Failed to run remote tool ${n}: ${qv[u.status]}`),
					{
						text: u.toolOutput,
						isError: u.status !== qv.ExecutionSuccess,
						requestId: c,
					}
				)
			} catch (o) {
				return {
					text: `Failed to run remote tool ${n} - ${o instanceof Error ? o.message : o}`,
					isError: !0,
				}
			} finally {
				this._abortController = void 0
			}
		}
		checkToolCallSafe(t, r) {
			let n = this.findToolIdByName(t),
				i = this._toolMap.get(n)
			return i?.toolSafety === xt.Check
				? (this._logger.info(`Checking tool safety for ${t}`),
					this._remoteInfoSource.checkToolSafety(n, JSON.stringify(r)))
				: Promise.resolve(i?.toolSafety === xt.Safe)
		}
		isRequestActive(t, r) {
			return this._abortController !== void 0
		}
		close(t = !1) {
			return this._abortController?.abort(), Promise.resolve()
		}
		closeAllToolProcesses() {
			return Promise.resolve()
		}
		factory(t) {
			return new e(this._remoteInfoSource)
		}
	},
	qv
;