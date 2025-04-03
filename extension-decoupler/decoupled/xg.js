
var b1 = ((i) => (
		(i[(i.high = 0)] = "high"),
		(i[(i.medium = 1)] = "medium"),
		(i[(i.low = 2)] = "low"),
		(i[(i.neutral = 3)] = "neutral"),
		i
	))(b1 || {}),
	XG = Object.values(b1)
		.filter((e) => typeof e == "number")
		.sort()