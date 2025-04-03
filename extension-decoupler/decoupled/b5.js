
var B5 = x((eBt, Wle) => {
	"use strict"
	var mu = Yt()
	Sr()
	cl()
	W0()
	var Hle = (Wle.exports = mu.pkcs1 = mu.pkcs1 || {})
	Hle.encode_rsa_oaep = function (e, t, r) {
		var n, i, s, o
		typeof r == "string"
			? ((n = r), (i = arguments[3] || void 0), (s = arguments[4] || void 0))
			: r &&
				((n = r.label || void 0),
				(i = r.seed || void 0),
				(s = r.md || void 0),
				r.mgf1 && r.mgf1.md && (o = r.mgf1.md)),
			s ? s.start() : (s = mu.md.sha1.create()),
			o || (o = s)
		var a = Math.ceil(e.n.bitLength() / 8),
			l = a - 2 * s.digestLength - 2
		if (t.length > l) {
			var c = new Error("RSAES-OAEP input message length is too long.")
			throw ((c.length = t.length), (c.maxLength = l), c)
		}
		n || (n = ""), s.update(n, "raw")
		for (var u = s.digest(), f = "", p = l - t.length, g = 0; g < p; g++) f += "\0"
		var m = u.getBytes() + f + "" + t
		if (!i) i = mu.random.getBytes(s.digestLength)
		else if (i.length !== s.digestLength) {
			var c = new Error("Invalid RSAES-OAEP seed. The seed length must match the digest length.")
			throw ((c.seedLength = i.length), (c.digestLength = s.digestLength), c)
		}
		var y = mT(i, a - s.digestLength - 1, o),
			C = mu.util.xorBytes(m, y, m.length),
			v = mT(C, s.digestLength, o),
			b = mu.util.xorBytes(i, v, i.length)
		return "\0" + b + C
	}
	Hle.decode_rsa_oaep = function (e, t, r) {
		var n, i, s
		typeof r == "string"
			? ((n = r), (i = arguments[3] || void 0))
			: r && ((n = r.label || void 0), (i = r.md || void 0), r.mgf1 && r.mgf1.md && (s = r.mgf1.md))
		var o = Math.ceil(e.n.bitLength() / 8)
		if (t.length !== o) {
			var C = new Error("RSAES-OAEP encoded message length is invalid.")
			throw ((C.length = t.length), (C.expectedLength = o), C)
		}
		if ((i === void 0 ? (i = mu.md.sha1.create()) : i.start(), s || (s = i), o < 2 * i.digestLength + 2))
			throw new Error("RSAES-OAEP key is too short for the hash function.")
		n || (n = ""), i.update(n, "raw")
		for (
			var a = i.digest().getBytes(),
				l = t.charAt(0),
				c = t.substring(1, i.digestLength + 1),
				u = t.substring(1 + i.digestLength),
				f = mT(u, i.digestLength, s),
				p = mu.util.xorBytes(c, f, c.length),
				g = mT(p, o - i.digestLength - 1, s),
				m = mu.util.xorBytes(u, g, u.length),
				y = m.substring(0, i.digestLength),
				C = l !== "\0",
				v = 0;
			v < i.digestLength;
			++v
		)
			C |= a.charAt(v) !== y.charAt(v)
		for (var b = 1, w = i.digestLength, B = i.digestLength; B < m.length; B++) {
			var M = m.charCodeAt(B),
				Q = (M & 1) ^ 1,
				O = b ? 65534 : 0
			;(C |= M & O), (b = b & Q), (w += b)
		}
		if (C || m.charCodeAt(w) !== 1) throw new Error("Invalid RSAES-OAEP padding.")
		return m.substring(w + 1)
	}
	function mT(e, t, r) {
		r || (r = mu.md.sha1.create())
		for (var n = "", i = Math.ceil(t / r.digestLength), s = 0; s < i; ++s) {
			var o = String.fromCharCode((s >> 24) & 255, (s >> 16) & 255, (s >> 8) & 255, s & 255)
			r.start(), r.update(e + o), (n += r.digest().getBytes())
		}
		return n.substring(0, t)
	}
})