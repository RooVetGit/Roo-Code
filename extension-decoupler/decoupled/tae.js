
var tAe = x((KTt, eAe) => {
	"use strict"
	var Wd = require("fs"),
		Hs = require("path"),
		Alt = $ge(),
		mlt = require("zlib"),
		{ MESSAGE: ylt } = Bi(),
		{ Stream: Clt, PassThrough: Xpe } = dy(),
		vlt = Dh(),
		yc = cx()("winston:file"),
		Elt = require("os"),
		blt = Zpe()
	eAe.exports = class extends vlt {
		constructor(t = {}) {
			super(t), (this.name = t.name || "file")
			function r(n, ...i) {
				i.slice(1).forEach((s) => {
					if (t[s]) throw new Error(`Cannot set ${s} and ${n} together`)
				})
			}
			if (
				((this._stream = new Xpe()),
				this._stream.setMaxListeners(30),
				(this._onError = this._onError.bind(this)),
				t.filename || t.dirname)
			)
				r("filename or dirname", "stream"),
					(this._basename = this.filename = t.filename ? Hs.basename(t.filename) : "winston.log"),
					(this.dirname = t.dirname || Hs.dirname(t.filename)),
					(this.options = t.options || { flags: "a" })
			else if (t.stream)
				console.warn("options.stream will be removed in winston@4. Use winston.transports.Stream"),
					r("stream", "filename", "maxsize"),
					(this._dest = this._stream.pipe(this._setupStream(t.stream))),
					(this.dirname = Hs.dirname(this._dest.path))
			else throw new Error("Cannot log to file without filename or stream.")
			;(this.maxsize = t.maxsize || null),
				(this.rotationFormat = t.rotationFormat || !1),
				(this.zippedArchive = t.zippedArchive || !1),
				(this.maxFiles = t.maxFiles || null),
				(this.eol = typeof t.eol == "string" ? t.eol : Elt.EOL),
				(this.tailable = t.tailable || !1),
				(this.lazy = t.lazy || !1),
				(this._size = 0),
				(this._pendingSize = 0),
				(this._created = 0),
				(this._drain = !1),
				(this._opening = !1),
				(this._ending = !1),
				(this._fileExist = !1),
				this.dirname && this._createLogDirIfNotExist(this.dirname),
				this.lazy || this.open()
		}
		finishIfEnding() {
			this._ending &&
				(this._opening
					? this.once("open", () => {
							this._stream.once("finish", () => this.emit("finish")),
								setImmediate(() => this._stream.end())
						})
					: (this._stream.once("finish", () => this.emit("finish")), setImmediate(() => this._stream.end())))
		}
		log(t, r = () => {}) {
			if (this.silent) return r(), !0
			if (this._drain) {
				this._stream.once("drain", () => {
					;(this._drain = !1), this.log(t, r)
				})
				return
			}
			if (this._rotate) {
				this._stream.once("rotate", () => {
					;(this._rotate = !1), this.log(t, r)
				})
				return
			}
			if (this.lazy) {
				if (!this._fileExist) {
					this._opening || this.open(),
						this.once("open", () => {
							;(this._fileExist = !0), this.log(t, r)
						})
					return
				}
				if (this._needsNewFile(this._pendingSize)) {
					this._dest.once("close", () => {
						this._opening || this.open(),
							this.once("open", () => {
								this.log(t, r)
							})
					})
					return
				}
			}
			let n = `${t[ylt]}${this.eol}`,
				i = Buffer.byteLength(n)
			function s() {
				if (
					((this._size += i),
					(this._pendingSize -= i),
					yc("logged %s %s", this._size, n),
					this.emit("logged", t),
					!this._rotate && !this._opening && this._needsNewFile())
				) {
					if (this.lazy) {
						this._endStream(() => {
							this.emit("fileclosed")
						})
						return
					}
					;(this._rotate = !0), this._endStream(() => this._rotateFile())
				}
			}
			;(this._pendingSize += i),
				this._opening &&
					!this.rotatedWhileOpening &&
					this._needsNewFile(this._size + this._pendingSize) &&
					(this.rotatedWhileOpening = !0)
			let o = this._stream.write(n, s.bind(this))
			return (
				o
					? r()
					: ((this._drain = !0),
						this._stream.once("drain", () => {
							;(this._drain = !1), r()
						})),
				yc("written", o, this._drain),
				this.finishIfEnding(),
				o
			)
		}
		query(t, r) {
			typeof t == "function" && ((r = t), (t = {})), (t = f(t))
			let n = Hs.join(this.dirname, this.filename),
				i = "",
				s = [],
				o = 0,
				a = Wd.createReadStream(n, { encoding: "utf8" })
			a.on("error", (p) => {
				if ((a.readable && a.destroy(), !!r)) return p.code !== "ENOENT" ? r(p) : r(null, s)
			}),
				a.on("data", (p) => {
					p = (i + p).split(/\n+/)
					let g = p.length - 1,
						m = 0
					for (; m < g; m++) (!t.start || o >= t.start) && l(p[m]), o++
					i = p[g]
				}),
				a.on("close", () => {
					i && l(i, !0), t.order === "desc" && (s = s.reverse()), r && r(null, s)
				})
			function l(p, g) {
				try {
					let m = JSON.parse(p)
					u(m) && c(m)
				} catch (m) {
					g || a.emit("error", m)
				}
			}
			function c(p) {
				if (t.rows && s.length >= t.rows && t.order !== "desc") {
					a.readable && a.destroy()
					return
				}
				t.fields && (p = t.fields.reduce((g, m) => ((g[m] = p[m]), g), {})),
					t.order === "desc" && s.length >= t.rows && s.shift(),
					s.push(p)
			}
			function u(p) {
				if (!p || typeof p != "object") return
				let g = new Date(p.timestamp)
				if (!((t.from && g < t.from) || (t.until && g > t.until) || (t.level && t.level !== p.level))) return !0
			}
			function f(p) {
				return (
					(p = p || {}),
					(p.rows = p.rows || p.limit || 10),
					(p.start = p.start || 0),
					(p.until = p.until || new Date()),
					typeof p.until != "object" && (p.until = new Date(p.until)),
					(p.from = p.from || p.until - 24 * 60 * 60 * 1e3),
					typeof p.from != "object" && (p.from = new Date(p.from)),
					(p.order = p.order || "desc"),
					p
				)
			}
		}
		stream(t = {}) {
			let r = Hs.join(this.dirname, this.filename),
				n = new Clt(),
				i = { file: r, start: t.start }
			return (
				(n.destroy = blt(i, (s, o) => {
					if (s) return n.emit("error", s)
					try {
						n.emit("data", o), (o = JSON.parse(o)), n.emit("log", o)
					} catch (a) {
						n.emit("error", a)
					}
				})),
				n
			)
		}
		open() {
			this.filename &&
				(this._opening ||
					((this._opening = !0),
					this.stat((t, r) => {
						if (t) return this.emit("error", t)
						yc("stat done: %s { size: %s }", this.filename, r),
							(this._size = r),
							(this._dest = this._createStream(this._stream)),
							(this._opening = !1),
							this.once("open", () => {
								this._stream.eventNames().includes("rotate")
									? this._stream.emit("rotate")
									: (this._rotate = !1)
							})
					})))
		}
		stat(t) {
			let r = this._getFile(),
				n = Hs.join(this.dirname, r)
			Wd.stat(n, (i, s) => {
				if (i && i.code === "ENOENT") return yc("ENOENT\xA0ok", n), (this.filename = r), t(null, 0)
				if (i) return yc(`err ${i.code} ${n}`), t(i)
				if (!s || this._needsNewFile(s.size)) return this._incFile(() => this.stat(t))
				;(this.filename = r), t(null, s.size)
			})
		}
		close(t) {
			this._stream &&
				this._stream.end(() => {
					t && t(), this.emit("flush"), this.emit("closed")
				})
		}
		_needsNewFile(t) {
			return (t = t || this._size), this.maxsize && t >= this.maxsize
		}
		_onError(t) {
			this.emit("error", t)
		}
		_setupStream(t) {
			return t.on("error", this._onError), t
		}
		_cleanupStream(t) {
			return t.removeListener("error", this._onError), t.destroy(), t
		}
		_rotateFile() {
			this._incFile(() => this.open())
		}
		_endStream(t = () => {}) {
			this._dest
				? (this._stream.unpipe(this._dest),
					this._dest.end(() => {
						this._cleanupStream(this._dest), t()
					}))
				: t()
		}
		_createStream(t) {
			let r = Hs.join(this.dirname, this.filename)
			yc("create stream start", r, this.options)
			let n = Wd.createWriteStream(r, this.options)
				.on("error", (i) => yc(i))
				.on("close", () => yc("close", n.path, n.bytesWritten))
				.on("open", () => {
					yc("file open ok", r),
						this.emit("open", r),
						t.pipe(n),
						this.rotatedWhileOpening &&
							((this._stream = new Xpe()),
							this._stream.setMaxListeners(30),
							this._rotateFile(),
							(this.rotatedWhileOpening = !1),
							this._cleanupStream(n),
							t.end())
				})
			if ((yc("create stream ok", r), this.zippedArchive)) {
				let i = mlt.createGzip()
				return i.pipe(n), i
			}
			return n
		}
		_incFile(t) {
			yc("_incFile", this.filename)
			let r = Hs.extname(this._basename),
				n = Hs.basename(this._basename, r)
			this.tailable
				? this._checkMaxFilesTailable(r, n, t)
				: ((this._created += 1), this._checkMaxFilesIncrementing(r, n, t))
		}
		_getFile() {
			let t = Hs.extname(this._basename),
				r = Hs.basename(this._basename, t),
				n = this.rotationFormat ? this.rotationFormat() : this._created,
				i = !this.tailable && this._created ? `${r}${n}${t}` : `${r}${t}`
			return this.zippedArchive && !this.tailable ? `${i}.gz` : i
		}
		_checkMaxFilesIncrementing(t, r, n) {
			if (!this.maxFiles || this._created < this.maxFiles) return setImmediate(n)
			let i = this._created - this.maxFiles,
				s = i !== 0 ? i : "",
				o = this.zippedArchive ? ".gz" : "",
				a = `${r}${s}${t}${o}`,
				l = Hs.join(this.dirname, a)
			Wd.unlink(l, n)
		}
		_checkMaxFilesTailable(t, r, n) {
			let i = []
			if (!this.maxFiles) return
			let s = this.zippedArchive ? ".gz" : ""
			for (let o = this.maxFiles - 1; o > 1; o--)
				i.push(
					function (a, l) {
						let c = `${r}${a - 1}${t}${s}`,
							u = Hs.join(this.dirname, c)
						Wd.exists(u, (f) => {
							if (!f) return l(null)
							;(c = `${r}${a}${t}${s}`), Wd.rename(u, Hs.join(this.dirname, c), l)
						})
					}.bind(this, o),
				)
			Alt(i, () => {
				Wd.rename(Hs.join(this.dirname, `${r}${t}`), Hs.join(this.dirname, `${r}1${t}${s}`), n)
			})
		}
		_createLogDirIfNotExist(t) {
			Wd.existsSync(t) || Wd.mkdirSync(t, { recursive: !0 })
		}
	}
})