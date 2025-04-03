
async function S_e() {
	try {
		await Ie.commands.executeCommand("extension.vim_escape"),
			await Ie.commands.executeCommand("extension.vim_insert"),
			await Ie.commands.executeCommand("extension.vim_escape")
	} catch {}
}