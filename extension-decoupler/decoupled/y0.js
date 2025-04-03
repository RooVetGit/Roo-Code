
	function Y0(e) {
		for (
			var t = D.create(D.Class.UNIVERSAL, D.Type.SEQUENCE, !0, []), r, n, i = e.attributes, s = 0;
			s < i.length;
			++s
		) {
			r = i[s]
			var o = r.value,
				a = D.Type.PRINTABLESTRING
			"valueTagClass" in r && ((a = r.valueTagClass), a === D.Type.UTF8 && (o = nt.util.encodeUtf8(o))),
				(n = D.create(D.Class.UNIVERSAL, D.Type.SET, !0, [
					D.create(D.Class.UNIVERSAL, D.Type.SEQUENCE, !0, [
						D.create(D.Class.UNIVERSAL, D.Type.OID, !1, D.oidToDer(r.type).getBytes()),
						D.create(D.Class.UNIVERSAL, a, !1, o),
					]),
				])),
				t.value.push(n)
		}
		return t
	}