
	function Ire(e, t) {
		if (e[WE] === 0 && t.code !== "UND_ERR_INFO" && t.code !== "UND_ERR_SOCKET") {
			Td(e[lc] === e[Rd])
			let r = e[ac].splice(e[Rd])
			for (let n = 0; n < r.length; n++) {
				let i = r[n]
				op.errorRequest(e, i, t)
			}
			Td(e[HE] === 0)
		}
	}