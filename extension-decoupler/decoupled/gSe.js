
				function GSe() {
					var d = arguments.length
					if (!d) return []
					for (var h = ie(d - 1), A = arguments[0], E = d; E--; ) h[E - 1] = arguments[E]
					return js(Rt(A) ? wo(A) : [A], fs(h, 1))
				}