
	var KKe = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
		JKe = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
		LD = Array(61)
			.fill(0)
			.map((e, t) => t.toString().padStart(2, "0"))