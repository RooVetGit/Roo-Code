
var Nx = x((x1t, c0e) => {
	"use strict"
	var hdt = "2.0.0",
		gdt = Number.MAX_SAFE_INTEGER || 9007199254740991,
		pdt = 16,
		Adt = 250,
		mdt = ["major", "premajor", "minor", "preminor", "patch", "prepatch", "prerelease"]
	c0e.exports = {
		MAX_LENGTH: 256,
		MAX_SAFE_COMPONENT_LENGTH: pdt,
		MAX_SAFE_BUILD_LENGTH: Adt,
		MAX_SAFE_INTEGER: gdt,
		RELEASE_TYPES: mdt,
		SEMVER_SPEC_VERSION: hdt,
		FLAG_INCLUDE_PRERELEASE: 1,
		FLAG_LOOSE: 2,
	}
})