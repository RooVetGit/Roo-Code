
	function qO(e, t, r) {
		if (typeof t != "string") {
			if (
				(m4e(t) ||
					(t =
						t instanceof Blob
							? new Mte([t], "blob", { type: t.type })
							: new Rte(t, "blob", { type: t.type })),
				r !== void 0)
			) {
				let n = { type: t.type, lastModified: t.lastModified }
				t = t instanceof Fte ? new Mte([t], r, n) : new Rte(t, r, n)
			}
		}
		return { name: e, value: t }
	}