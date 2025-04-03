
function __e(e) {
	return `<a href="${e.href}" title="${e.tooltip}">${e.text}${
		e.keybindingIcons ? `&nbsp;${e.keybindingIcons}` : ""
	}</a>`
}