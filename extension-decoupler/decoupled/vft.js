
	var Ift = lye(),
		cye = new Ift(),
		Sft = Fk(),
		ZW = Ux(),
		Sn = Px(),
		Bft = Ws(),
		{ safeRe: Yo, t: po, comparatorTrimReplace: Dft, tildeTrimReplace: Tft, caretTrimReplace: Rft } = My(),
		{ FLAG_INCLUDE_PRERELEASE: kft, FLAG_LOOSE: Mft } = Nx(),
		uye = (e) => e.value === "<0.0.0-0",
		Fft = (e) => e.value === "",
		dye = (e, t) => {
			let r = !0,
				n = e.slice(),
				i = n.pop()
			for (; r && n.length; ) (r = n.every((s) => i.intersects(s, t))), (i = n.pop())
			return r
		},
		Qft = (e, t) => (
			Sn("comp", e, t),
			(e = Lft(e, t)),
			Sn("caret", e),
			(e = Nft(e, t)),
			Sn("tildes", e),
			(e = Oft(e, t)),
			Sn("xrange", e),
			(e = Vft(e, t)),
			Sn("stars", e),
			e
		),
		Ao = (e) => !e || e.toLowerCase() === "x" || e === "*",
		Nft = (e, t) =>
			e
				.trim()
				.split(/\s+/)
				.map((r) => Pft(r, t))
				.join(" "),
		Pft = (e, t) => {
			let r = t.loose ? Yo[po.TILDELOOSE] : Yo[po.TILDE]
			return e.replace(r, (n, i, s, o, a) => {
				Sn("tilde", e, n, i, s, o, a)
				let l
				return (
					Ao(i)
						? (l = "")
						: Ao(s)
							? (l = `>=${i}.0.0 <${+i + 1}.0.0-0`)
							: Ao(o)
								? (l = `>=${i}.${s}.0 <${i}.${+s + 1}.0-0`)
								: a
									? (Sn("replaceTilde pr", a), (l = `>=${i}.${s}.${o}-${a} <${i}.${+s + 1}.0-0`))
									: (l = `>=${i}.${s}.${o} <${i}.${+s + 1}.0-0`),
					Sn("tilde return", l),
					l
				)
			})
		},
		Lft = (e, t) =>
			e
				.trim()
				.split(/\s+/)
				.map((r) => Uft(r, t))
				.join(" "),
		Uft = (e, t) => {
			Sn("caret", e, t)
			let r = t.loose ? Yo[po.CARETLOOSE] : Yo[po.CARET],
				n = t.includePrerelease ? "-0" : ""
			return e.replace(r, (i, s, o, a, l) => {
				Sn("caret", e, i, s, o, a, l)
				let c
				return (
					Ao(s)
						? (c = "")
						: Ao(o)
							? (c = `>=${s}.0.0${n} <${+s + 1}.0.0-0`)
							: Ao(a)
								? s === "0"
									? (c = `>=${s}.${o}.0${n} <${s}.${+o + 1}.0-0`)
									: (c = `>=${s}.${o}.0${n} <${+s + 1}.0.0-0`)
								: l
									? (Sn("replaceCaret pr", l),
										s === "0"
											? o === "0"
												? (c = `>=${s}.${o}.${a}-${l} <${s}.${o}.${+a + 1}-0`)
												: (c = `>=${s}.${o}.${a}-${l} <${s}.${+o + 1}.0-0`)
											: (c = `>=${s}.${o}.${a}-${l} <${+s + 1}.0.0-0`))
									: (Sn("no pr"),
										s === "0"
											? o === "0"
												? (c = `>=${s}.${o}.${a}${n} <${s}.${o}.${+a + 1}-0`)
												: (c = `>=${s}.${o}.${a}${n} <${s}.${+o + 1}.0-0`)
											: (c = `>=${s}.${o}.${a} <${+s + 1}.0.0-0`)),
					Sn("caret return", c),
					c
				)
			})
		},
		Oft = (e, t) => (
			Sn("replaceXRanges", e, t),
			e
				.split(/\s+/)
				.map((r) => qft(r, t))
				.join(" ")
		),
		qft = (e, t) => {
			e = e.trim()
			let r = t.loose ? Yo[po.XRANGELOOSE] : Yo[po.XRANGE]
			return e.replace(r, (n, i, s, o, a, l) => {
				Sn("xRange", e, n, i, s, o, a, l)
				let c = Ao(s),
					u = c || Ao(o),
					f = u || Ao(a),
					p = f
				return (
					i === "=" && p && (i = ""),
					(l = t.includePrerelease ? "-0" : ""),
					c
						? i === ">" || i === "<"
							? (n = "<0.0.0-0")
							: (n = "*")
						: i && p
							? (u && (o = 0),
								(a = 0),
								i === ">"
									? ((i = ">="), u ? ((s = +s + 1), (o = 0), (a = 0)) : ((o = +o + 1), (a = 0)))
									: i === "<=" && ((i = "<"), u ? (s = +s + 1) : (o = +o + 1)),
								i === "<" && (l = "-0"),
								(n = `${i + s}.${o}.${a}${l}`))
							: u
								? (n = `>=${s}.0.0${l} <${+s + 1}.0.0-0`)
								: f && (n = `>=${s}.${o}.0${l} <${s}.${+o + 1}.0-0`),
					Sn("xRange return", n),
					n
				)
			})
		},
		Vft = (e, t) => (Sn("replaceStars", e, t), e.trim().replace(Yo[po.STAR], "")),
		Hft = (e, t) => (Sn("replaceGTE0", e, t), e.trim().replace(Yo[t.includePrerelease ? po.GTE0PRE : po.GTE0], "")),
		Wft = (e) => (t, r, n, i, s, o, a, l, c, u, f, p) => (
			Ao(n)
				? (r = "")
				: Ao(i)
					? (r = `>=${n}.0.0${e ? "-0" : ""}`)
					: Ao(s)
						? (r = `>=${n}.${i}.0${e ? "-0" : ""}`)
						: o
							? (r = `>=${r}`)
							: (r = `>=${r}${e ? "-0" : ""}`),
			Ao(c)
				? (l = "")
				: Ao(u)
					? (l = `<${+c + 1}.0.0-0`)
					: Ao(f)
						? (l = `<${c}.${+u + 1}.0-0`)
						: p
							? (l = `<=${c}.${u}.${f}-${p}`)
							: e
								? (l = `<${c}.${u}.${+f + 1}-0`)
								: (l = `<=${l}`),
			`${r} ${l}`.trim()
		),
		Gft = (e, t, r) => {
			for (let n = 0; n < e.length; n++) if (!e[n].test(t)) return !1
			if (t.prerelease.length && !r.includePrerelease) {
				for (let n = 0; n < e.length; n++)
					if ((Sn(e[n].semver), e[n].semver !== ZW.ANY && e[n].semver.prerelease.length > 0)) {
						let i = e[n].semver
						if (i.major === t.major && i.minor === t.minor && i.patch === t.patch) return !0
					}
				return !1
			}
			return !0
		}