
	function _0t() {
		switch (lf()) {
			case "b":
				return he(), "\b"
			case "f":
				return he(), "\f"
			case "n":
				return (
					he(),
					`
`
				)
			case "r":
				return he(), "\r"
			case "t":
				return he(), "	"
			case "v":
				return he(), "\v"
			case "0":
				if ((he(), ns.isDigit(lf()))) throw Tn(he())
				return "\0"
			case "x":
				return he(), w0t()
			case "u":
				return he(), PG()
			case `
`:
			case "\u2028":
			case "\u2029":
				return he(), ""
			case "\r":
				return (
					he(),
					lf() ===
						`
` && he(),
					""
				)
			case "1":
			case "2":
			case "3":
			case "4":
			case "5":
			case "6":
			case "7":
			case "8":
			case "9":
				throw Tn(he())
			case void 0:
				throw Tn(he())
		}
		return he()
	}