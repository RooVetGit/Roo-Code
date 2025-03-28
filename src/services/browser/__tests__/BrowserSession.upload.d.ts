import { BrowserActionResult } from '../../../shared/ExtensionMessage';

/**
 * Type definitions for the BrowserSession upload method
 */

export interface UploadOptions {
  /**
   * CSS selector for the file input element
   */
  selector: string;
  
  /**
   * Path to the file to upload
   */
  filepath: string;
}

export interface UploadResult extends BrowserActionResult {
  /**
   * Base64-encoded screenshot of the page after upload
   */
  screenshot?: string;
  
  /**
   * Console logs captured during the upload process
   */
  logs?: string;
  
  /**
   * Current URL of the page after upload
   */
  currentUrl?: string;
  
  /**
   * Current mouse position after upload
   */
  currentMousePosition?: string;
  
  /**
   * Success indicators found on the page after upload
   */
  successIndicators?: string[];
}

/**
 * Error thrown when the upload fails
 */
export class UploadError extends Error {
  /**
   * The selector that was used
   */
  selector: string;
  
  /**
   * The filepath that was used
   */
  filepath: string;
  
  /**
   * The reason for the failure
   */
  reason: string;
  
  constructor(message: string, selector: string, filepath: string, reason: string) {
    super(message);
    this.name = 'UploadError';
    this.selector = selector;
    this.filepath = filepath;
    this.reason = reason;
  }
}