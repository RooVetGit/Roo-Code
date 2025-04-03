
	var $be = {
		default() {
			switch (pr) {
				case "	":
				case "\v":
				case "\f":
				case " ":
				case "\xA0":
				case "\uFEFF":
				case `
`:
				case "\r":
				case "\u2028":
				case "\u2029":
					he()
					return
				case "/":
					he(), (Kt = "comment")
					return
				case void 0:
					return he(), Dn("eof")
			}
			if (ns.isSpaceSeparator(pr)) {
				he()
				return
			}
			return $be[vo]()
		},
		comment() {
			switch (pr) {
				case "*":
					he(), (Kt = "multiLineComment")
					return
				case "/":
					he(), (Kt = "singleLineComment")
					return
			}
			throw Tn(he())
		},
		multiLineComment() {
			switch (pr) {
				case "*":
					he(), (Kt = "multiLineCommentAsterisk")
					return
				case void 0:
					throw Tn(he())
			}
			he()
		},
		multiLineCommentAsterisk() {
			switch (pr) {
				case "*":
					he()
					return
				case "/":
					he(), (Kt = "default")
					return
				case void 0:
					throw Tn(he())
			}
			he(), (Kt = "multiLineComment")
		},
		singleLineComment() {
			switch (pr) {
				case `
`:
				case "\r":
				case "\u2028":
				case "\u2029":
					he(), (Kt = "default")
					return
				case void 0:
					return he(), Dn("eof")
			}
			he()
		},
		value() {
			switch (pr) {
				case "{":
				case "[":
					return Dn("punctuator", he())
				case "n":
					return he(), fA("ull"), Dn("null", null)
				case "t":
					return he(), fA("rue"), Dn("boolean", !0)
				case "f":
					return he(), fA("alse"), Dn("boolean", !1)
				case "-":
				case "+":
					he() === "-" && (of = -1), (Kt = "sign")
					return
				case ".":
					;(Qt = he()), (Kt = "decimalPointLeading")
					return
				case "0":
					;(Qt = he()), (Kt = "zero")
					return
				case "1":
				case "2":
				case "3":
				case "4":
				case "5":
				case "6":
				case "7":
				case "8":
				case "9":
					;(Qt = he()), (Kt = "decimalInteger")
					return
				case "I":
					return he(), fA("nfinity"), Dn("numeric", 1 / 0)
				case "N":
					return he(), fA("aN"), Dn("numeric", NaN)
				case '"':
				case "'":
					;(g_ = he() === '"'), (Qt = ""), (Kt = "string")
					return
			}
			throw Tn(he())
		},
		identifierNameStartEscape() {
			if (pr !== "u") throw Tn(he())
			he()
			let e = PG()
			switch (e) {
				case "$":
				case "_":
					break
				default:
					if (!ns.isIdStartChar(e)) throw Gbe()
					break
			}
			;(Qt += e), (Kt = "identifierName")
		},
		identifierName() {
			switch (pr) {
				case "$":
				case "_":
				case "\u200C":
				case "\u200D":
					Qt += he()
					return
				case "\\":
					he(), (Kt = "identifierNameEscape")
					return
			}
			if (ns.isIdContinueChar(pr)) {
				Qt += he()
				return
			}
			return Dn("identifier", Qt)
		},
		identifierNameEscape() {
			if (pr !== "u") throw Tn(he())
			he()
			let e = PG()
			switch (e) {
				case "$":
				case "_":
				case "\u200C":
				case "\u200D":
					break
				default:
					if (!ns.isIdContinueChar(e)) throw Gbe()
					break
			}
			;(Qt += e), (Kt = "identifierName")
		},
		sign() {
			switch (pr) {
				case ".":
					;(Qt = he()), (Kt = "decimalPointLeading")
					return
				case "0":
					;(Qt = he()), (Kt = "zero")
					return
				case "1":
				case "2":
				case "3":
				case "4":
				case "5":
				case "6":
				case "7":
				case "8":
				case "9":
					;(Qt = he()), (Kt = "decimalInteger")
					return
				case "I":
					return he(), fA("nfinity"), Dn("numeric", of * (1 / 0))
				case "N":
					return he(), fA("aN"), Dn("numeric", NaN)
			}
			throw Tn(he())
		},
		zero() {
			switch (pr) {
				case ".":
					;(Qt += he()), (Kt = "decimalPoint")
					return
				case "e":
				case "E":
					;(Qt += he()), (Kt = "decimalExponent")
					return
				case "x":
				case "X":
					;(Qt += he()), (Kt = "hexadecimal")
					return
			}
			return Dn("numeric", of * 0)
		},
		decimalInteger() {
			switch (pr) {
				case ".":
					;(Qt += he()), (Kt = "decimalPoint")
					return
				case "e":
				case "E":
					;(Qt += he()), (Kt = "decimalExponent")
					return
			}
			if (ns.isDigit(pr)) {
				Qt += he()
				return
			}
			return Dn("numeric", of * Number(Qt))
		},
		decimalPointLeading() {
			if (ns.isDigit(pr)) {
				;(Qt += he()), (Kt = "decimalFraction")
				return
			}
			throw Tn(he())
		},
		decimalPoint() {
			switch (pr) {
				case "e":
				case "E":
					;(Qt += he()), (Kt = "decimalExponent")
					return
			}
			if (ns.isDigit(pr)) {
				;(Qt += he()), (Kt = "decimalFraction")
				return
			}
			return Dn("numeric", of * Number(Qt))
		},
		decimalFraction() {
			switch (pr) {
				case "e":
				case "E":
					;(Qt += he()), (Kt = "decimalExponent")
					return
			}
			if (ns.isDigit(pr)) {
				Qt += he()
				return
			}
			return Dn("numeric", of * Number(Qt))
		},
		decimalExponent() {
			switch (pr) {
				case "+":
				case "-":
					;(Qt += he()), (Kt = "decimalExponentSign")
					return
			}
			if (ns.isDigit(pr)) {
				;(Qt += he()), (Kt = "decimalExponentInteger")
				return
			}
			throw Tn(he())
		},
		decimalExponentSign() {
			if (ns.isDigit(pr)) {
				;(Qt += he()), (Kt = "decimalExponentInteger")
				return
			}
			throw Tn(he())
		},
		decimalExponentInteger() {
			if (ns.isDigit(pr)) {
				Qt += he()
				return
			}
			return Dn("numeric", of * Number(Qt))
		},
		hexadecimal() {
			if (ns.isHexDigit(pr)) {
				;(Qt += he()), (Kt = "hexadecimalInteger")
				return
			}
			throw Tn(he())
		},
		hexadecimalInteger() {
			if (ns.isHexDigit(pr)) {
				Qt += he()
				return
			}
			return Dn("numeric", of * Number(Qt))
		},
		string() {
			switch (pr) {
				case "\\":
					he(), (Qt += _0t())
					return
				case '"':
					if (g_) return he(), Dn("string", Qt)
					Qt += he()
					return
				case "'":
					if (!g_) return he(), Dn("string", Qt)
					Qt += he()
					return
				case `
`:
				case "\r":
					throw Tn(he())
				case "\u2028":
				case "\u2029":
					S0t(pr)
					break
				case void 0:
					throw Tn(he())
			}
			Qt += he()
		},
		start() {
			switch (pr) {
				case "{":
				case "[":
					return Dn("punctuator", he())
			}
			Kt = "value"
		},
		beforePropertyName() {
			switch (pr) {
				case "$":
				case "_":
					;(Qt = he()), (Kt = "identifierName")
					return
				case "\\":
					he(), (Kt = "identifierNameStartEscape")
					return
				case "}":
					return Dn("punctuator", he())
				case '"':
				case "'":
					;(g_ = he() === '"'), (Kt = "string")
					return
			}
			if (ns.isIdStartChar(pr)) {
				;(Qt += he()), (Kt = "identifierName")
				return
			}
			throw Tn(he())
		},
		afterPropertyName() {
			if (pr === ":") return Dn("punctuator", he())
			throw Tn(he())
		},
		beforePropertyValue() {
			Kt = "value"
		},
		afterPropertyValue() {
			switch (pr) {
				case ",":
				case "}":
					return Dn("punctuator", he())
			}
			throw Tn(he())
		},
		beforeArrayValue() {
			if (pr === "]") return Dn("punctuator", he())
			Kt = "value"
		},
		afterArrayValue() {
			switch (pr) {
				case ",":
				case "]":
					return Dn("punctuator", he())
			}
			throw Tn(he())
		},
		end() {
			throw Tn(he())
		},
	}