
	function TE(e) {
		if (!(e instanceof URL)) return !1
		if (e.href === "about:blank" || e.href === "about:srcdoc" || e.protocol === "data:" || e.protocol === "file:")
			return !0
		return t(e.origin)
		function t(r) {
			if (r == null || r === "null") return !1
			let n = new URL(r)
			return !!(
				n.protocol === "https:" ||
				n.protocol === "wss:" ||
				/^127(?:\.[0-9]+){0,2}\.[0-9]+$|^\[(?:0*:)*?:?0*1\]$/.test(n.hostname) ||
				n.hostname === "localhost" ||
				n.hostname.includes("localhost.") ||
				n.hostname.endsWith(".localhost")
			)
		}
	}