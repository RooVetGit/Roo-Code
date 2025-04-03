
	function T4e(e, t) {
		BB(t !== "failure" && t.essence === "multipart/form-data")
		let r = t.parameters.get("boundary")
		if (r === void 0) return "failure"
		let n = Buffer.from(`--${r}`, "utf8"),
			i = [],
			s = { position: 0 }
		for (; e[s.position] === 13 && e[s.position + 1] === 10; ) s.position += 2
		let o = e.length
		for (; e[o - 1] === 10 && e[o - 2] === 13; ) o -= 2
		for (o !== e.length && (e = e.subarray(0, o)); ; ) {
			if (e.subarray(s.position, s.position + n.length).equals(n)) s.position += n.length
			else return "failure"
			if ((s.position === e.length - 2 && DB(e, I4e, s)) || (s.position === e.length - 4 && DB(e, S4e, s)))
				return i
			if (e[s.position] !== 13 || e[s.position + 1] !== 10) return "failure"
			s.position += 2
			let a = R4e(e, s)
			if (a === "failure") return "failure"
			let { name: l, filename: c, contentType: u, encoding: f } = a
			s.position += 2
			let p
			{
				let m = e.indexOf(n.subarray(2), s.position)
				if (m === -1) return "failure"
				;(p = e.subarray(s.position, m - 4)),
					(s.position += p.length),
					f === "base64" && (p = Buffer.from(p.toString(), "base64"))
			}
			if (e[s.position] !== 13 || e[s.position + 1] !== 10) return "failure"
			s.position += 2
			let g
			c !== null
				? ((u ??= "text/plain"), B4e(u) || (u = ""), (g = new _4e([p], c, { type: u })))
				: (g = C4e(Buffer.from(p))),
				BB(Nte(l)),
				BB((typeof g == "string" && Nte(g)) || E4e(g)),
				i.push(b4e(l, g, c))
		}
	}