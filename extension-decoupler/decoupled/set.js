
	function set(e) {
		return G.create(G.Class.UNIVERSAL, G.Type.SEQUENCE, !0, [
			G.create(G.Class.UNIVERSAL, G.Type.INTEGER, !1, G.integerToDer(e.version).getBytes()),
			G.create(G.Class.UNIVERSAL, G.Type.SEQUENCE, !0, [
				De.pki.distinguishedNameToAsn1({ attributes: e.issuer }),
				G.create(G.Class.UNIVERSAL, G.Type.INTEGER, !1, De.util.hexToBytes(e.serialNumber)),
			]),
			G.create(G.Class.UNIVERSAL, G.Type.SEQUENCE, !0, [
				G.create(G.Class.UNIVERSAL, G.Type.OID, !1, G.oidToDer(e.encryptedContent.algorithm).getBytes()),
				G.create(G.Class.UNIVERSAL, G.Type.NULL, !1, ""),
			]),
			G.create(G.Class.UNIVERSAL, G.Type.OCTETSTRING, !1, e.encryptedContent.content),
		])
	}