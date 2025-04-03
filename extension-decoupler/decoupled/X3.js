
var X3 = x((The) => {
	"use strict"
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
	function Oit(e) {
		var t = Uit(e)
		if (typeof t != "string" && (Z3.isEncoding === Dhe || !Dhe(e))) throw new Error("Unknown encoding: " + e)
		return t || e
	}
	The.StringDecoder = $b
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
	$b.prototype.write = function (e) {
		if (e.length === 0) return ""
		var t, r
		if (this.lastNeed) {
			if (((t = this.fillLast(e)), t === void 0)) return ""
			;(r = this.lastNeed), (this.lastNeed = 0)
		} else r = 0
		return r < e.length ? (t ? t + this.text(e, r) : this.text(e, r)) : t || ""
	}
	$b.prototype.end = Git
	$b.prototype.text = Wit
	$b.prototype.fillLast = function (e) {
		if (this.lastNeed <= e.length)
			return (
				e.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed),
				this.lastChar.toString(this.encoding, 0, this.lastTotal)
			)
		e.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, e.length), (this.lastNeed -= e.length)
	}
	function j3(e) {
		return e <= 127 ? 0 : e >> 5 === 6 ? 2 : e >> 4 === 14 ? 3 : e >> 3 === 30 ? 4 : e >> 6 === 2 ? -1 : -2
	}
	function qit(e, t, r) {
		var n = t.length - 1
		if (n < r) return 0
		var i = j3(t[n])
		return i >= 0
			? (i > 0 && (e.lastNeed = i - 1), i)
			: --n < r || i === -2
				? 0
				: ((i = j3(t[n])),
					i >= 0
						? (i > 0 && (e.lastNeed = i - 2), i)
						: --n < r || i === -2
							? 0
							: ((i = j3(t[n])), i >= 0 ? (i > 0 && (i === 2 ? (i = 0) : (e.lastNeed = i - 3)), i) : 0))
	}
	function Vit(e, t, r) {
		if ((t[0] & 192) !== 128) return (e.lastNeed = 0), "\uFFFD"
		if (e.lastNeed > 1 && t.length > 1) {
			if ((t[1] & 192) !== 128) return (e.lastNeed = 1), "\uFFFD"
			if (e.lastNeed > 2 && t.length > 2 && (t[2] & 192) !== 128) return (e.lastNeed = 2), "\uFFFD"
		}
	}
	function Hit(e) {
		var t = this.lastTotal - this.lastNeed,
			r = Vit(this, e, t)
		if (r !== void 0) return r
		if (this.lastNeed <= e.length)
			return e.copy(this.lastChar, t, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal)
		e.copy(this.lastChar, t, 0, e.length), (this.lastNeed -= e.length)
	}
	function Wit(e, t) {
		var r = qit(this, e, t)
		if (!this.lastNeed) return e.toString("utf8", t)
		this.lastTotal = r
		var n = e.length - (r - this.lastNeed)
		return e.copy(this.lastChar, 0, n), e.toString("utf8", t, n)
	}
	function Git(e) {
		var t = e && e.length ? this.write(e) : ""
		return this.lastNeed ? t + "\uFFFD" : t
	}
	function $it(e, t) {
		if ((e.length - t) % 2 === 0) {
			var r = e.toString("utf16le", t)
			if (r) {
				var n = r.charCodeAt(r.length - 1)
				if (n >= 55296 && n <= 56319)
					return (
						(this.lastNeed = 2),
						(this.lastTotal = 4),
						(this.lastChar[0] = e[e.length - 2]),
						(this.lastChar[1] = e[e.length - 1]),
						r.slice(0, -1)
					)
			}
			return r
		}
		return (
			(this.lastNeed = 1),
			(this.lastTotal = 2),
			(this.lastChar[0] = e[e.length - 1]),
			e.toString("utf16le", t, e.length - 1)
		)
	}
	function Yit(e) {
		var t = e && e.length ? this.write(e) : ""
		if (this.lastNeed) {
			var r = this.lastTotal - this.lastNeed
			return t + this.lastChar.toString("utf16le", 0, r)
		}
		return t
	}
	function Kit(e, t) {
		var r = (e.length - t) % 3
		return r === 0
			? e.toString("base64", t)
			: ((this.lastNeed = 3 - r),
				(this.lastTotal = 3),
				r === 1
					? (this.lastChar[0] = e[e.length - 1])
					: ((this.lastChar[0] = e[e.length - 2]), (this.lastChar[1] = e[e.length - 1])),
				e.toString("base64", t, e.length - r))
	}
	function Jit(e) {
		var t = e && e.length ? this.write(e) : ""
		return this.lastNeed ? t + this.lastChar.toString("base64", 0, 3 - this.lastNeed) : t
	}
	function zit(e) {
		return e.toString(this.encoding)
	}
	function jit(e) {
		return e && e.length ? this.write(e) : ""
	}
})