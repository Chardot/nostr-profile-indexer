// test-api.ts
const baseUrl = "http://localhost:8000";

// Test health endpoint
const health = await fetch(`${baseUrl}/api/health`);
console.log("Health:", await health.json());

// Test profile batch
const batch = await fetch(`${baseUrl}/api/profiles/batch?count=10`);
console.log("Batch:", await batch.json());