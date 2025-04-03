
	var t5e = X2(),
		gX = typeof vE == "object" && vE && !vE.nodeType && vE,
		EE = gX && typeof Hm == "object" && Hm && !Hm.nodeType && Hm,
		r5e = EE && EE.exports === gX,
		TU = r5e && t5e.process,
		n5e = (function () {
			try {
				var e = EE && EE.require && EE.require("util").types
				return e || (TU && TU.binding && TU.binding("util"))
			} catch {}
		})()