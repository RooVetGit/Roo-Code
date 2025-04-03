
var Yj = x((Xg) => {
	"use strict"
	var Wj = cE(),
		Gj = LS(),
		Dxt = dU(),
		$j = uU()
	Xg.createDOMImplementation = function () {
		return new Wj(null)
	}
	Xg.createDocument = function (e, t) {
		if (e || t) {
			var r = new Gj()
			return r.parse(e || "", !0), r.document()
		}
		return new Wj(null).createHTMLDocument("")
	}
	Xg.createIncrementalHTMLParser = function () {
		var e = new Gj()
		return {
			write: function (t) {
				t.length > 0 &&
					e.parse(t, !1, function () {
						return !0
					})
			},
			end: function (t) {
				e.parse(t || "", !0, function () {
					return !0
				})
			},
			process: function (t) {
				return e.parse("", !1, t)
			},
			document: function () {
				return e.document()
			},
		}
	}
	Xg.createWindow = function (e, t) {
		var r = Xg.createDocument(e)
		return t !== void 0 && (r._address = t), new $j.Window(r)
	}
	Xg.impl = $j
})