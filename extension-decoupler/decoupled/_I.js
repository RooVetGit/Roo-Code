
function _i(e, t, r) {
	for (var n = 0, i = e.input.charCodeAt(e.position); i !== 0; ) {
		for (; Wg(i); )
			i === 9 && e.firstTabInLine === -1 && (e.firstTabInLine = e.position),
				(i = e.input.charCodeAt(++e.position))
		if (t && i === 35)
			do i = e.input.charCodeAt(++e.position)
			while (i !== 10 && i !== 13 && i !== 0)
		if (zc(i))
			for (LP(e), i = e.input.charCodeAt(e.position), n++, e.lineIndent = 0; i === 32; )
				e.lineIndent++, (i = e.input.charCodeAt(++e.position))
		else break
	}
	return r !== -1 && n !== 0 && e.lineIndent < r && jI(e, "deficient indentation"), n
}