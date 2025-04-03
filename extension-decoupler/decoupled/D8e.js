
	function D8e(e, t) {
		for (;;) {
			if (e.destroyed) {
				Td(e[GE] === 0)
				return
			}
			if (e[jf] && !e[HE]) {
				e[jf](), (e[jf] = null)
				return
			}
			if ((e[Ai] && e[Ai].resume(), e[lq])) e[Zf] = 2
			else if (e[Zf] === 2) {
				t ? ((e[Zf] = 1), queueMicrotask(() => xre(e))) : xre(e)
				continue
			}
			if (e[GE] === 0 || e[WE] >= (wre(e) || 1)) return
			let r = e[ac][e[lc]]
			if (e[au].protocol === "https:" && e[zf] !== r.servername) {
				if (e[WE] > 0) return
				;(e[zf] = r.servername),
					e[Ai]?.destroy(new n8e("servername changed"), () => {
						;(e[Ai] = null), dq(e)
					})
			}
			if (e[d0]) return
			if (!e[Ai]) {
				Sre(e)
				return
			}
			if (e[Ai].destroyed || e[Ai].busy(r)) return
			!r.aborted && e[Ai].write(r) ? e[lc]++ : e[ac].splice(e[lc], 1)
		}
	}