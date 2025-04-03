
function s2e(e) {
	return e.map((t) => ({
		...t,
		old_str_start_line_number: t.old_str_start_line_number !== void 0 ? t.old_str_start_line_number - 1 : void 0,
		old_str_end_line_number: t.old_str_end_line_number !== void 0 ? t.old_str_end_line_number - 1 : void 0,
	}))
}