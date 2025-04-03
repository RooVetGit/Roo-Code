
	var R6e = () => {},
		Dq = class extends I6e {
			constructor(t) {
				if ((super(), !t || (typeof t == "object" && !(t instanceof zE) && !t.uri)))
					throw new eD("Proxy uri is mandatory")
				let { clientFactory: r = T6e } = t
				if (typeof r != "function") throw new eD("Proxy opts.clientFactory must be a function.")
				let n = this.#e(t),
					{ href: i, origin: s, port: o, protocol: a, username: l, password: c, hostname: u } = n
				if (
					((this[v6e] = { uri: i, protocol: a }),
					(this[x6e] =
						t.interceptors?.ProxyAgent && Array.isArray(t.interceptors.ProxyAgent)
							? t.interceptors.ProxyAgent
							: []),
					(this[Bq] = t.requestTls),
					(this[one] = t.proxyTls),
					(this[jE] = t.headers || {}),
					t.auth && t.token)
				)
					throw new eD("opts.auth cannot be used in combination with opts.token")
				t.auth
					? (this[jE]["proxy-authorization"] = `Basic ${t.auth}`)
					: t.token
						? (this[jE]["proxy-authorization"] = t.token)
						: l &&
							c &&
							(this[jE]["proxy-authorization"] = `Basic ${Buffer.from(
								`${decodeURIComponent(l)}:${decodeURIComponent(c)}`,
							).toString("base64")}`)
				let f = sne({ ...t.proxyTls })
				;(this[ane] = sne({ ...t.requestTls })),
					(this[XB] = r(n, { connect: f })),
					(this[ZB] = new _6e({
						...t,
						connect: async (p, g) => {
							let m = p.host
							p.port || (m += `:${D6e(p.protocol)}`)
							try {
								let { socket: y, statusCode: C } = await this[XB].connect({
									origin: s,
									port: o,
									path: m,
									signal: p.signal,
									headers: { ...this[jE], host: p.host },
									servername: this[one]?.servername || u,
								})
								if (
									(C !== 200 &&
										(y.on("error", R6e).destroy(),
										g(new S6e(`Proxy response (${C}) !== 200 when HTTP Tunneling`))),
									p.protocol !== "https:")
								) {
									g(null, y)
									return
								}
								let v
								this[Bq] ? (v = this[Bq].servername) : (v = p.servername),
									this[ane]({ ...p, servername: v, httpSocket: y }, g)
							} catch (y) {
								y.code === "ERR_TLS_CERT_ALTNAME_INVALID" ? g(new B6e(y)) : g(y)
							}
						},
					}))
			}
			dispatch(t, r) {
				let n = k6e(t.headers)
				if ((M6e(n), n && !("host" in n) && !("Host" in n))) {
					let { host: i } = new zE(t.origin)
					n.host = i
				}
				return this[ZB].dispatch({ ...t, headers: n }, r)
			}
			#e(t) {
				return typeof t == "string" ? new zE(t) : t instanceof zE ? t : new zE(t.uri)
			}
			async [E6e]() {
				await this[ZB].close(), await this[XB].close()
			}
			async [b6e]() {
				await this[ZB].destroy(), await this[XB].destroy()
			}
		}