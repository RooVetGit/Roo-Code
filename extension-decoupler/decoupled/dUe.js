
	function due(e, t) {
		switch (t) {
			case Ch.der:
				return Ub.pki.pemToDer(e)
			case Ch.pem:
				return e
			case Ch.txt:
				return fet(e)
			case Ch.asn1:
				return uue(e)
			case Ch.fingerprint:
				var r = Ub.md.sha1.create(),
					n = due(e, Ch.der)
				return r.update(n.getBytes()), r.digest().toHex()
			case Ch.x509:
				return Ub.pki.certificateFromPem(e)
			default:
				throw new Error("unknown format ".concat(t))
		}
	}