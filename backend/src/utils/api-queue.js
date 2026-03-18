/**
 * api-queue.js
 *
 * A simple rate limiter and connection pool for API keys.
 * Handles rate limits across multiple keys for CloudPrice v2.
 * The limit is roughly 100 requests per minute per key.
 * This class ensures we space out requests evenly (approx 610ms between requests per key).
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ApiQueue {
  constructor(keys, callsPerMinutePerKey = 100) {
    if (!keys || keys.length === 0) {
      throw new Error("ApiQueue requires at least one API key");
    }

    // Minimum wait time between requests for a single key
    // Default 100 calls/min = 600ms. We use 610ms to be slightly under the limit.
    this.minWaitMs = Math.ceil((60 * 1000) / callsPerMinutePerKey) + 10;

    this.keys = keys.map(key => ({
      key,
      nextAvailableTime: Date.now()
    }));

    // Queue of pending requests
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Enqueues an API call to be executed with the next available key.
   * @param {string} url The full URL to fetch
   * @param {number} attempt Current retry attempt
   * @returns {Promise<any>} Resolves to the parsed JSON Data or null
   */
  async fetch(url, attempt = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, attempt, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Find the key that is available soonest
        this.keys.sort((a, b) => a.nextAvailableTime - b.nextAvailableTime);
        const bestKey = this.keys[0];

        const now = Date.now();
        const waitTime = bestKey.nextAvailableTime - now;

        if (waitTime > 0) {
          // Wait for the best key to be available
          await sleep(waitTime);
        }

        // Pop task
        const task = this.queue.shift();
        if (!task) break;

        // Mark the key as busy
        bestKey.nextAvailableTime = Date.now() + this.minWaitMs;

        // Run the task without awaiting it here so the loop can move on to other keys immediately
        this.executeTask(task, bestKey).catch((err) => task.reject(err));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async executeTask(task, keyObj) {
    const { url, attempt, resolve, reject } = task;

    try {
      const res = await global.fetch(url, {
        headers: {
          "subscription-key": keyObj.key,
          Accept: "application/json",
        },
      });

      if (res.status === 429) {
        // Rate limited! This key needs a longer timeout
        const backoffWaits = [5000, 15000, 30000, 60000];
        const waitMs = backoffWaits[attempt] || 60000;

        keyObj.nextAvailableTime = Math.max(
          keyObj.nextAvailableTime,
          Date.now() + waitMs
        );

        // Re-queue
        this.queue.push({ url, attempt: attempt + 1, resolve, reject });
        this.processQueue();
        return;
      }

      if (res.status === 500) {
        return resolve(null);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json?.Status !== "ok") {
        throw new Error("Non-ok status from API");
      }

      resolve(json.Data);
    } catch (e) {
      if (attempt >= 4) {
        reject(e);
      } else {
        await sleep(5000);
        this.queue.push({ url, attempt: attempt + 1, resolve, reject });
        this.processQueue();
      }
    }
  }
}

module.exports = { ApiQueue };
