
	function mue(e) {
		if ((e === void 0 && (e = QT), !pue)) return []
		e = vh(vh({}, QT), e)
		var t = /(?=-----BEGIN\sCERTIFICATE-----)/g,
			r = ["find-certificate", "-a", "-p"],
			n = []
		if (e.keychain === "all" || e.keychain === "SystemRootCertificates") {
			var i = "/System/Library/Keychains/SystemRootCertificates.keychain",
				s = (0, hue.spawnSync)("/usr/bin/security", r.concat(i))
					.stdout.toString()
					.split(t)
					.map(function (c) {
						return c.trim()
					})
			n = MT(MT([], n, !0), s, !0)
		}
		if (e.keychain === "all" || e.keychain === "current") {
			var o = (0, hue.spawnSync)("/usr/bin/security", r)
				.stdout.toString()
				.split(t)
				.map(function (c) {
					return c.trim()
				})
			n = MT(MT([], n, !0), o, !0)
		}
		if (e.unique || e.excludeBundled) {
			var a = n.map(function (c) {
					return (0, qd.convert)(c, qd.Format.fingerprint)
				}),
				l = e.excludeBundled
					? het.rootCertificates.map(function (c) {
							return (0, qd.convert)(c, qd.Format.fingerprint)
						})
					: []
			n = n.filter(function (c, u) {
				var f = a[u]
				return !((e.unique && u !== a.indexOf(f)) || (e.excludeBundled && l.includes(f)))
			})
		}
		return n.map(function (c) {
			return (0, qd.convert)(c, e.format)
		})
	}