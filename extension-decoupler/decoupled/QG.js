
var A_ = class {
		_keyCodeToStr
		_strToKeyCode
		constructor() {
			;(this._keyCodeToStr = []), (this._strToKeyCode = Object.create(null))
		}
		define(t, r) {
			;(this._keyCodeToStr[t] = r), (this._strToKeyCode[r.toLowerCase()] = t)
		}
		keyCodeToStr(t) {
			return this._keyCodeToStr[t]
		}
		strToKeyCode(t) {
			return this._strToKeyCode[t.toLowerCase()] || 0
		}
	},
	FF = new A_(),
	qG = new A_(),
	VG = new A_(),
	R0t = new Array(230),
	k0t = {},
	Xbe = [],
	exe = Object.create(null),
	txe = Object.create(null),
	QF = {
		lowerCaseToEnum: (e) => txe[e] || 0,
		toEnum: (e) => exe[e] || 0,
		toString: (e) => Xbe[e] || "None",
	},
	rxe = [],
	HG = []