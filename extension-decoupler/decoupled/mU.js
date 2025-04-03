
var Mu = {
		keys: ["relPath"],
		minMatchCharLength: 1,
		minExactMatchCharLength: 3,
		threshold: 0.25,
		ignoreLocation: !0,
		includeScore: !0,
		useExtendedSearch: !0,
		shouldSort: !0,
		findAllMatches: !0,
		sortFn: edt,
	},
	Dk = class extends z {
		constructor(r, n, i) {
			super()
			this._globalState = r
			this._workspaceManager = n
			this._onDidChangeSyncingStatus = i
			;(this._filesIndex = new Mx(this._globalState, "fuzzyFsFilesIndex", {
				fuse: Mu,
				validator: this.validatePath,
				keyFn: jme,
			})),
				(this._foldersIndex = new Mx(this._globalState, "fuzzyFsFoldersIndex", {
					fuse: Mu,
					validator: this.validatePath,
					keyFn: jme,
				})),
				(this._recentFiles = new Uh(this._globalState, "recentlyOpenedFiles", {
					lru: { max: 64 },
				})),
				this.addDisposables(
					...this.trackFilesAndFolders(),
					this._recentFiles,
					Ba.window.onDidChangeActiveTextEditor(this.trackRecentTextEditor),
					Ba.window.onDidChangeVisibleTextEditors(this.onDidChangeVisibleTextEditors),
					Ba.window.tabGroups.onDidChangeTabs((s) => {
						s.changed.forEach(this.trackRecentTab), s.opened.forEach(this.trackRecentTab)
					}),
				)
		}
		_foldersIndex
		_filesIndex
		_recentFiles
		dispose = () => {
			super.dispose(), this._filesIndex.clear(), this._foldersIndex.clear()
		}
		get files() {
			return Object.values(this._filesIndex.items)
		}
		get folders() {
			return Object.values(this._foldersIndex.items)
		}
		setFiles = (r) => {
			let n = this._filesIndex.items
			r.forEach((a) => this._filesIndex.set(a))
			let i = this._filesIndex.items,
				o = Object.keys(n)
					.filter((a) => !i[a])
					.map((a) => n[a])
			this._filesIndex.markForRevalidation(o)
		}
		setFolders = (r) => {
			let n = this._foldersIndex.items
			r.forEach((a) => this._foldersIndex.set(a))
			let i = this._foldersIndex.items,
				o = Object.keys(n)
					.filter((a) => !i[a])
					.map((a) => n[a])
			this._foldersIndex.markForRevalidation(o)
		}
		trackRecentAbsPath = (r) => {
			let n = this._workspaceManager.resolvePathName(r)
			n === void 0 || this._workspaceManager.getBlobName(n) === void 0 || this._recentFiles.set(r, n)
		}
		trackRecentTab = (r) => {
			if (r.input instanceof Ba.TabInputText) {
				let n = r.input.uri.fsPath
				this.trackRecentAbsPath(n)
			} else return
		}
		trackRecentTextEditor = (r) => {
			r !== void 0 && this.trackRecentAbsPath(r.document.uri.fsPath)
		}
		onDidChangeVisibleTextEditors = () => {
			let r = Ba.window.visibleTextEditors
			for (let n of r) this.trackRecentTextEditor(n)
		}
		trackFilesAndFolders = () => {
			let r = (0, e0e.throttle)(
					() => {
						let { files: i, folders: s } = Xut(this._workspaceManager)
						this.setFiles(i), this.setFolders(s)
					},
					15e3,
					{ leading: !0, trailing: !0 },
				),
				n = (i) => {
					if (!i?.relPath) return
					this._workspaceManager.getAllQualifiedPathNames(i.relPath).forEach((o) => {
						this._filesIndex.set(o)
					})
				}
			return [
				new Ba.Disposable(() => r.cancel()),
				this._workspaceManager.onDidChangeFile(r),
				this._workspaceManager.onDidChangeFile(n),
				this._onDidChangeSyncingStatus(r),
			]
		}
		findRecentFiles = (r) => {
			let n = r.data.relPath,
				i = r.data.maxResults || 12,
				s = this._recentFiles.getItems().map((a) => ({ repoRoot: a.rootPath, pathName: a.relPath }))
			if (n.length < Mu.minMatchCharLength)
				return {
					type: "find-recently-opened-files-response",
					data: s.slice(0, i),
				}
			let o = zme(s, n, { fuseSearch: { limit: i }, fuseInit: Mu })
			return { type: "find-recently-opened-files-response", data: o }
		}
		findInScope = (r) => {
			let n = r.data.relPath,
				i = r.data.maxResults || 12
			return r.data.searchScope?.files
				? zme(r.data.searchScope.files, n, {
						fuseSearch: { limit: i },
						fuseInit: Mu,
					})
				: []
		}
		findFiles = (r) => {
			let n = r.data.exactMatch ?? !1,
				i = r.data.relPath,
				s = n ? `${i}$` : i,
				o = r.data.maxResults || 12
			if (n && (i.length < Mu.minExactMatchCharLength || i.length < Mu.minMatchCharLength))
				return { type: "find-file-response", data: [] }
			if (i.length < Mu.minMatchCharLength) {
				let u = Object.values(this._filesIndex.items).slice(0, 100)
				return { type: "find-file-response", data: u.map(Ph) }
			}
			let a = { type: "find-file-response", data: [] },
				l = this.findInScope(r)
			return (
				(a.data = UW([...a.data, ...l])),
				n && (a.data = Zme(a.data, i)),
				a.data.length >= o ||
					((a.data = UW([
						...a.data,
						...this._filesIndex.search(s, { limit: o - a.data.length }).map((c) => ({
							repoRoot: c.item.rootPath,
							pathName: c.item.relPath,
						})),
					])),
					n && (a.data = Zme(a.data, i))),
				a
			)
		}
		findFolders = (r) => {
			let n = r.data.exactMatch ?? !1,
				i = r.data.relPath,
				s = n ? `${i}$` : i,
				o = r.data.maxResults || 12
			if (i.length < Mu.minMatchCharLength) {
				let u = Object.values(this._foldersIndex.items).slice(0, 100)
				return { type: "find-folder-response", data: u.map(Ph) }
			}
			let a = { type: "find-folder-response", data: [] },
				l = this._foldersIndex.search(s, { limit: o }).map((c) => Ph(c.item))
			return (a.data = UW([...a.data, ...l])), a
		}
		validatePath = async (r) => this.statPath(r).then((n) => n !== void 0)
		statPath = async (r) => {
			if (
				(await this._workspaceManager.awaitInitialFoldersEnumerated(),
				!!this._workspaceManager.getFolderRoot(Bs(r)))
			)
				try {
					return await xy(Bs(r))
				} catch {
					return
				}
		}
	}