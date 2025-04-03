
var nN = class {
	constructor(t) {
		this._git = t
	}
	async getWorkingDirectoryChanges() {
		let t = `
`,
			r = [],
			n = new Set(),
			i = await this._git.diff({ hash1: "HEAD", nameStatus: !0 })
		if (i) {
			r = rN(i)
			for (let o of r.slice(0, 50)) o.afterPath !== void 0 && n.add(o.afterPath)
		}
		let s = await this._git.lsFiles({ others: !0, excludeStandard: !0 })
		if (s) {
			let o = s
				.split(t)
				.filter((a) => a.trim().length > 0 && !n.has(a))
				.map((a) => ({
					afterPath: a,
					beforePath: void 0,
					changeType: "ADDED",
				}))
			r = r.concat(o)
		}
		return r
	}
	async _getDefaultBranch() {
		let t = "refs/remotes/origin",
			r = await this._git.symbolicRef({ name: `${t}/HEAD` })
		if (r) return r.trim().replace(t + "/", "")
	}
	async _getCommitHashes() {
		let t = "%H",
			r = `
`,
			n = await this._getDefaultBranch()
		return (
			(
				await this._git.log({
					commit1: n,
					commit2: "HEAD",
					noMerges: !0,
					format: t,
					not: n,
				})
			)?.split(r) ?? []
		)
	}
	async getCommitChanges() {
		let t = `
`,
			r = {},
			n = await this._getCommitHashes()
		for (let i of n) {
			let s = await this._git.show({ object: i, nameStatus: !0, oneLine: !0 }),
				o = s?.slice(s.indexOf(t) + 1)
			if (o == null) throw new Error(`Could not get commit changes for commit ${i}`)
			let a = rN(o)
			r[i] = a
		}
		return r
	}
	async getFileWorkingDirectoryChange(t) {
		let r = await this._git.diff({ hash1: "HEAD", nameStatus: !0, relPath: t })
		if (r) {
			let i = rN(r)
			if (i.length > 0) return i[0]
		}
		if ((await this._git.lsFiles({ others: !0, excludeStandard: !0, relPath: t }))?.trim() === t)
			return { afterPath: t, beforePath: void 0, changeType: "ADDED" }
	}
	async getFileContentForCommit(t, r) {
		let n = await this._git.show({ object: `${r}:${t}` })
		if (n === void 0) throw new Error(`Could not find file ${t} in commit ${r}`)
		return n
	}
	async getFileContentBeforeCommit(t, r) {
		return this.getFileContentForCommit(t, `${r}^`)
	}
}