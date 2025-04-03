
	var fTt = require("events").EventEmitter,
		Vhe = function (t, r) {
			return t.listeners(r).length
		},
		Jb = V3(),
		lR = require("buffer").Buffer,
		mst =
			(typeof global < "u" ? global : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array ||
			function () {}