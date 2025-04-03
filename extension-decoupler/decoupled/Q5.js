
	var q5 = function (e) {
			switch (e) {
				case !0:
					return !0
				case pe.pki.certificateError.bad_certificate:
					return k.Alert.Description.bad_certificate
				case pe.pki.certificateError.unsupported_certificate:
					return k.Alert.Description.unsupported_certificate
				case pe.pki.certificateError.certificate_revoked:
					return k.Alert.Description.certificate_revoked
				case pe.pki.certificateError.certificate_expired:
					return k.Alert.Description.certificate_expired
				case pe.pki.certificateError.certificate_unknown:
					return k.Alert.Description.certificate_unknown
				case pe.pki.certificateError.unknown_ca:
					return k.Alert.Description.unknown_ca
				default:
					return k.Alert.Description.bad_certificate
			}
		},
		PXe = function (e) {
			switch (e) {
				case !0:
					return !0
				case k.Alert.Description.bad_certificate:
					return pe.pki.certificateError.bad_certificate
				case k.Alert.Description.unsupported_certificate:
					return pe.pki.certificateError.unsupported_certificate
				case k.Alert.Description.certificate_revoked:
					return pe.pki.certificateError.certificate_revoked
				case k.Alert.Description.certificate_expired:
					return pe.pki.certificateError.certificate_expired
				case k.Alert.Description.certificate_unknown:
					return pe.pki.certificateError.certificate_unknown
				case k.Alert.Description.unknown_ca:
					return pe.pki.certificateError.unknown_ca
				default:
					return pe.pki.certificateError.bad_certificate
			}
		}