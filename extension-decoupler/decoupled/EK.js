
async function Ek(e, t, r, n, i, s) {
	if (gW) {
		Gn.window.showInformationMessage("Augment Agent orientation is already in progress")
		return
	}
	let o = X("InitialOrientation"),
		a = gk.create(s)
	a.setFlag(Cr.start)
	try {
		;(gW = !0), await mut(e, t, r, n, i, o, a)
	} catch (l) {
		a.setFlag(Cr.exceptionThrown),
			o.error(`Error in initial orientation: ${l}`),
			Gn.window.showErrorMessage("Augment agent orientation process failed :(")
	} finally {
		;(gW = !1),
			a.setFlag(Cr.end),
			i.reportEvent({
				eventName: Is.initialOrientation,
				conversationId: "",
				eventData: { initialOrientationData: a },
			})
	}
}