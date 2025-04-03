
function Zmt(e, t = ["git"], r = !1) {
	let n = ove(Nu(t), r)
	e.on("binary", (i) => {
		n = ove(Nu(i), r)
	}),
		e.append("spawn.binary", () => n.binary),
		e.append("spawn.args", (i) => (n.prefix ? [n.prefix, ...i] : i))
}