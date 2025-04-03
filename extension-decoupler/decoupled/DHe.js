
	var Z3 = Bhe().Buffer,
		Dhe =
			Z3.isEncoding ||
			function (e) {
				switch (((e = "" + e), e && e.toLowerCase())) {
					case "hex":
					case "utf8":
					case "utf-8":
					case "ascii":
					case "binary":
					case "base64":
					case "ucs2":
					case "ucs-2":
					case "utf16le":
					case "utf-16le":
					case "raw":
						return !0
					default:
						return !1
				}
			}