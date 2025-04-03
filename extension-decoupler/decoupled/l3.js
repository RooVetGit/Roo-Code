
	function l3(e, t, r) {
		var n = {},
			i = []
		if (!G.validate(t, r, n, i)) {
			var s = new Error("Cannot read PKCS#7 message. ASN.1 object is not a supported PKCS#7 message.")
			throw ((s.errors = s), s)
		}
		var o = G.derToOid(n.contentType)
		if (o !== De.pki.oids.data)
			throw new Error("Unsupported PKCS#7 message. Only wrapped ContentType Data supported.")
		if (n.encryptedContent) {
			var a = ""
			if (De.util.isArray(n.encryptedContent))
				for (var l = 0; l < n.encryptedContent.length; ++l) {
					if (n.encryptedContent[l].type !== G.Type.OCTETSTRING)
						throw new Error(
							"Malformed PKCS#7 message, expecting encrypted content constructed of only OCTET STRING objects.",
						)
					a += n.encryptedContent[l].value
				}
			else a = n.encryptedContent
			e.encryptedContent = {
				algorithm: G.derToOid(n.encAlgorithm),
				parameter: De.util.createBuffer(n.encParameter.value),
				content: De.util.createBuffer(a),
			}
		}
		if (n.content) {
			var a = ""
			if (De.util.isArray(n.content))
				for (var l = 0; l < n.content.length; ++l) {
					if (n.content[l].type !== G.Type.OCTETSTRING)
						throw new Error(
							"Malformed PKCS#7 message, expecting content constructed of only OCTET STRING objects.",
						)
					a += n.content[l].value
				}
			else a = n.content
			e.content = De.util.createBuffer(a)
		}
		return (e.version = n.version.charCodeAt(0)), (e.rawCapture = n), n
	}