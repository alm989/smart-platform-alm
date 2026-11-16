/* Optimistic locking lives in server.js v1.3+
 * PUT /api/data/:id body: { payload, baseVersion }
 * If baseVersion != server version -> 409 conflict
 */
console.log('See server.js v1.3 for optimistic lock');
