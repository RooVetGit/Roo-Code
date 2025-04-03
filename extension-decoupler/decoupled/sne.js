
function SNe(e, t) {
	var r, n, i, s, o, a, l
	if (t === null) return {}
	for (r = {}, n = Object.keys(t), i = 0, s = n.length; i < s; i += 1)
		(o = n[i]),
			(a = String(t[o])),
			o.slice(0, 2) === "!!" && (o = "tag:yaml.org,2002:" + o.slice(2)),
			(l = e.compiledTypeMap.fallback[o]),
			l && yK.call(l.styleAliases, a) && (a = l.styleAliases[a]),
			(r[o] = a)
	return r
}