
function Z2(e, t, r = !0) {
	let { minTimestamp: n, maxTimestamp: i, minIdx: s, maxIdx: o } = t
	return e.filter((a, l) => {
		let c = (n === void 0 || a.timestamp >= n) && (i === void 0 || a.timestamp < i),
			u = (s === void 0 || l >= s) && (o === void 0 || l < o),
			f = n !== void 0 || i !== void 0,
			p = s !== void 0 || o !== void 0
		if (!(f || p)) return r
		let m = (!f || c) && (!p || u)
		return r ? m : !m
	})
}