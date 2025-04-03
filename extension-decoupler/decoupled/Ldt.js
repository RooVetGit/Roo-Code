
	var D0e = jp(),
		Ldt = (e, t) => {
			let r = D0e(e, null, !0),
				n = D0e(t, null, !0),
				i = r.compare(n)
			if (i === 0) return null
			let s = i > 0,
				o = s ? r : n,
				a = s ? n : r,
				l = !!o.prerelease.length
			if (!!a.prerelease.length && !l)
				return !a.patch && !a.minor ? "major" : o.patch ? "patch" : o.minor ? "minor" : "major"
			let u = l ? "pre" : ""
			return r.major !== n.major
				? u + "major"
				: r.minor !== n.minor
					? u + "minor"
					: r.patch !== n.patch
						? u + "patch"
						: "prerelease"
		}