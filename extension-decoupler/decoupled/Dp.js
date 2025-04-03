
function DP(e, t, r, n, i) {
	var s = "",
		o = "",
		a = Math.floor(i / 2) - 1
	return (
		n - t > a && ((s = " ... "), (t = n - a + s.length)),
		r - n > a && ((o = " ..."), (r = n + a - o.length)),
		{
			str: s + e.slice(t, r).replace(/\t/g, "\u2192") + o,
			pos: n - t + s.length,
		}
	)
}