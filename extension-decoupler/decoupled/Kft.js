
	var Kft = bl(),
		Jft = (e, t) =>
			new Kft(e, t).set.map((r) =>
				r
					.map((n) => n.value)
					.join(" ")
					.trim()
					.split(" "),
			)