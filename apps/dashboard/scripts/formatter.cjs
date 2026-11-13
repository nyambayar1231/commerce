// Adapted from saleor-dashboard: scripts/formatter.cjs (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// formatjs extract's output format (PLAN M11): id → { context: description, string: defaultMessage },
// the shape of locale/*.json.
exports.format = (msgs) => {
  const results = {};
  for (const [id, msg] of Object.entries(msgs)) {
    results[id] = {
      context: msg.description,
      string: msg.defaultMessage,
    };
  }
  return results;
};
