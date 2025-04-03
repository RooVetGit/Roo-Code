
	var ST = function (e, t, r, n) {
			var i = pe.util.createBuffer(),
				s = e.length >> 1,
				o = s + (e.length & 1),
				a = e.substr(0, o),
				l = e.substr(s, o),
				c = pe.util.createBuffer(),
				u = pe.hmac.create()
			r = t + r
			var f = Math.ceil(n / 16),
				p = Math.ceil(n / 20)
			u.start("MD5", a)
			var g = pe.util.createBuffer()
			c.putBytes(r)
			for (var m = 0; m < f; ++m)
				u.start(null, null),
					u.update(c.getBytes()),
					c.putBuffer(u.digest()),
					u.start(null, null),
					u.update(c.bytes() + r),
					g.putBuffer(u.digest())
			u.start("SHA1", l)
			var y = pe.util.createBuffer()
			c.clear(), c.putBytes(r)
			for (var m = 0; m < p; ++m)
				u.start(null, null),
					u.update(c.getBytes()),
					c.putBuffer(u.digest()),
					u.start(null, null),
					u.update(c.bytes() + r),
					y.putBuffer(u.digest())
			return i.putBytes(pe.util.xorBytes(g.getBytes(), y.getBytes(), n)), i
		},
		yXe = function (e, t, r) {
			var n = pe.hmac.create()
			n.start("SHA1", e)
			var i = pe.util.createBuffer()
			return (
				i.putInt32(t[0]),
				i.putInt32(t[1]),
				i.putByte(r.type),
				i.putByte(r.version.major),
				i.putByte(r.version.minor),
				i.putInt16(r.length),
				i.putBytes(r.fragment.bytes()),
				n.update(i.getBytes()),
				n.digest().getBytes()
			)
		},
		CXe = function (e, t, r) {
			var n = !1
			try {
				var i = e.deflate(t.fragment.getBytes())
				;(t.fragment = pe.util.createBuffer(i)), (t.length = i.length), (n = !0)
			} catch {}
			return n
		},
		vXe = function (e, t, r) {
			var n = !1
			try {
				var i = e.inflate(t.fragment.getBytes())
				;(t.fragment = pe.util.createBuffer(i)), (t.length = i.length), (n = !0)
			} catch {}
			return n
		},
		ba = function (e, t) {
			var r = 0
			switch (t) {
				case 1:
					r = e.getByte()
					break
				case 2:
					r = e.getInt16()
					break
				case 3:
					r = e.getInt24()
					break
				case 4:
					r = e.getInt32()
					break
			}
			return pe.util.createBuffer(e.getBytes(r))
		},
		hl = function (e, t, r) {
			e.putInt(r.length(), t << 3), e.putBuffer(r)
		},
		k = {}