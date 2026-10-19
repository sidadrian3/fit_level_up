# Learning Record: Network Resilience & Concurrency

**Date:** July 2026

## What was learned

We tackled a series of complex, real-world distributed systems problems in the FitLevelUp codebase.

### 1. The Two-General's Problem (Idempotency)
When an API request is sent, there are three points of failure: the request dropping, the server crashing, or the response dropping. If the response drops, the client thinks the request failed and retries, but the server actually processed it.
* **Insight:** Generating an `idempotencyKey` on the client when a form mounts (using `useState`) guarantees that retries are identifiable. The database acts as the ultimate source of truth by enforcing a unique index on this key.

### 2. Graceful Conflict Recovery
When the database catches an idempotency violation (MongoDB error 11000), throwing a generic 500 or 409 error is a bad user experience. 
* **Insight:** Since the request is a duplicate, it means the operation actually succeeded previously! We should catch the error, fetch the *existing* document, and return it with a 200 OK. The frontend treats it as a success.

### 3. Time-Of-Check to Time-Of-Use (TOCTOU)
Reading a value from the database and then inserting it a millisecond later is inherently dangerous under high concurrency.
* **Insight:** The database engine is the only layer capable of atomic guarantees. By eliminating the "read" step and using `bulkWrite` with `updateOne({ upsert: true, $setOnInsert })`, we pushed the concurrency control down to MongoDB, completely eliminating the race condition.

### 4. Serverless "Lost Events"
Fire-and-forget background tasks (like Next.js `after()`) are fast for the user but dangerous if the serverless container is killed prematurely.
* **Insight:** Background queues need a reliable safety net. A daily Cron sweep that idempotently re-evaluates missed tasks ensures eventual consistency with zero data loss.
