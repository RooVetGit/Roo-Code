
var O8 = class {
	constructor(t, r) {
		this._rootPath = t
		this.onDidChangeFile = r
	}
	async _getOpenTabs() {
		let t = []
		for (let r of tN.window.tabGroups.all)
			for (let n of r.tabs) {
				let i = n.input
				if (!ek(i, "uri")) continue
				let s = i.uri
				if (!(await ome(s.fsPath))) continue
				let a = null
				try {
					a = await tN.workspace.openTextDocument(s)
				} catch {
					continue
				}
				let l = a.isDirty
				t.push({ label: n.label, uri: s, isDirty: l })
			}
		return t
	}
	async getPathsWithBufferChanges() {
		let r = (await this._getOpenTabs()).filter((i) => i.isDirty && Ss(this._rootPath.fsPath, i.uri.fsPath)),
			n = []
		for (let i of r) {
			let s = Nh(this._rootPath.fsPath, i.uri.fsPath)
			s !== void 0 && n.push(s)
		}
		return n
	}
}