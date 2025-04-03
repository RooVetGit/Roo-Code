
function Vu(e, t, r = !1) {
	let n = e.getKeybindingForCommand(t, r)
	return (
		n ||
		(t === Co.commandID
			? (e.getSimplifiedPlatform() === "darwin" ? (n = "Cmd+Z") : (n = "Ctrl+Z"),
				r ? kc.formatKeyboardShortcut(n, e.getSimplifiedPlatform()) : n)
			: t === "redo"
				? (e.getSimplifiedPlatform() === "darwin" ? (n = "Cmd+Shift+Z") : (n = "Ctrl+Y"),
					r ? kc.formatKeyboardShortcut(n, e.getSimplifiedPlatform()) : n)
				: n)
	)
}