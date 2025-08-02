/**
 * ChatView Virtualization Utilities
 *
 * This module provides optimized virtualization for handling very long conversations
 * efficiently. It includes:
 * - LRU cache-based state management for expanded/collapsed messages
 * - Intelligent auto-scroll behavior with user intent detection
 * - Real-time performance monitoring
 * - Device-aware optimizations
 * - Progressive loading for browser session groups
 */

// Re-export all virtualization utilities from their respective modules
export { MessageStateManager } from "../utils/MessageStateManager"
export type { MessageState } from "../utils/MessageStateManager"

export { AutoScrollManager } from "../utils/AutoScrollManager"

export { PerformanceMonitor, getGlobalPerformanceMonitor } from "../utils/performanceMonitor"
export type { PerformanceMetrics, PerformanceThresholds } from "../utils/performanceMonitor"

export {
	VIRTUALIZATION_CONFIG,
	detectDevicePerformance,
	getViewportConfigForDevice,
} from "../utils/virtualizationConfig"
export type { ViewportConfig, VirtualizationConfig, DevicePerformance } from "../utils/virtualizationConfig"

export {
	createOptimizedMessageGroups,
	getVisibleMessageIndices,
	calculateTotalHeight,
	findGroupByMessageTs,
	optimizeGroups,
} from "../utils/messageGrouping"
export type { MessageGroup, GroupingConfig } from "../utils/messageGrouping"

export { useOptimizedVirtualization } from "../hooks/useOptimizedVirtualization"
export type {
	UseOptimizedVirtualizationOptions,
	UseOptimizedVirtualizationReturn,
} from "../hooks/useOptimizedVirtualization"

/**
 * Quick start guide for using the virtualization system:
 *
 * 1. Import the hook in your ChatView component:
 *    ```typescript
 *    import { useOptimizedVirtualization } from './virtualization'
 *    ```
 *
 * 2. Replace existing virtualization setup:
 *    ```typescript
 *    const {
 *      virtuosoRef,
 *      viewportConfig,
 *      messageGroups,
 *      stateManager,
 *      scrollManager,
 *      handleScroll,
 *      handleRangeChange,
 *      scrollToBottom
 *    } = useOptimizedVirtualization({
 *      messages: groupedMessages,
 *      isStreaming,
 *      isHidden
 *    })
 *    ```
 *
 * 3. Update Virtuoso configuration:
 *    ```typescript
 *    <Virtuoso
 *      ref={virtuosoRef}
 *      increaseViewportBy={viewportConfig}
 *      data={messageGroups}
 *      onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}
 *      rangeChanged={handleRangeChange}
 *      // ... other props
 *    />
 *    ```
 *
 * 4. Use stateManager for expanded/collapsed states:
 *    ```typescript
 *    const isExpanded = stateManager.isExpanded(messageTs)
 *    const toggleExpanded = () => stateManager.toggleExpanded(messageTs)
 *    ```
 */

/**
 * Default configuration recommendations:
 *
 * - Buffer sizes: 500px top, 1000px bottom (adjustable based on device)
 * - LRU cache: 250 items max (configurable)
 * - Auto-scroll threshold: 50px from bottom
 * - Smooth scroll max distance: 5000px (instant scroll for larger jumps)
 *
 * The system automatically adjusts based on:
 * - Device performance (high/medium/low)
 * - Current state (streaming, expanded messages)
 * - User interaction patterns
 */
