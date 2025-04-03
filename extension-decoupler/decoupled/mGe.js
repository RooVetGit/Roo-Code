
	function mge(e, t) {
		return e.then(
			(r) => {
				yge(t, null, r)
			},
			(r) => {
				yge(t, r && (r instanceof Error || r.message) ? r : new Error(r))
			},
		)
	}