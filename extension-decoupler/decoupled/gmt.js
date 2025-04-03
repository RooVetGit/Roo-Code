
function Gmt(e, t) {
	if (Wmt(e) && /^\s*protocol(.[a-z]+)?.allow/.test(t))
		throw new Xd(
			void 0,
			"unsafe",
			"Configuring protocol.allow is not permitted without enabling allowUnsafeExtProtocol",
		)
}