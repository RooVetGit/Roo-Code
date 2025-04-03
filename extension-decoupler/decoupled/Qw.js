
var qW = {
		keys: ["name"],
		threshold: 0.05,
		includeScore: !0,
		useExtendedSearch: !0,
		isCaseSensitive: !0,
	},
	odt = 2e4,
	Tk = class extends z {
		constructor(r, n, i, s) {
			super()
			this._globalState = r
			this._config = n
			this._fuzzyFsSearcher = i
			this._workspaceManager = s
			;(this._logger = X("FuzzySymbolSearcher")),
				(this._fileTokensCache = new Uh(this._globalState, "fuzzyBlobNamesToSymbols", {
					lru: { max: 1e3, fetchMethod: this._loadFileDetailSymbols },
				})),
				this.addDisposables(
					Rk.window.onDidChangeActiveTextEditor(async (o) => {
						if (!o) return
						let a = this._workspaceManager.resolvePathName(o.document.uri.fsPath)
						if (!a) return
						let l = this._workspaceManager.getBlobName(a)
						l && (await this.warmupCache(l))
					}),
				)
		}
		_fileTokensCache
		_logger
		findSymbolsRegex = async (r) => {
			if (!this._config.config.enableDebugFeatures) return { type: "find-symbol-response", data: [] }
			let n = r.data.searchScope.files,
				i = (
					await Promise.all(
						n.map(async (o) =>
							(await i0e(o, r.data.query)).map((l) => ({
								...l,
								file: { ...o, range: void 0, fullRange: l.range },
							})),
						),
					)
				).flat(),
				s = s0e(i, r.data.query, { fuseSearch: { limit: 1 }, fuseInit: qW })
			return { type: "find-symbol-response", data: s }
		}
		findSymbols = async (r) => {
			if (!adt(r.data.query)) return { type: "find-symbol-response", data: [] }
			let n = await this.getAllFilteredTokens(r.data.searchScope.files ?? [], {
					filter: !0,
					forceRefresh: !1,
				}),
				i = s0e(n, r.data.query, { fuseSearch: { limit: 1 }, fuseInit: qW })
			return { type: "find-symbol-response", data: i }
		}
		warmupCache = async (r) => {
			let n = this._workspaceManager.getAllPathNames(r)[0]
			if (!n) return
			let i = { repoRoot: n.rootPath, pathName: n.relPath }
			await this._getAllFileTokens(i)
		}
		getAllFilteredTokens = async (r, n) => {
			let i = async (s) => {
				let o = await this._getAllFileTokens(s, n.forceRefresh)
				if (!o) return []
				if (!n.filter || !s.fullRange) return o
				let a = kx(s.fullRange)
				return o.filter((l) => {
					let c = kx(l.range)
					return a.contains(c)
				})
			}
			return (await Promise.all(r.map(i))).flat()
		}
		_loadFileDetailSymbols = async (r, n, { context: i }) => {
			let s = Rk.Uri.file(i.absPath),
				o = !0,
				a = new Promise((l) =>
					setTimeout(() => {
						l(void 0), (o = !1)
					}, i.timeoutMs),
				)
			for (; o; )
				try {
					let l = new Promise((u) => setTimeout(u, 4e3)),
						c = await Promise.race([n0e(s), a])
					if (c === void 0 || c.length > 0) return c ?? []
					await l
				} catch (l) {
					return (
						this._logger.error(
							`Failed to load symbols for ${i.absPath}: ${l instanceof Error ? l.message : String(l)}`,
						),
						[]
					)
				}
			return []
		}
		_getAllFileTokens = async (r, n = !1) => {
			let i = this._getCurrFileDetails(r)
			if (i === void 0) return []
			let s = this._getCurrBlobName(i)
			if (!s) return []
			try {
				let o = await this._fileTokensCache.cache.fetch(s, {
					context: { absPath: Sk(i), blobName: s, timeoutMs: odt },
					forceRefresh: n,
				})
				return o
					? o.map((a) => ({
							name: a.name,
							kind: a.kind,
							range: a.range,
							selectionRange: a.selectionRange,
							detail: a.detail,
							tags: a.tags || [],
							children: [],
							file: { ...r, range: void 0, fullRange: a.range },
						}))
					: []
			} catch (o) {
				let a = o instanceof Error ? o.message : String(o)
				return this._logger.error(`Failed to read file tokens for ${s}: ${a}`), []
			}
		}
		_getCurrBlobName = (r) => {
			let n = new Je(r.repoRoot, r.pathName)
			return this._workspaceManager.getBlobName(n)
		}
		_getCurrFileDetails = (r) => {
			let n = this._workspaceManager.getAllQualifiedPathNames(r.pathName)
			return n.length ? { ...r, repoRoot: n[0].rootPath, pathName: n[0].relPath } : void 0
		}
	}