import React from "react"

// This is a manual mock for the Slider component.
// It will be automatically used by Jest when jest.mock('../Slider') is called.

// Create a Jest mock function for the component itself
const MockSlider = jest.fn((props: any) => {
	// You can add basic rendering if needed for other tests,
	// or just keep it simple for prop checking.
	// Include data-testid for potential queries if the component rendered something.
	return <div data-testid="mock-slider" {...props} />
})

export const Slider = MockSlider
