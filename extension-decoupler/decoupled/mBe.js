
function Mbe(e, t) {
	let n = 1e4 * (Math.log(e.length + 1) / Math.log(4)),
		{ minDelayMs: i = 1e4, maxDelayMs: s = 3e4 } = t,
		o = Math.min(Math.max(n, i), s)
	setTimeout(() => {
		e.forEach((a) => a.dispose())
	}, o)
}