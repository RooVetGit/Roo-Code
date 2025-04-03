
	function Ngt(e, t, r) {
		Uy("checking %s", e)
		try {
			let n = Fgt.statSync(e)
			return n.isFile() && t
				? (Uy("[OK] path represents a file"), !0)
				: n.isDirectory() && r
					? (Uy("[OK] path represents a directory"), !0)
					: (Uy("[FAIL] path represents something other than a file or directory"), !1)
		} catch (n) {
			if (n.code === "ENOENT") return Uy("[FAIL] path is not accessible: %o", n), !1
			throw (Uy("[FATAL] %o", n), n)
		}
	}