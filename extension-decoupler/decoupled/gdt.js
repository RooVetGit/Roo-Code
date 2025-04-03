
	var Gdt = jp(),
		$dt = (e, t) => {
			let r = Gdt(e, t)
			return r && r.prerelease.length ? r.prerelease : null
		}