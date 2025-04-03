
var Npe = x((PTt, Qpe) => {
	"use strict"
	var Mpe = Tpe(),
		Fpe = kpe()
	Qpe.exports = function (t, r) {
		var n = t.split(r || ":"),
			i = Fpe(n[0])
		if (!n.length) return i
		for (var s = 0, o = n.length - 1; s < o; s++)
			i = Mpe(i)
				.mix(Mpe(Fpe(n[s + 1])))
				.saturate(1)
				.hex()
		return i
	}
})