
	async function Sre(e) {
		Td(!e[d0]), Td(!e[Ai])
		let { host: t, hostname: r, protocol: n, port: i } = e[au]
		if (r[0] === "[") {
			let s = r.indexOf("]")
			Td(s !== -1)
			let o = r.substring(1, s)
			Td(_re.isIP(o)), (r = o)
		}
		;(e[d0] = !0),
			u0.beforeConnect.hasSubscribers &&
				u0.beforeConnect.publish({
					connectParams: {
						host: t,
						hostname: r,
						protocol: n,
						port: i,
						version: e[Ai]?.version,
						servername: e[zf],
						localAddress: e[qE],
					},
					connector: e[OE],
				})
		try {
			let s = await new Promise((o, a) => {
				e[OE](
					{
						host: t,
						hostname: r,
						protocol: n,
						port: i,
						servername: e[zf],
						localAddress: e[qE],
					},
					(l, c) => {
						l ? a(l) : o(c)
					},
				)
			})
			if (e.destroyed) {
				op.destroy(s.on("error", bre), new i8e())
				return
			}
			Td(s)
			try {
				e[Ai] = s.alpnProtocol === "h2" ? await S8e(e, s) : await I8e(e, s)
			} catch (o) {
				throw (s.destroy().on("error", bre), o)
			}
			;(e[d0] = !1),
				(s[C8e] = 0),
				(s[cq] = e[cq]),
				(s[o8e] = e),
				(s[u8e] = null),
				u0.connected.hasSubscribers &&
					u0.connected.publish({
						connectParams: {
							host: t,
							hostname: r,
							protocol: n,
							port: i,
							version: e[Ai]?.version,
							servername: e[zf],
							localAddress: e[qE],
						},
						connector: e[OE],
						socket: s,
					}),
				e.emit("connect", e[au], [e])
		} catch (s) {
			if (e.destroyed) return
			if (
				((e[d0] = !1),
				u0.connectError.hasSubscribers &&
					u0.connectError.publish({
						connectParams: {
							host: t,
							hostname: r,
							protocol: n,
							port: i,
							version: e[Ai]?.version,
							servername: e[zf],
							localAddress: e[qE],
						},
						connector: e[OE],
						error: s,
					}),
				s.code === "ERR_TLS_CERT_ALTNAME_INVALID")
			)
				for (Td(e[WE] === 0); e[GE] > 0 && e[ac][e[lc]].servername === e[zf]; ) {
					let o = e[ac][e[lc]++]
					op.errorRequest(e, o, s)
				}
			else Ire(e, s)
			e.emit("connectionError", e[au], [e], s)
		}
		e[VE]()
	}