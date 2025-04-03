
var PC = class {
		constructor(t, r, n, i) {
			this._name = t
			this._startUri = r
			this._rootUri = n
			this._pathFilter = i
			if (!U_.isAbsolute(r.fsPath))
				throw new Error(`PathIterator[${this._name}]: startUri ${this._name} must contain an absolute pathname`)
			if (!U_.isAbsolute(n.fsPath))
				throw new Error(
					`PathIterator[${this._name}]: rootUri ${n.toString()} must contain an absolute pathname`,
				)
			if (!Ss(as(n), as(r)))
				throw new Error(
					`PathIterator[${this._name}]: startUri ${as(
						this._startUri,
					)} must be inside rootUri ${as(this._rootUri)}`,
				)
			this._logger.verbose(
				`Created PathIterator for startUri ${this._startUri.fsPath}, rootUri ${this._rootUri.fsPath}`,
			)
		}
		stats = new NC("Path metrics")
		_logger = X("PathIterator")
		_dirsEmitted = this.stats.counterMetric("directories emitted")
		_filesEmitted = this.stats.counterMetric("files emitted")
		_otherEmitted = this.stats.counterMetric("other paths emitted")
		_totalEmitted = this.stats.counterMetric("total paths emitted")
		_readDirMs = this.stats.timingMetric("readDir")
		_filterMs = this.stats.timingMetric("filter")
		_yieldMs = this.stats.timingMetric("yield")
		_totalMs = this.stats.timingMetric("total")
		async *[Symbol.asyncIterator]() {
			this._totalMs.start()
			let t = 200,
				r = Date.now(),
				n = new Array()
			n.push(this._startUri)
			let i
			for (; (i = n.pop()) !== void 0; ) {
				Date.now() - r >= t && (await new Promise((c) => setTimeout(c, 0)), (r = Date.now()))
				let o = Yd(this._rootUri, i),
					a = this._pathFilter.makeLocalPathFilter(o)
				this._readDirMs.start()
				let l = bx(i.fsPath)
				this._readDirMs.stop()
				for (let [c, u] of l) {
					if (
						(Date.now() - r >= t && (await new Promise((C) => setTimeout(C, 0)), (r = Date.now())),
						c === "." || c === "..")
					)
						continue
					this._filterMs.start()
					let p = L8.Uri.joinPath(i, c),
						g = $t(o, c, u === "Directory"),
						m = a.getPathInfo(g, u)
					this._filterMs.stop()
					let y = g
					u === "File"
						? this._filesEmitted.increment()
						: u === "Directory"
							? ((y = wy(g)), this._dirsEmitted.increment())
							: this._otherEmitted.increment(),
						this._totalEmitted.increment(),
						this._yieldMs.start(),
						yield [p, y, u, m],
						this._yieldMs.stop(),
						u === "Directory" && m.accepted && n.push(p)
				}
			}
			this._totalMs.stop()
		}
	},
	Q8 = class extends ag {
		constructor(r) {
			super()
			this.extension = r
		}
		format() {
			return `Unsupported file extension (${this.extension})`
		}
	},
	jQ = class {
		_fileExtensions
		constructor(t) {
			if (t) {
				this._fileExtensions = new Set()
				for (let r of t) this._fileExtensions.add(r.toLowerCase())
			} else this._fileExtensions = void 0
		}
		acceptsPath(t, r = "File") {
			return this.getPathInfo(t, r).accepted
		}
		getPathInfo(t, r = "File") {
			if (r === "File") {
				let i = U_.extname(t)
				if (this._fileExtensions !== void 0 && !this._fileExtensions.has(i.toLowerCase())) return new Q8(i)
			} else r === "Directory" && !t.endsWith("/") && (t += "/")
			let n = this._getIgnoreStack(_c(t))
			return n === void 0 ? new lg() : n.getPathInfo(t)
		}
	},
	N8 = class extends jQ {
		constructor(r, n) {
			super(n)
			this._ignorePathMap = r
		}
		makeLocalPathFilter(r) {
			let n = this._getIgnoreStack(r)
			return new P8(n, this._fileExtensions)
		}
		_getIgnoreStack(r) {
			if (Qh(r)) throw new Error(`Absolute path ${r} passed to PathFilter`)
			let n = r
			for (let i = 0; i < 1e4; i++) {
				let s = this._ignorePathMap.get(n)
				if (s) return s
				if (_c(n) === n) return
				n = _c(n)
			}
			throw new Error(`Too-deep or malformed directory name ${r}`)
		}
	},
	P8 = class extends jQ {
		constructor(r, n) {
			super(n)
			this._ignoreStack = r
		}
		_getIgnoreStack(r) {
			return this._ignoreStack
		}
	}