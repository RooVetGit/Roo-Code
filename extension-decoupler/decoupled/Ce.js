
var cE = x((_xt, Qj) => {
	"use strict"
	Qj.exports = Fj
	var kj = DS(),
		Mj = RS(),
		MLe = LS(),
		US = ei(),
		FLe = fS()
	function Fj(e) {
		this.contextObject = e
	}
	var QLe = {
		xml: { "": !0, "1.0": !0, "2.0": !0 },
		core: { "": !0, "2.0": !0 },
		html: { "": !0, "1.0": !0, "2.0": !0 },
		xhtml: { "": !0, "1.0": !0, "2.0": !0 },
	}
	Fj.prototype = {
		hasFeature: function (t, r) {
			var n = QLe[(t || "").toLowerCase()]
			return (n && n[r || ""]) || !1
		},
		createDocumentType: function (t, r, n) {
			return FLe.isValidQName(t) || US.InvalidCharacterError(), new Mj(this.contextObject, t, r, n)
		},
		createDocument: function (t, r, n) {
			var i = new kj(!1, null),
				s
			return (
				r ? (s = i.createElementNS(t, r)) : (s = null),
				n && i.appendChild(n),
				s && i.appendChild(s),
				t === US.NAMESPACE.HTML
					? (i._contentType = "application/xhtml+xml")
					: t === US.NAMESPACE.SVG
						? (i._contentType = "image/svg+xml")
						: (i._contentType = "application/xml"),
				i
			)
		},
		createHTMLDocument: function (t) {
			var r = new kj(!0, null)
			r.appendChild(new Mj(r, "html"))
			var n = r.createElement("html")
			r.appendChild(n)
			var i = r.createElement("head")
			if ((n.appendChild(i), t !== void 0)) {
				var s = r.createElement("title")
				i.appendChild(s), s.appendChild(r.createTextNode(t))
			}
			return n.appendChild(r.createElement("body")), (r.modclock = 1), r
		},
		mozSetOutputMutationHandler: function (e, t) {
			e.mutationHandler = t
		},
		mozGetInputMutationHandler: function (e) {
			US.nyi()
		},
		mozHTMLParser: MLe,
	}
})