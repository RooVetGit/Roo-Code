
function $mt(e, t) {
	if (/^\s*--(upload|receive)-pack/.test(e))
		throw new Xd(
			void 0,
			"unsafe",
			"Use of --upload-pack or --receive-pack is not permitted without enabling allowUnsafePack",
		)
	if (t === "clone" && /^\s*-u\b/.test(e))
		throw new Xd(void 0, "unsafe", "Use of clone with option -u is not permitted without enabling allowUnsafePack")
	if (t === "push" && /^\s*--exec\b/.test(e))
		throw new Xd(
			void 0,
			"unsafe",
			"Use of push with option --exec is not permitted without enabling allowUnsafePack",
		)
}