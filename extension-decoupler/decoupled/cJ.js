
	function Cj(e) {
		if (zr(e, Tj)) return !0
		if (e.namespaceURI === ot.MATHML && e.localName === "annotation-xml") {
			var t = e.getAttribute("encoding")
			if ((t && (t = t.toLowerCase()), t === "text/html" || t === "application/xhtml+xml")) return !0
		}
		return !1
	}