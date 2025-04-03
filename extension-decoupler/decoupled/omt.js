
var Omt = Se({
		"src/lib/tasks/tag.ts"() {
			"use strict"
			Nmt()
		},
	}),
	qmt = ipt({
		"src/git.js"(e, t) {
			"use strict"
			var { GitExecutor: r } = (Hpt(), li(tEe)),
				{ SimpleGitApi: n } = (qAt(), li(QEe)),
				{ Scheduler: i } = (VAt(), li(NEe)),
				{ configurationErrorTask: s } = (Ci(), li(G4)),
				{
					asArray: o,
					filterArray: a,
					filterPrimitives: l,
					filterString: c,
					filterStringOrStringArray: u,
					filterType: f,
					getTrailingOptions: p,
					trailingFunctionArgument: g,
					trailingOptionsArgument: m,
				} = (wt(), li(wve)),
				{ applyPatchTask: y } = (WAt(), li(UEe)),
				{ branchTask: C, branchLocalTask: v, deleteBranchesTask: b, deleteBranchTask: w } = (tmt(), li(GEe)),
				{ checkIgnoreTask: B } = (imt(), li(KEe)),
				{ checkIsRepoTask: M } = (Dve(), li(Ive)),
				{ cloneTask: Q, cloneMirrorTask: O } = (amt(), li(JEe)),
				{ cleanWithOptionsTask: Y, isCleanOptionsArray: j } = (Ove(), li(Lve)),
				{ diffSummaryTask: ne } = (CG(), li(gEe)),
				{ fetchTask: q } = (fmt(), li(ZEe)),
				{ moveTask: me } = (Amt(), li(ebe)),
				{ pullTask: Qe } = (ymt(), li(tbe)),
				{ pushTagsTask: N } = (DEe(), li(BEe)),
				{
					addRemoteTask: re,
					getRemotesTask: K,
					listRemotesTask: se,
					remoteTask: Ze,
					removeRemoteTask: It,
				} = (Smt(), li(nbe)),
				{ getResetMode: Ce, resetTask: Et } = (Zve(), li(Jve)),
				{ stashListTask: jt } = (Dmt(), li(ibe)),
				{
					addSubModuleTask: Ar,
					initSubModuleTask: de,
					subModuleTask: Tr,
					updateSubModuleTask: tr,
				} = (Mmt(), li(sbe)),
				{ addAnnotatedTagTask: Nr, addTagTask: Ve, tagListTask: en } = (Omt(), li(lbe)),
				{ straightThroughBufferTask: Pr, straightThroughStringTask: cr } = (Ci(), li(G4))
			function be(fe, Ee) {
				;(this._plugins = Ee),
					(this._executor = new r(fe.baseDir, new i(fe.maxConcurrentProcesses), Ee)),
					(this._trimmed = fe.trimmed)
			}
			;((be.prototype = Object.create(n.prototype)).constructor = be),
				(be.prototype.customBinary = function (fe) {
					return this._plugins.reconfigure("binary", fe), this
				}),
				(be.prototype.env = function (fe, Ee) {
					return (
						arguments.length === 1 && typeof fe == "object"
							? (this._executor.env = fe)
							: ((this._executor.env = this._executor.env || {})[fe] = Ee),
						this
					)
				}),
				(be.prototype.stashList = function (fe) {
					return this._runTask(jt(m(arguments) || {}, (a(fe) && fe) || []), g(arguments))
				})
			function Rr(fe, Ee, bt, sn) {
				return typeof bt != "string"
					? s(`git.${fe}() requires a string 'repoPath'`)
					: Ee(bt, f(sn, c), p(arguments))
			}
			;(be.prototype.clone = function () {
				return this._runTask(Rr("clone", Q, ...arguments), g(arguments))
			}),
				(be.prototype.mirror = function () {
					return this._runTask(Rr("mirror", O, ...arguments), g(arguments))
				}),
				(be.prototype.mv = function (fe, Ee) {
					return this._runTask(me(fe, Ee), g(arguments))
				}),
				(be.prototype.checkoutLatestTag = function (fe) {
					var Ee = this
					return this.pull(function () {
						Ee.tags(function (bt, sn) {
							Ee.checkout(sn.latest, fe)
						})
					})
				}),
				(be.prototype.pull = function (fe, Ee, bt, sn) {
					return this._runTask(Qe(f(fe, c), f(Ee, c), p(arguments)), g(arguments))
				}),
				(be.prototype.fetch = function (fe, Ee) {
					return this._runTask(q(f(fe, c), f(Ee, c), p(arguments)), g(arguments))
				}),
				(be.prototype.silent = function (fe) {
					return (
						console.warn(
							"simple-git deprecation notice: git.silent: logging should be configured using the `debug` library / `DEBUG` environment variable, this will be an error in version 3",
						),
						this
					)
				}),
				(be.prototype.tags = function (fe, Ee) {
					return this._runTask(en(p(arguments)), g(arguments))
				}),
				(be.prototype.rebase = function () {
					return this._runTask(cr(["rebase", ...p(arguments)]), g(arguments))
				}),
				(be.prototype.reset = function (fe) {
					return this._runTask(Et(Ce(fe), p(arguments)), g(arguments))
				}),
				(be.prototype.revert = function (fe) {
					let Ee = g(arguments)
					return typeof fe != "string"
						? this._runTask(s("Commit must be a string"), Ee)
						: this._runTask(cr(["revert", ...p(arguments, 0, !0), fe]), Ee)
				}),
				(be.prototype.addTag = function (fe) {
					let Ee = typeof fe == "string" ? Ve(fe) : s("Git.addTag requires a tag name")
					return this._runTask(Ee, g(arguments))
				}),
				(be.prototype.addAnnotatedTag = function (fe, Ee) {
					return this._runTask(Nr(fe, Ee), g(arguments))
				}),
				(be.prototype.deleteLocalBranch = function (fe, Ee, bt) {
					return this._runTask(w(fe, typeof Ee == "boolean" ? Ee : !1), g(arguments))
				}),
				(be.prototype.deleteLocalBranches = function (fe, Ee, bt) {
					return this._runTask(b(fe, typeof Ee == "boolean" ? Ee : !1), g(arguments))
				}),
				(be.prototype.branch = function (fe, Ee) {
					return this._runTask(C(p(arguments)), g(arguments))
				}),
				(be.prototype.branchLocal = function (fe) {
					return this._runTask(v(), g(arguments))
				}),
				(be.prototype.raw = function (fe) {
					let Ee = !Array.isArray(fe),
						bt = [].slice.call(Ee ? arguments : fe, 0)
					for (let yn = 0; yn < bt.length && Ee; yn++)
						if (!l(bt[yn])) {
							bt.splice(yn, bt.length - yn)
							break
						}
					bt.push(...p(arguments, 0, !0))
					var sn = g(arguments)
					return bt.length
						? this._runTask(cr(bt, this._trimmed), sn)
						: this._runTask(s("Raw: must supply one or more command to execute"), sn)
				}),
				(be.prototype.submoduleAdd = function (fe, Ee, bt) {
					return this._runTask(Ar(fe, Ee), g(arguments))
				}),
				(be.prototype.submoduleUpdate = function (fe, Ee) {
					return this._runTask(tr(p(arguments, !0)), g(arguments))
				}),
				(be.prototype.submoduleInit = function (fe, Ee) {
					return this._runTask(de(p(arguments, !0)), g(arguments))
				}),
				(be.prototype.subModule = function (fe, Ee) {
					return this._runTask(Tr(p(arguments)), g(arguments))
				}),
				(be.prototype.listRemote = function () {
					return this._runTask(se(p(arguments)), g(arguments))
				}),
				(be.prototype.addRemote = function (fe, Ee, bt) {
					return this._runTask(re(fe, Ee, p(arguments)), g(arguments))
				}),
				(be.prototype.removeRemote = function (fe, Ee) {
					return this._runTask(It(fe), g(arguments))
				}),
				(be.prototype.getRemotes = function (fe, Ee) {
					return this._runTask(K(fe === !0), g(arguments))
				}),
				(be.prototype.remote = function (fe, Ee) {
					return this._runTask(Ze(p(arguments)), g(arguments))
				}),
				(be.prototype.tag = function (fe, Ee) {
					let bt = p(arguments)
					return bt[0] !== "tag" && bt.unshift("tag"), this._runTask(cr(bt), g(arguments))
				}),
				(be.prototype.updateServerInfo = function (fe) {
					return this._runTask(cr(["update-server-info"]), g(arguments))
				}),
				(be.prototype.pushTags = function (fe, Ee) {
					let bt = N({ remote: f(fe, c) }, p(arguments))
					return this._runTask(bt, g(arguments))
				}),
				(be.prototype.rm = function (fe) {
					return this._runTask(cr(["rm", "-f", ...o(fe)]), g(arguments))
				}),
				(be.prototype.rmKeepLocal = function (fe) {
					return this._runTask(cr(["rm", "--cached", ...o(fe)]), g(arguments))
				}),
				(be.prototype.catFile = function (fe, Ee) {
					return this._catFile("utf-8", arguments)
				}),
				(be.prototype.binaryCatFile = function () {
					return this._catFile("buffer", arguments)
				}),
				(be.prototype._catFile = function (fe, Ee) {
					var bt = g(Ee),
						sn = ["cat-file"],
						yn = Ee[0]
					if (typeof yn == "string")
						return this._runTask(s("Git.catFile: options must be supplied as an array of strings"), bt)
					Array.isArray(yn) && sn.push.apply(sn, yn)
					let Ei = fe === "buffer" ? Pr(sn) : cr(sn)
					return this._runTask(Ei, bt)
				}),
				(be.prototype.diff = function (fe, Ee) {
					let bt = c(fe)
						? s(
								"git.diff: supplying options as a single string is no longer supported, switch to an array of strings",
							)
						: cr(["diff", ...p(arguments)])
					return this._runTask(bt, g(arguments))
				}),
				(be.prototype.diffSummary = function () {
					return this._runTask(ne(p(arguments, 1)), g(arguments))
				}),
				(be.prototype.applyPatch = function (fe) {
					let Ee = u(fe)
						? y(o(fe), p([].slice.call(arguments, 1)))
						: s("git.applyPatch requires one or more string patches as the first argument")
					return this._runTask(Ee, g(arguments))
				}),
				(be.prototype.revparse = function () {
					let fe = ["rev-parse", ...p(arguments, !0)]
					return this._runTask(cr(fe, !0), g(arguments))
				}),
				(be.prototype.clean = function (fe, Ee, bt) {
					let sn = j(fe),
						yn = (sn && fe.join("")) || f(fe, c) || "",
						Ei = p([].slice.call(arguments, sn ? 1 : 0))
					return this._runTask(Y(yn, Ei), g(arguments))
				}),
				(be.prototype.exec = function (fe) {
					let Ee = {
						commands: [],
						format: "utf-8",
						parser() {
							typeof fe == "function" && fe()
						},
					}
					return this._runTask(Ee)
				}),
				(be.prototype.clearQueue = function () {
					return this
				}),
				(be.prototype.checkIgnore = function (fe, Ee) {
					return this._runTask(B(o(f(fe, u, []))), g(arguments))
				}),
				(be.prototype.checkIsRepo = function (fe, Ee) {
					return this._runTask(M(f(fe, c)), g(arguments))
				}),
				(t.exports = be)
		},
	})