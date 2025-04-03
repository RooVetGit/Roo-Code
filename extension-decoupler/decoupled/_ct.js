
	var { Stream: Act, Transform: mct } = dy(),
		wAe = YR(),
		{ LEVEL: _u, SPLAT: IAe } = Bi(),
		SAe = UH(),
		yct = GH(),
		Cct = YH(),
		vct = AH(),
		Ect = _Ae(),
		{ warn: bct } = q3(),
		xct = VR(),
		_ct = /%[scdjifoO%]/g,
		JR = class extends mct {
			constructor(t) {
				super({ objectMode: !0 }), this.configure(t)
			}
			child(t) {
				let r = this
				return Object.create(r, {
					write: {
						value: function (n) {
							let i = Object.assign({}, t, n)
							n instanceof Error && ((i.stack = n.stack), (i.message = n.message)), r.write(i)
						},
					},
				})
			}
			configure({
				silent: t,
				format: r,
				defaultMeta: n,
				levels: i,
				level: s = "info",
				exitOnError: o = !0,
				transports: a,
				colors: l,
				emitErrs: c,
				formatters: u,
				padLevels: f,
				rewriters: p,
				stripColors: g,
				exceptionHandlers: m,
				rejectionHandlers: y,
			} = {}) {
				if (
					(this.transports.length && this.clear(),
					(this.silent = t),
					(this.format = r || this.format || Q3()()),
					(this.defaultMeta = n || null),
					(this.levels = i || this.levels || xct.npm.levels),
					(this.level = s),
					this.exceptions && this.exceptions.unhandle(),
					this.rejections && this.rejections.unhandle(),
					(this.exceptions = new yct(this)),
					(this.rejections = new Cct(this)),
					(this.profilers = {}),
					(this.exitOnError = o),
					a && ((a = Array.isArray(a) ? a : [a]), a.forEach((C) => this.add(C))),
					l || c || u || f || p || g)
				)
					throw new Error(
						[
							"{ colors, emitErrs, formatters, padLevels, rewriters, stripColors } were removed in winston@3.0.0.",
							"Use a custom winston.format(function) instead.",
							"See: https://github.com/winstonjs/winston/tree/master/UPGRADE-3.0.md",
						].join(`
`),
					)
				m && this.exceptions.handle(m), y && this.rejections.handle(y)
			}
			isLevelEnabled(t) {
				let r = JH(this.levels, t)
				if (r === null) return !1
				let n = JH(this.levels, this.level)
				return n === null
					? !1
					: !this.transports || this.transports.length === 0
						? n >= r
						: this.transports.findIndex((s) => {
								let o = JH(this.levels, s.level)
								return o === null && (o = n), o >= r
							}) !== -1
			}
			log(t, r, ...n) {
				if (arguments.length === 1) return (t[_u] = t.level), this._addDefaultMeta(t), this.write(t), this
				if (arguments.length === 2)
					return r && typeof r == "object"
						? ((r[_u] = r.level = t), this._addDefaultMeta(r), this.write(r), this)
						: ((r = { [_u]: t, level: t, message: r }), this._addDefaultMeta(r), this.write(r), this)
				let [i] = n
				if (typeof i == "object" && i !== null && !(r && r.match && r.match(_ct))) {
					let o = Object.assign({}, this.defaultMeta, i, {
						[_u]: t,
						[IAe]: n,
						level: t,
						message: r,
					})
					return (
						i.message && (o.message = `${o.message} ${i.message}`),
						i.stack && (o.stack = i.stack),
						this.write(o),
						this
					)
				}
				return (
					this.write(
						Object.assign({}, this.defaultMeta, {
							[_u]: t,
							[IAe]: n,
							level: t,
							message: r,
						}),
					),
					this
				)
			}
			_transform(t, r, n) {
				if (this.silent) return n()
				t[_u] || (t[_u] = t.level),
					!this.levels[t[_u]] &&
						this.levels[t[_u]] !== 0 &&
						console.error("[winston] Unknown logger level: %s", t[_u]),
					this._readableState.pipes ||
						console.error(
							"[winston] Attempt to write logs with no transports, which can increase memory usage: %j",
							t,
						)
				try {
					this.push(this.format.transform(t, this.format.options))
				} finally {
					;(this._writableState.sync = !1), n()
				}
			}
			_final(t) {
				let r = this.transports.slice()
				wAe(
					r,
					(n, i) => {
						if (!n || n.finished) return setImmediate(i)
						n.once("finish", i), n.end()
					},
					t,
				)
			}
			add(t) {
				let r = !SAe(t) || t.log.length > 2 ? new vct({ transport: t }) : t
				if (!r._writableState || !r._writableState.objectMode)
					throw new Error("Transports must WritableStreams in objectMode. Set { objectMode: true }.")
				return (
					this._onEvent("error", r),
					this._onEvent("warn", r),
					this.pipe(r),
					t.handleExceptions && this.exceptions.handle(),
					t.handleRejections && this.rejections.handle(),
					this
				)
			}
			remove(t) {
				if (!t) return this
				let r = t
				return (
					(!SAe(t) || t.log.length > 2) && (r = this.transports.filter((n) => n.transport === t)[0]),
					r && this.unpipe(r),
					this
				)
			}
			clear() {
				return this.unpipe(), this
			}
			close() {
				return this.exceptions.unhandle(), this.rejections.unhandle(), this.clear(), this.emit("close"), this
			}
			setLevels() {
				bct.deprecated("setLevels")
			}
			query(t, r) {
				typeof t == "function" && ((r = t), (t = {})), (t = t || {})
				let n = {},
					i = Object.assign({}, t.query || {})
				function s(a, l) {
					t.query && typeof a.formatQuery == "function" && (t.query = a.formatQuery(i)),
						a.query(t, (c, u) => {
							if (c) return l(c)
							typeof a.formatResults == "function" && (u = a.formatResults(u, t.format)), l(null, u)
						})
				}
				function o(a, l) {
					s(a, (c, u) => {
						l && ((u = c || u), u && (n[a.name] = u), l()), (l = null)
					})
				}
				wAe(
					this.transports.filter((a) => !!a.query),
					o,
					() => r(null, n),
				)
			}
			stream(t = {}) {
				let r = new Act(),
					n = []
				return (
					(r._streams = n),
					(r.destroy = () => {
						let i = n.length
						for (; i--; ) n[i].destroy()
					}),
					this.transports
						.filter((i) => !!i.stream)
						.forEach((i) => {
							let s = i.stream(t)
							s &&
								(n.push(s),
								s.on("log", (o) => {
									;(o.transport = o.transport || []), o.transport.push(i.name), r.emit("log", o)
								}),
								s.on("error", (o) => {
									;(o.transport = o.transport || []), o.transport.push(i.name), r.emit("error", o)
								}))
						}),
					r
				)
			}
			startTimer() {
				return new Ect(this)
			}
			profile(t, ...r) {
				let n = Date.now()
				if (this.profilers[t]) {
					let i = this.profilers[t]
					delete this.profilers[t],
						typeof r[r.length - 2] == "function" &&
							(console.warn("Callback function no longer supported as of winston@3.0.0"), r.pop())
					let s = typeof r[r.length - 1] == "object" ? r.pop() : {}
					return (
						(s.level = s.level || "info"),
						(s.durationMs = n - i),
						(s.message = s.message || t),
						this.write(s)
					)
				}
				return (this.profilers[t] = n), this
			}
			handleExceptions(...t) {
				console.warn("Deprecated: .handleExceptions() will be removed in winston@4. Use .exceptions.handle()"),
					this.exceptions.handle(...t)
			}
			unhandleExceptions(...t) {
				console.warn(
					"Deprecated: .unhandleExceptions() will be removed in winston@4. Use .exceptions.unhandle()",
				),
					this.exceptions.unhandle(...t)
			}
			cli() {
				throw new Error(
					[
						"Logger.cli() was removed in winston@3.0.0",
						"Use a custom winston.formats.cli() instead.",
						"See: https://github.com/winstonjs/winston/tree/master/UPGRADE-3.0.md",
					].join(`
`),
				)
			}
			_onEvent(t, r) {
				function n(i) {
					t === "error" && !this.transports.includes(r) && this.add(r), this.emit(t, i, r)
				}
				r["__winston" + t] || ((r["__winston" + t] = n.bind(this)), r.on(t, r["__winston" + t]))
			}
			_addDefaultMeta(t) {
				this.defaultMeta && Object.assign(t, this.defaultMeta)
			}
		}