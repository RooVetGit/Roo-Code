
	function Uit(e) {
		if (!e) return "utf8"
		for (var t; ; )
			switch (e) {
				case "utf8":
				case "utf-8":
					return "utf8"
				case "ucs2":
				case "ucs-2":
				case "utf16le":
				case "utf-16le":
					return "utf16le"
				case "latin1":
				case "binary":
					return "latin1"
				case "base64":
				case "ascii":
				case "hex":
					return e
				default:
					if (t) return
					;(e = ("" + e).toLowerCase()), (t = !0)
			}
	}