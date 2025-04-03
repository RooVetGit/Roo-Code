
function k_e(e, t) {
	return t ? e.getFolderRoot(Je.from(t).absPath) : e.getMostRecentlyChangedFolderRoot()
}