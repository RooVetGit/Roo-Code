
function qK(e) {
	if (e === void 0) throw new Error("Missing required parameter `insert_line_entries` for `insert` command.")
	if (!Array.isArray(e))
		throw new Error("Invalid parameter `insert_line_entries` for `insert` command. It must be an array of objects.")
	if (e.length === 0) throw new Error("Empty required parameter `insert_line_entries` for `insert` command.")
	let t = []
	for (let r of e) {
		if (typeof r != "object" || !r)
			throw new Error(
				"Invalid parameter `insert_line_entries` for `insert` command. It must be an array of objects.",
			)
		let n = r
		if (n.insert_line === void 0) throw new Error("Missing required parameter `insert_line` for `insert` command.")
		if (n.new_str === void 0) throw new Error("Missing required parameter `new_str` for `insert` command.")
		if (!Number.isInteger(n.insert_line) || n.insert_line < 0)
			throw new Error("Invalid parameter `insert_line` for `insert` command. It must be a non-negative integer.")
		t.push({ insert_line: n.insert_line, new_str: n.new_str })
	}
	return t
}