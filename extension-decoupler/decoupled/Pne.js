
function PNe(e) {
	for (var t = "", r = 0, n, i = 0; i < e.length; r >= 65536 ? (i += 2) : i++)
		(r = Vv(e, i)), (n = Qs[r]), !n && $v(r) ? ((t += e[i]), r >= 65536 && (t += e[i + 1])) : (t += n || BNe(r))
	return t
}