
	function XZe(e, t, r, n) {
		var i = ae.create(ae.Class.UNIVERSAL, ae.Type.SEQUENCE, !0, [
			ae.create(ae.Class.UNIVERSAL, ae.Type.OCTETSTRING, !1, e),
			ae.create(ae.Class.UNIVERSAL, ae.Type.INTEGER, !1, t.getBytes()),
		])
		return (
			n !== "hmacWithSHA1" &&
				i.value.push(
					ae.create(ae.Class.UNIVERSAL, ae.Type.INTEGER, !1, Ne.util.hexToBytes(r.toString(16))),
					ae.create(ae.Class.UNIVERSAL, ae.Type.SEQUENCE, !0, [
						ae.create(ae.Class.UNIVERSAL, ae.Type.OID, !1, ae.oidToDer(Wt.oids[n]).getBytes()),
						ae.create(ae.Class.UNIVERSAL, ae.Type.NULL, !1, ""),
					]),
				),
			i
		)
	}