
	function Od(e) {
		var t = e.message
		if (t instanceof Uint8Array || t instanceof Ho) return t
		var r = e.encoding
		if (t === void 0)
			if (e.md) (t = e.md.digest().getBytes()), (r = "binary")
			else throw new TypeError('"options.message" or "options.md" not specified.')
		if (typeof t == "string" && !r) throw new TypeError('"options.encoding" must be "binary" or "utf8".')
		if (typeof t == "string") {
			if (typeof Buffer < "u") return Buffer.from(t, r)
			t = new Z5(t, r)
		} else if (!(t instanceof Z5))
			throw new TypeError(
				'"options.message" must be a node.js Buffer, a Uint8Array, a forge ByteBuffer, or a string with "options.encoding" specifying its encoding.',
			)
		for (var n = new Ho(t.length()), i = 0; i < n.length; ++i) n[i] = t.at(i)
		return n
	}