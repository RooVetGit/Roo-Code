class KeyManager {
  constructor() {
    this.apiKeys = [];
    this.rateLimitStatus = {};
    this.usageStats = {};
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

  trackUsage(key, usage) {
    if (!this.usageStats[key]) {
      this.usageStats[key] = { count: 0, lastUsed: 0 };
    }
    this.usageStats[key].count += usage;
    this.usageStats[key].lastUsed = Date.now();
  }

  getUsageStats() {
    return this.usageStats;
  }

  checkKeyHealth(key) {
    // Placeholder for health check logic
    // This could include checking if the key is expired or invalid
    return true;
  }

  disableKey(key) {
    this.apiKeys = this.apiKeys.filter(k => k !== key);
  }
}

module.exports = KeyManager;
