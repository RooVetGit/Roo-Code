import { ModelInfo } from "../../../../schemas";

export const getContextWindowInfo = jest.fn((modelInfo?: ModelInfo | null) => {
    // Default values if no model info provided
    const contextWindow = modelInfo?.contextWindow || 100000;
    const maxAllowedSize = contextWindow; // Default to use full window
    
    return {
        contextWindow,
        maxAllowedSize,
    };
});