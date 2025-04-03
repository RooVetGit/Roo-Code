
function GM(e) {
	let t = e.filter(hAt)
	if (t.length > 1) return jo(`Summary flags are mutually exclusive - pick one of ${t.join(",")}`)
	if (t.length && e.includes("-z"))
		return jo(`Summary flag ${t} parsing is not compatible with null termination option '-z'`)
}