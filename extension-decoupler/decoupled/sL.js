
function Sl(e) {
	return (t) => {
		t.scripts.add(e.cspSource),
			t.styles.add(e.cspSource),
			t.images.add(e.cspSource),
			t.fonts.add(e.cspSource),
			t.media.add(e.cspSource)
	}
}