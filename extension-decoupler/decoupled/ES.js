
function eS(e) {
	var t = e.position,
		r
	return (
		(r = e.input.charCodeAt(t)),
		!!(
			(r === 45 || r === 46) &&
			r === e.input.charCodeAt(t + 1) &&
			r === e.input.charCodeAt(t + 2) &&
			((t += 3), (r = e.input.charCodeAt(t)), r === 0 || Mo(r))
		)
	)
}