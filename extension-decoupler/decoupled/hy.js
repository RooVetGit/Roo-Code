
var dbe = {
		added_file_stats: {
			changed_file_count: 0,
			per_file_change_stats_head: [],
			per_file_change_stats_tail: [],
		},
		broken_file_stats: {
			changed_file_count: 0,
			per_file_change_stats_head: [],
			per_file_change_stats_tail: [],
		},
		copied_file_stats: {
			changed_file_count: 0,
			per_file_change_stats_head: [],
			per_file_change_stats_tail: [],
		},
		deleted_file_stats: {
			changed_file_count: 0,
			per_file_change_stats_head: [],
			per_file_change_stats_tail: [],
		},
		modified_file_stats: {
			changed_file_count: 0,
			per_file_change_stats_head: [],
			per_file_change_stats_tail: [],
		},
		renamed_file_stats: {
			changed_file_count: 0,
			per_file_change_stats_head: [],
			per_file_change_stats_tail: [],
		},
		unmerged_file_stats: {
			changed_file_count: 0,
			per_file_change_stats_head: [],
			per_file_change_stats_tail: [],
		},
		unknown_file_stats: {
			changed_file_count: 0,
			per_file_change_stats_head: [],
			per_file_change_stats_tail: [],
		},
	},
	Hy = class {
		git
		constructor(t) {
			try {
				this.git = ube({
					baseDir: t,
					binary: "git",
					maxConcurrentProcesses: 6,
					trimmed: !1,
				})
			} catch {
				this.git = void 0
			}
		}
		countTokens(t) {
			return Math.ceil(t.length / 3)
		}
		async getChangedFileStats(t) {
			let r = await this.git.status(),
				n = ["created", "deleted", "modified", "renamed"],
				i = dbe,
				s = new Set(r.staged)
			for (let o of n) {
				let a = []
				if (
					(o === "renamed" ? (a = r.renamed.map((l) => l.to)) : (a = r[o]),
					t.onlyUseStagedChanges && (a = a.filter((l) => s.has(l))),
					a.length > 0)
				) {
					let l = o
					o === "created" && (l = "added")
					let c = `${l}_file_stats`
					i[c].changed_file_count = a.length
					let u = await Promise.all(
							a.map(async (g) => {
								let { insertions: m, deletions: y } = await this.getInsertionDeletionStats(
									t.onlyUseStagedChanges,
									[g],
								)
								return {
									file_path: g,
									insertion_count: m,
									deletion_count: y,
									old_file_path: (o === "renamed" && r.renamed.find((C) => C.to === g)?.from) || g,
								}
							}),
						),
						f = u.slice(0, 5),
						p = u.slice(-5)
					;(i[c].per_file_change_stats_head = f),
						(i[c].per_file_change_stats_tail = p.filter((g) => !f.find((m) => m.file_path === g.file_path)))
				}
			}
			return i
		}
		async getInsertionDeletionStats(t, r) {
			let n = ["--staged", "--shortstat"].concat(r),
				i = await this.git.diff(n)
			if (!t) {
				let l = ["--shortstat"].concat(r)
				i += await this.git.diff(l)
			}
			let s = i.split(",").map((l) => l.trim()),
				o = parseInt(s.find((l) => l.includes("insertion"))?.split(" ")[0] || "0"),
				a = parseInt(s.find((l) => l.includes("deletion"))?.split(" ")[0] || "0")
			return { insertions: o, deletions: a }
		}
		/**
		 * Returns a truncated version of the diff stats.
		 * @param {TruncateDiffsOptions} t - The options to control the truncation.
		 * @param {string[]} r - The list of files to get the diff stats for.
		 * @returns {Promise<TruncatedDiffStats>} - The truncated diff stats.
		 */
		async getTruncatedDiffs(t, r) {
			/**
			 * @typedef {Object} TruncatedDiffStats
			 * @property {number} insertions - The total number of insertions.
			 * @property {number} deletions - The total number of deletions.
			 * @property {string[]} topFiles - The first 5 files with the most changes.
			 * @property {string[]} bottomFiles - The last 5 files with the most changes.
			 */

			/**
			 * @typedef {Object} TruncateDiffsOptions
			 * @property {boolean} [onlyUseStagedChanges] - Whether to only use staged changes.
			 * @property {number} [diffNoopLineLimit] - The maximum number of lines changed that is considered a "noop".
			 */

			let { insertions: n, deletions: i } = await this.getInsertionDeletionStats(t.onlyUseStagedChanges, [])
			if (n + i <= t.diffNoopLineLimit) {
				let o = await this.git.diff(["--staged", "--name-only"])
				t.onlyUseStagedChanges || (o += await this.git.diff(["--name-only"]))
				let a = o
						.split(
							`
`,
						)
						.filter(Boolean),
					l = await Promise.all(
						a.map(async (f) => {
							let p = await this.git.diff(["--staged", f])
							return (
								t.onlyUseStagedChanges || (p += await this.git.diff([f])),
								{ fileName: f, diff: p, tokens: this.countTokens(p) }
							)
						}),
					)
				l.sort((f, p) => f.tokens - p.tokens)
				let c = "",
					u = r
				for (let f of l)
					if (u + f.tokens <= t.diffBudget)
						(c +=
							f.diff +
							`
`),
							(u += f.tokens)
					else break
				return c.trim()
			} else {
				let o = await this.git.diff(["--staged"])
				return (
					t.onlyUseStagedChanges || (o += await this.git.diff([])),
					o
						.split(
							`
`,
						)
						.slice(0, t.diffNoopLineLimit)
						.join(
							`
`,
						)
						.slice(0, t.diffBudget - r)
				)
			}
		}
		async getCommitMessages(t) {
			return (await this.git.log({ maxCount: t })).all.map((n) => n.message)
		}
		async getCurrentAuthor() {
			let r = (await this.git.listConfig()).all["user.email"]
			return Array.isArray(r) ? r[0] || void 0 : r || void 0
		}
		getExampleCommitMessages(t, r, n, i) {
			let s = [],
				o = 0
			for (let a of t.slice(r.length)) {
				if (s.length >= i - r.length) break
				let l = this.countTokens(a)
				if (o + l <= n) s.push(a), (o += l)
				else break
			}
			return s
		}
		async getRelevantCommitMessages(t, r) {
			return this.git.log({ maxCount: 3 }).then((n) =>
				n.all
					.filter((i) => i.author_email === t.trim())
					.map((i) => i.message)
					.reduce((i, s) => {
						let o = this.countTokens(s)
						return (
							this.countTokens(
								i.join(`
`),
							) +
								o <=
								r && i.push(s),
							i
						)
					}, []),
			)
		}
		async getCommitMessagePromptData(t) {
			if (!this.git)
				return {
					changedFileStats: dbe,
					diff: "",
					generatedCommitMessageSubrequest: {
						relevant_commit_messages: [],
						example_commit_messages: [],
					},
				}
			let r = await this.getChangedFileStats(t),
				n = this.countTokens(JSON.stringify(r)),
				i = await this.getTruncatedDiffs(t, n),
				s = await this.getCommitMessages(32),
				o = await this.getCurrentAuthor(),
				a = [],
				l = []
			if (o) {
				a = await this.getRelevantCommitMessages(o, t.relevantMessageSubbudget)
				let c = this.countTokens(
						a.join(`
`),
					),
					u = t.messageBudget - c
				l = this.getExampleCommitMessages(s, a, u, t.maxExampleCommitMessages)
			}
			return {
				changedFileStats: r,
				diff: i,
				generatedCommitMessageSubrequest: {
					relevant_commit_messages: a,
					example_commit_messages: l,
				},
			}
		}
	}