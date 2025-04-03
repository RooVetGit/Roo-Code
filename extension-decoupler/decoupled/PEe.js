
function pEe(e = {}, t = []) {
	let r = Pu(e.splitter, $s, yG),
		n =
			!rG(e.format) && e.format
				? e.format
				: {
						hash: "%H",
						date: e.strictDate === !1 ? "%ai" : "%aI",
						message: "%s",
						refs: "%D",
						body: e.multiLine ? "%B" : "%b",
						author_name: e.mailMap !== !1 ? "%aN" : "%an",
						author_email: e.mailMap !== !1 ? "%aE" : "%ae",
					},
		[i, s] = mAt(n, r),
		o = [],
		a = [`--pretty=format:${AG}${s}${mG}`, ...t],
		l = e.n || e["max-count"] || e.maxCount
	if ((l && a.push(`--max-count=${l}`), e.from || e.to)) {
		let c = e.symmetric !== !1 ? "..." : ".."
		o.push(`${e.from || ""}${c}${e.to || ""}`)
	}
	return (
		$s(e.file) && a.push("--follow", opt(e.file)), sG(yAt(e), a), { fields: i, splitter: r, commands: [...a, ...o] }
	)
}