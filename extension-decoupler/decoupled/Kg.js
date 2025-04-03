
var KG = W(require("vscode")),
	e1 = class extends z {
		constructor(r) {
			super()
			this._panel = r
			if (((this._asyncMsgHandler = Ti(this._panel.webview)), !KG.workspace.workspaceFolders?.[0]))
				throw new Error("No workspace folder found")
		}
		_asyncMsgHandler
		execOptions = { cwd: KG.workspace.workspaceFolders?.[0].uri.fsPath }
		register() {
			this._asyncMsgHandler.registerHandler(
				"get-git-branches-request",
				this.handleGetGitBranchesRequest.bind(this),
			),
				this._asyncMsgHandler.registerHandler(
					"get-workspace-diff-request",
					this.handleGetWorkspaceDiffRequest.bind(this),
				),
				this._asyncMsgHandler.registerHandler(
					"get-remote-url-request",
					this.handleGetRemoteUrlRequest.bind(this),
				),
				this._asyncMsgHandler.registerHandler("git-fetch-request", this.handleGitFetchRequest.bind(this)),
				this._asyncMsgHandler.registerHandler(
					"is-git-repository-request",
					this.handleIsGitRepositoryRequest.bind(this),
				)
		}
		dispose() {
			this._asyncMsgHandler.dispose()
		}
		async handleGetGitBranchesRequest(r) {
			try {
				let { prefix: n = "" } = r.data,
					{ execOptions: i } = this,
					s = [],
					o = (await Eo("git branch --show-current", i))?.trim(),
					a = !!(await Eo("git branch -r | grep $(git branch --show-current)", i)),
					l = (await Eo("git symbolic-ref --short refs/remotes/origin/HEAD", i))?.trim(),
					f = (await Eo("git branch --list --remote | sed 's/^[ *]*//'", i))
						?.split(
							`
`,
						)
						.filter(Boolean)
						?.map((p) => {
							if (!(p === o || p === l) && p.includes(n)) return p
						})
						.filter(Boolean)
				return (
					o && f?.unshift(o),
					l && f?.unshift(l),
					f?.forEach((p) => {
						s.push({
							name: p.trim(),
							isRemote: p === o ? a : !0,
							isCurrentBranch: p === o,
							isDefault: p === l,
						})
					}),
					{ type: "get-git-branches-response", data: { branches: s } }
				)
			} catch (n) {
				return (
					console.error("Failed to get git branches:", n),
					{ type: "get-git-branches-response", data: { branches: [] } }
				)
			}
		}
		async handleGetWorkspaceDiffRequest(r) {
			try {
				let { branchName: n } = r.data,
					i = (await Eo(`git diff origin/${n} || true`, this.execOptions)) || "",
					s = (await Eo("git ls-files --others --exclude-standard", this.execOptions)) || ""
				for (let o of s.trimEnd().split(`
`) || [])
					i += (await Eo(`git diff --no-index /dev/null ${o} || true`, this.execOptions)) || ""
				return { type: "get-workspace-diff-response", data: { diff: i } }
			} catch (n) {
				return (
					console.error("Failed to get workspace diff:", n),
					{ type: "get-workspace-diff-response", data: { diff: "" } }
				)
			}
		}
		async handleGetRemoteUrlRequest(r) {
			let { execOptions: n } = this
			try {
				let i = (await Eo("git remote get-url origin", n))?.trim()
				if (!i) throw new Error("Failed to get remote url, no remote found")
				if ((i?.startsWith("https://") ? "https" : "ssh") === "https")
					return { type: "get-remote-url-response", data: { remoteUrl: i } }
				{
					let o = i.replace("git@", "https://").replace(".com:", ".com/").replace(".git", "")
					return { type: "get-remote-url-response", data: { remoteUrl: o } }
				}
			} catch (i) {
				return (
					console.error("Failed to get remote url:", i),
					{ type: "get-remote-url-response", data: { remoteUrl: "" } }
				)
			}
		}
		async handleGitFetchRequest(r) {
			try {
				return await Eo("git fetch", this.execOptions), { type: "git-fetch-response" }
			} catch (n) {
				return console.error("Failed to fetch remote branch:", n), { type: "git-fetch-response" }
			}
		}
		async handleIsGitRepositoryRequest(r) {
			try {
				let n = !!(await Eo("git rev-parse --is-inside-work-tree 2>/dev/null", this.execOptions))
				return (
					console.log("isGitRepository: ", n),
					{ type: "is-git-repository-response", data: { isGitRepository: n } }
				)
			} catch (n) {
				return (
					console.error("Failed to check if is git repository:", n),
					{ type: "is-git-repository-response", data: { isGitRepository: !1 } }
				)
			}
		}
	}