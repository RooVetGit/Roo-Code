
function UY(e) {
	return Object.keys(e)
		.map((t) => Number.parseInt(t, 10))
		.filter((t) => !Number.isNaN(t))
}