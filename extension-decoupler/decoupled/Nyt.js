
function nyt(e) {
	return e.replace(/\$\(([\w-]+)\)/gi, "&dollar;($1)")
}