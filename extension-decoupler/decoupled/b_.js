
function B_(e, t, r) {
	let n = kc.getStructuredKeybinding(t.getKeybindingForCommand(e))
	if (!n || n.chords.length < 1) return []
	if (n.chords.length > 1 || n.chords[0] instanceof Jh)
		return [
			{
				after: {
					contentText: n ? `[${n.toPrettyString(t.getSimplifiedPlatform())}]` : "",
				},
			},
		]
	{
		let i = n.chords[0],
			s = [],
			o = (l) => {
				s.push(h_e(l, t.getSimplifiedPlatform()))
			}
		if (
			(i.ctrlKey && o(5),
			i.shiftKey && o(4),
			i.altKey && o(6),
			i.metaKey && o(57),
			i.keyCode && o(i.keyCode),
			s.some((l) => l == null))
		)
			return [
				{
					after: {
						contentText: n ? `[${n.toPrettyString(t.getSimplifiedPlatform())}]` : "",
					},
				},
			]
		let a = {
			fontFamily: '"Augment.vscode-augment/augment-kb-icon-font.woff"',
			verticalAlign: "bottom",
		}
		return s.map((l) => ({
			light: { after: { ...a, contentText: l } },
			dark: { after: { ...a, contentText: l } },
		}))
	}
}