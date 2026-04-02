const { ApiError } = require("../services/cryptoServices");

async function hash() {
  // This endpoint has been removed. Keep a defensive handler in case
  // something still imports it.
  throw new ApiError(410, "Gone", {
    issue: "/api/hash endpoint has been removed"
  });
}

module.exports = { hash };