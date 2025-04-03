
	var bdt = (zd.re = []),
		xdt = (zd.safeRe = []),
		Le = (zd.src = []),
		Ue = (zd.t = {}),
		_dt = 0,
		WW = "[a-zA-Z0-9-]",
		wdt = [
			["\\s", 1],
			["\\d", vdt],
			[WW, Cdt],
		],
		Idt = (e) => {
			for (let [t, r] of wdt) e = e.split(`${t}*`).join(`${t}{0,${r}}`).split(`${t}+`).join(`${t}{1,${r}}`)
			return e
		},
		Mt = (e, t, r) => {
			let n = Idt(t),
				i = _dt++
			Edt(e, i, t),
				(Ue[e] = i),
				(Le[i] = t),
				(bdt[i] = new RegExp(t, r ? "g" : void 0)),
				(xdt[i] = new RegExp(n, r ? "g" : void 0))
		}