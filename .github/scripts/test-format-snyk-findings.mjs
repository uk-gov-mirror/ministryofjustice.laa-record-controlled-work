import assert from "node:assert/strict";
import test from "node:test";

import { formatFindings } from "./format-snyk-findings.mjs";

function report({
  description,
  id,
  level = "error",
  line = 7,
  path = "app.js",
  properties = {},
  title = "",
}) {
  return {
    runs: [
      {
        results: [
          {
            level,
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: path },
                  region: { startLine: line },
                },
              },
            ],
            message: { text: description },
            ruleId: id,
          },
        ],
        tool: {
          driver: {
            rules: [{ id, properties, shortDescription: { text: title } }],
          },
        },
      },
    ],
  };
}

test("formats Snyk findings for GitHub and Slack", () => {
  const id = "SNYK-JS-ZOD-20510278";
  const result = formatFindings({
    "Open Source": report({
      description: "Crafted input bypasses validation.",
      id,
      line: 12,
      path: "package.json",
      properties: { "security-severity": "9.8" },
    }),
  });

  assert.equal(
    result.markdown,
    [
      "### Open Source findings",
      "",
      `- [${id}](https://security.snyk.io/vuln/${id}) (Critical): Crafted input bypasses validation. (package.json:12)`,
      "",
    ].join("\n"),
  );
  assert.equal(
    result.slack,
    [
      "",
      "*Open Source findings*",
      "",
      `- <https://security.snyk.io/vuln/${id}|${id}> (Critical): Crafted input bypasses validation. (package.json:12)`,
      "",
    ].join("\n"),
  );
});

test("uses SARIF severity levels for findings without CVSS metadata", () => {
  const result = formatFindings({
    Code: report({
      description: "Untrusted input reaches a database query.",
      id: "javascript/NoSQLInjection",
      level: "warning",
    }),
  });

  assert.match(result.markdown, /javascript\/NoSQLInjection \(Medium\)/);
});

test("formats high and low severity findings for Markdown and Slack", () => {
  const result = formatFindings({
    Container: report({
      description: "A vulnerable package is installed.",
      id: "SNYK-LINUX-BZIP2-106947",
      level: "error",
    }),
    IaC: report({
      description: "The resource permits public access.",
      id: "SNYK-CC-K8S-123",
      level: "note",
    }),
  });

  assert.match(result.markdown, /SNYK-LINUX-BZIP2-106947\].*\(High\)/);
  assert.match(result.markdown, /SNYK-CC-K8S-123\].*\(Low\)/);
  assert.match(result.slack, /SNYK-LINUX-BZIP2-106947> \(High\)/);
  assert.match(result.slack, /SNYK-CC-K8S-123> \(Low\)/);
});

test("omits empty scan categories and reports when no findings exist", () => {
  const result = formatFindings({
    Code: report({
      description: "Unsafe query.",
      id: "javascript/NoSQLInjection",
      level: "warning",
    }),
    IaC: { runs: [{ results: [] }] },
    "Open Source": { runs: [{ results: [] }] },
  });

  assert.match(result.markdown, /### Code findings/);
  assert.doesNotMatch(result.markdown, /Open Source findings|IaC findings/);
  assert.doesNotMatch(result.slack, /Open Source findings|IaC findings/);
  assert.equal(formatFindings({}).markdown, "No findings.\n");
  assert.equal(formatFindings({}).slack, "No findings.\n");
});
