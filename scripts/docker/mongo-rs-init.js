// scripts/docker/mongo-rs-init.js
// ─────────────────────────────────────────────────────────────────────────────
// Runs inside the MongoDB container on first startup via docker-entrypoint-initdb.d
// Initialises the single-node replica set required for multi-document transactions.
// ─────────────────────────────────────────────────────────────────────────────

try {
  const status = rs.status();
  if (status.ok === 1) {
    print("Replica set already configured.");
  }
} catch {
  // rs.status() throws if not yet configured — initiate now
  print("Initiating replica set rs0...");
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "127.0.0.1:27017" }],
  });
  print("Replica set rs0 initiated.");
}
