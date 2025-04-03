
	function Hoe(e, t) {
		let { [CJe]: r, [vJe]: n } = e
		r.abort(),
			n?.socket && !n.socket.destroyed && n.socket.destroy(),
			t &&
				YV("error", e, (i, s) => new xJe(i, s), {
					error: new Error(t),
					message: t,
				})
	}