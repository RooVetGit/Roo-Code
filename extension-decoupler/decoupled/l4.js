
function L4(e) {
	return (e.objects = e.objects || {
		compressing: 0,
		counting: 0,
		enumerating: 0,
		packReused: 0,
		reused: { count: 0, delta: 0 },
		total: { count: 0, delta: 0 },
	})
}