
	function Ygt() {
		return "colors" in rs.inspectOpts ? !!rs.inspectOpts.colors : $gt.isatty(process.stderr.fd)
	}