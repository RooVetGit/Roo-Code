
	var pft = YW(),
		Aft = KW(),
		mft = Lx(),
		yft = Uk(),
		Cft = Lk(),
		vft = Ok(),
		Eft = (e, t, r, n) => {
			switch (t) {
				case "===":
					return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e === r
				case "!==":
					return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e !== r
				case "":
				case "=":
				case "==":
					return pft(e, r, n)
				case "!=":
					return Aft(e, r, n)
				case ">":
					return mft(e, r, n)
				case ">=":
					return yft(e, r, n)
				case "<":
					return Cft(e, r, n)
				case "<=":
					return vft(e, r, n)
				default:
					throw new TypeError(`Invalid operator: ${t}`)
			}
		}