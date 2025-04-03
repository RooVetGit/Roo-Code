
function Re(e, t) {
	let r = wI(),
		n = II({
			issueData: t,
			data: e.data,
			path: e.path,
			errorMaps: [e.common.contextualErrorMap, e.schemaErrorMap, r, r === rm ? void 0 : rm].filter((i) => !!i),
		})
	e.common.issues.push(n)
}