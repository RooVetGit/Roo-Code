
function PK(e) {
	if (e === void 0) throw new Error("Missing required parameter `str_replace_entries` for `str_replace` command.")
	if (!Array.isArray(e))
		throw new Error(
			"Invalid parameter `str_replace_entries` for `str_replace` command. It must be an array of objects.",
		)
	if (e.length === 0) throw new Error("Empty required parameter `str_replace_entries` for `str_replace` command.")
	let t = []
	for (let r of e) {
		if (typeof r != "object" || !r)
			throw new Error(
				"Invalid parameter `str_replace_entries` for `str_replace` command. It must be an array of objects.",
			)
		let n = r
		if (n.old_str === void 0) throw new Error("Missing required parameter `old_str` for `str_replace` command.")
		if (n.new_str === void 0) throw new Error("Missing required parameter `new_str` for `str_replace` command.")
		if (
			(n.old_str_start_line_number === 0 && (n.old_str_start_line_number = void 0),
			n.old_str_end_line_number === 0 && (n.old_str_end_line_number = void 0),
			n.old_str_start_line_number !== void 0 &&
				(!Number.isInteger(n.old_str_start_line_number) || n.old_str_start_line_number < 1))
		)
			throw new Error(
				"Invalid parameter `old_str_start_line_number` for `str_replace` command. It must be a positive integer.",
			)
		if (
			n.old_str_end_line_number !== void 0 &&
			(!Number.isInteger(n.old_str_end_line_number) || n.old_str_end_line_number < 1)
		)
			throw new Error(
				"Invalid parameter `old_str_end_line_number` for `str_replace` command. It must be a positive integer.",
			)
		t.push({
			old_str: n.old_str,
			new_str: n.new_str,
			old_str_start_line_number: n.old_str_start_line_number,
			old_str_end_line_number: n.old_str_end_line_number,
		})
	}
	return t
}