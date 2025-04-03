
var mde = x((oDt, Ade) => {
	"use strict"
	var Stt = OT(),
		Btt = ode(),
		Dtt = lde(),
		Ttt = hde(),
		Rtt = pde(),
		ktt = "[object Boolean]",
		Mtt = "[object Date]",
		Ftt = "[object Map]",
		Qtt = "[object Number]",
		Ntt = "[object RegExp]",
		Ptt = "[object Set]",
		Ltt = "[object String]",
		Utt = "[object Symbol]",
		Ott = "[object ArrayBuffer]",
		qtt = "[object DataView]",
		Vtt = "[object Float32Array]",
		Htt = "[object Float64Array]",
		Wtt = "[object Int8Array]",
		Gtt = "[object Int16Array]",
		$tt = "[object Int32Array]",
		Ytt = "[object Uint8Array]",
		Ktt = "[object Uint8ClampedArray]",
		Jtt = "[object Uint16Array]",
		ztt = "[object Uint32Array]"
	function jtt(e, t, r) {
		var n = e.constructor
		switch (t) {
			case Ott:
				return Stt(e)
			case ktt:
			case Mtt:
				return new n(+e)
			case qtt:
				return Btt(e, r)
			case Vtt:
			case Htt:
			case Wtt:
			case Gtt:
			case $tt:
			case Ytt:
			case Ktt:
			case Jtt:
			case ztt:
				return Rtt(e, r)
			case Ftt:
				return new n()
			case Qtt:
			case Ltt:
				return new n(e)
			case Ntt:
				return Dtt(e)
			case Ptt:
				return new n()
			case Utt:
				return Ttt(e)
		}
	}
	Ade.exports = jtt
})