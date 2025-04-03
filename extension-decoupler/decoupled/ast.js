
	function Ast(e, t, r) {
		var n
		if (t && typeof t.next == "function") n = t
		else if (t && t[Symbol.asyncIterator]) n = t[Symbol.asyncIterator]()
		else if (t && t[Symbol.iterator]) n = t[Symbol.iterator]()
		else throw new pst("iterable", ["Iterable"], t)
		var i = new e(dst({ objectMode: !0 }, r)),
			s = !1
		i._read = function () {
			s || ((s = !0), o())
		}
		function o() {
			return a.apply(this, arguments)
		}
		function a() {
			return (
				(a = ust(function* () {
					try {
						var l = yield n.next(),
							c = l.value,
							u = l.done
						u ? i.push(null) : i.push(yield c) ? o() : (s = !1)
					} catch (f) {
						i.destroy(f)
					}
				})),
				a.apply(this, arguments)
			)
		}
		return i
	}