
	var bft = Ws(),
		xft = jp(),
		{ safeRe: qk, t: Vk } = My(),
		_ft = (e, t) => {
			if (e instanceof bft) return e
			if ((typeof e == "number" && (e = String(e)), typeof e != "string")) return null
			t = t || {}
			let r = null
			if (!t.rtl) r = e.match(t.includePrerelease ? qk[Vk.COERCEFULL] : qk[Vk.COERCE])
			else {
				let l = t.includePrerelease ? qk[Vk.COERCERTLFULL] : qk[Vk.COERCERTL],
					c
				for (; (c = l.exec(e)) && (!r || r.index + r[0].length !== e.length); )
					(!r || c.index + c[0].length !== r.index + r[0].length) && (r = c),
						(l.lastIndex = c.index + c[1].length + c[2].length)
				l.lastIndex = -1
			}
			if (r === null) return null
			let n = r[2],
				i = r[3] || "0",
				s = r[4] || "0",
				o = t.includePrerelease && r[5] ? `-${r[5]}` : "",
				a = t.includePrerelease && r[6] ? `+${r[6]}` : ""
			return xft(`${n}.${i}.${s}${o}${a}`, t)
		}