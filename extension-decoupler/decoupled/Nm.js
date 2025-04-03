
var OM = W(xCe()),
	NM = W(BCe()),
	eEe = require("child_process"),
	PEe = W(M4()),
	Oy = W(M4()),
	cbe = require("events"),
	LM = Object.defineProperty,
	ept = Object.defineProperties,
	tpt = Object.getOwnPropertyDescriptor,
	rpt = Object.getOwnPropertyDescriptors,
	X4 = Object.getOwnPropertyNames,
	DCe = Object.getOwnPropertySymbols,
	lve = Object.prototype.hasOwnProperty,
	npt = Object.prototype.propertyIsEnumerable,
	TCe = (e, t, r) => (t in e ? LM(e, t, { enumerable: !0, configurable: !0, writable: !0, value: r }) : (e[t] = r)),
	_l = (e, t) => {
		for (var r in t || (t = {})) lve.call(t, r) && TCe(e, r, t[r])
		if (DCe) for (var r of DCe(t)) npt.call(t, r) && TCe(e, r, t[r])
		return e
	},
	Jx = (e, t) => ept(e, rpt(t)),
	Se = (e, t) =>
		function () {
			return e && (t = (0, e[X4(e)[0]])((e = 0))), t
		},
	ipt = (e, t) =>
		function () {
			return t || (0, e[X4(e)[0]])((t = { exports: {} }).exports, t), t.exports
		},
	vi = (e, t) => {
		for (var r in t) LM(e, r, { get: t[r], enumerable: !0 })
	},
	spt = (e, t, r, n) => {
		if ((t && typeof t == "object") || typeof t == "function")
			for (let i of X4(t))
				!lve.call(e, i) &&
					i !== r &&
					LM(e, i, {
						get: () => t[i],
						enumerable: !(n = tpt(t, i)) || n.enumerable,
					})
		return e
	},
	li = (e) => spt(LM({}, "__esModule", { value: !0 }), e),
	Kx = (e, t, r) =>
		new Promise((n, i) => {
			var s = (l) => {
					try {
						a(r.next(l))
					} catch (c) {
						i(c)
					}
				},
				o = (l) => {
					try {
						a(r.throw(l))
					} catch (c) {
						i(c)
					}
				},
				a = (l) => (l.done ? n(l.value) : Promise.resolve(l.value).then(s, o))
			a((r = r.apply(e, t)).next())
		})