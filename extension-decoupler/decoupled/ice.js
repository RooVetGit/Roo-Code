
function iCe(e, t, r) {
	let n = t.getLongRunningTerminalInfo()?.current_working_directory
	if (!t.isInLongRunningTerminal(e) || !n) return
	let i = r.safeResolvePathName(n)?.relPath
	return (
		i != null && !Qh(i) && (i = `//${i}`),
		`The terminal's current working directory is now \`${i ?? n}\`.
`
	)
}