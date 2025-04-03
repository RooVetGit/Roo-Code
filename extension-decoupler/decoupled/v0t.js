
function v0t() {
	let e =
		Ri.window.activeColorTheme.kind === Ri.ColorThemeKind.Dark ||
		Ri.window.activeColorTheme.kind === Ri.ColorThemeKind.HighContrast
	return {
		added: {
			background: e ? "rgba(0, 255, 0, 0.1)" : "rgba(0, 200, 0, 0.05)",
			text: e ? "rgba(150, 255, 150, 0.9)" : "rgba(0, 100, 0, 0.8)",
		},
		removed: {
			background: "rgba(255, 0, 0, 0.05)",
			text: e ? "rgba(255, 200, 200, 0.9)" : "rgba(150, 0, 0, 0.8)",
			border: "rgba(150, 0, 0, 0.3)",
		},
	}
}