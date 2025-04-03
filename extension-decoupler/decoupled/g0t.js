
function G0t(e, t, r) {
	for (let n of e)
		t.startsWith(n.skippedSuffix) ||
			(r.warn(
				`Skipped suffix does not match the actual suffix. Skipped suffix: ${
					n.skippedSuffix
				}. First ${n.skippedSuffix.length} characters of suffix: ${t.substring(0, n.skippedSuffix.length)}`,
			),
			(n.suffixReplacementText = ""),
			(n.skippedSuffix = ""))
}