
function eCe() {
	let e
	return (
		a4 === "win32" && process.env.APPDATA
			? (e = Zp.default.join(process.env.APPDATA, "Code", "User"))
			: a4 === "darwin"
				? (e = Zp.default.join(Oh.default.homedir(), "Library", "Application Support", "Code", "User"))
				: a4 === "linux" && (e = Zp.default.join(Oh.default.homedir(), ".config", "Code", "User")),
		e && c4.default.existsSync(e) ? e : null
	)
}