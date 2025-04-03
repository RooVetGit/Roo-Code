
	function $b(e) {
		this.encoding = Oit(e)
		var t
		switch (this.encoding) {
			case "utf16le":
				;(this.text = $it), (this.end = Yit), (t = 4)
				break
			case "utf8":
				;(this.fillLast = Hit), (t = 4)
				break
			case "base64":
				;(this.text = Kit), (this.end = Jit), (t = 3)
				break
			default:
				;(this.write = zit), (this.end = jit)
				return
		}
		;(this.lastNeed = 0), (this.lastTotal = 0), (this.lastChar = Z3.allocUnsafe(t))
	}