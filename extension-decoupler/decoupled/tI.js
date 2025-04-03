
function Ti(e) {
	return new eF(
		(t) => void e.postMessage(t),
		(t) => {
			let r = e.onDidReceiveMessage(t)
			return () => void r.dispose()
		},
	)
}