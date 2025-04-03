
	function Igt() {
		return "colors" in ts.inspectOpts ? !!ts.inspectOpts.colors : wgt.isatty(process.stderr.fd)
	}