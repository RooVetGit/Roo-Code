class KeyManager {
  constructor() {
    this.apiKeys = [];
    this.rateLimitStatus = {};
  }

  loadApiKeys(apiKeys) {
    this.apiKeys = apiKeys;
  }

  getNextAvailableKey() {
    const now = Date.now();
    for (const key of this.apiKeys) {
      const status = this.rateLimitStatus[key];
      if (!status || !status.rateLimited || status.retryAfter <= now) {
        return key;
      }
    }

    let earliestRetryKey = this.apiKeys[0];
    let earliestRetryTime = this.rateLimitStatus[earliestRetryKey]?.retryAfter || now;
    for (const key of this.apiKeys) {
      const retryAfter = this.rateLimitStatus[key]?.retryAfter || now;
      if (retryAfter < earliestRetryTime) {
        earliestRetryKey = key;
        earliestRetryTime = retryAfter;
      }
    }
    return earliestRetryKey;
  }

  markKeyAsRateLimited(key, retryAfter) {
    this.rateLimitStatus[key] = { rateLimited: true, retryAfter };
  }
}

module.exports = KeyManager;
