#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
script="$repo_root/.github/scripts/run-snyk-scans.sh"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/bin"

cat > "$tmp_dir/bin/snyk" <<'MOCK'
#!/usr/bin/env bash
printf 'snyk %s\n' "$*" >> "$SNYK_CALL_LOG"
report_file=
for arg in "$@"; do
  case "$arg" in
    --sarif-file-output=*) report_file=${arg#*=} ;;
  esac
done
if [[ -n "$report_file" ]]; then
  mkdir -p "$(dirname "$report_file")"
  scan=${report_file##*/}
  scan=${scan#snyk-}
  scan=${scan%.sarif}
  scan_exit=$SNYK_TEST_EXIT
  if [[ ",${SNYK_EMPTY_SCANS:-}," == *",$scan,"* ]] || {
    [[ "$SNYK_TEST_EXIT" == "0" ]] &&
      [[ ",${SNYK_LOW_SEVERITY_SCANS:-}," != *",$scan,"* ]]
  }; then
    jq -n '{runs:[{tool:{driver:{rules:[]}},results:[]}]}' > "$report_file"
    scan_exit=0
  else
    case "$scan" in
      open-source)
        rule_id=SNYK-JS-ZOD-20510278
        title='High severity - Unsafe input validation in zod'
        description='Crafted input bypasses validation in zod.'
        level=error
        score=7.5
        path=package.json
        ;;
      container)
        rule_id=SNYK-LINUX-BZIP2-106947
        title='Critical severity - Vulnerability in bzip2'
        description='The image contains a vulnerable bzip2 package.'
        level=error
        score=9.8
        path=Dockerfile
        ;;
      code)
        rule_id=javascript/NoSQLInjection
        title='NoSQL injection'
        description='Untrusted input reaches a database query.'
        level=warning
        score=
        path=src/query.ts
        if [[ "$SNYK_HIGH_FINDINGS" == "true" ]]; then
          title='High severity - NoSQL injection'
          level=error
          score=7.5
        fi
        ;;
      iac)
        rule_id=SNYK-CC-K8S-123
        title='Low severity - Publicly accessible resource'
        description='The resource permits public access.'
        level=note
        score=
        path=deploy/main.yaml
        if [[ "$SNYK_HIGH_FINDINGS" == "true" ]]; then
          title='High severity - Publicly accessible resource'
          level=error
          score=7.5
        fi
        ;;
    esac
    jq -n \
      --arg id "$rule_id" \
      --arg title "$title" \
      --arg description "$description" \
      --arg level "$level" \
      --arg score "$score" \
      --arg path "$path" \
      '{runs:[{tool:{driver:{rules:[{id:$id,shortDescription:{text:$title},properties:(if $score == "" then {} else {"security-severity":$score} end)}]}},results:[{ruleId:$id,level:$level,message:{text:$description},locations:[{physicalLocation:{artifactLocation:{uri:$path},region:{startLine:12}}}]}]}]}' \
      > "$report_file"
    if [[ ",${SNYK_LOW_SEVERITY_SCANS:-}," == *",$scan,"* ]]; then
      scan_exit=0
    fi
  fi
  if [[ "$REPORT_TO_SNYK" == "true" &&
    ",${SNYK_REPORT_ERROR:-}," == *",$scan,"* ]]; then
    scan_exit=2
  fi
fi
if [[ "$1" == "test" ]]; then
  if [[ "$SCAN_MODE" == "delta" ]]; then
    printf '{"ok":true}\n'
    exit "$SNYK_TEST_EXIT"
  fi
  exit "$scan_exit"
fi
if [[ "$1" == "container" && "${2:-}" == "monitor" ]]; then
  exit "$SNYK_CONTAINER_MONITOR_EXIT"
fi
if [[ "$1" == "monitor" ]]; then
  exit "$SNYK_MONITOR_EXIT"
fi
if [[ -n "$report_file" ]]; then
  exit "$scan_exit"
fi
exit 0
MOCK

cat > "$tmp_dir/bin/snyk-delta" <<'MOCK'
#!/usr/bin/env bash
cat >/dev/null
printf 'snyk-delta %s\n' "$*" >> "$SNYK_CALL_LOG"
if [[ "$SNYK_DELTA_NO_BASELINE" == "true" ]]; then
  echo "Could not find a matching monitored Snyk project. Proceeding without a baseline."
fi
exit "$SNYK_DELTA_EXIT"
MOCK

cat > "$tmp_dir/bin/helm" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$tmp_dir/bin/snyk" "$tmp_dir/bin/snyk-delta" "$tmp_dir/bin/helm"

run_case() {
  local scan_mode=$1
  local snyk_test_exit=$2
  local delta_exit=$3
  local monitor_exit=${4:-0}
  local snyk_org_id=${5-test-org-id}
  local fail_on_findings=${6:-false}
  local report_to_snyk=${7:-false}
  local empty_scans=${8:-}
  local container_monitor_exit=${9:-0}
  local image_uri=registry.example/app@sha256:$(printf 'a%.0s' {1..64})

  if [[ "$scan_mode" == "monitor" ]]; then
    image_uri=
  fi

  : > "$tmp_dir/calls.log"
  env \
    PATH="$tmp_dir/bin:$PATH" \
    SCAN_MODE="$scan_mode" \
    FAIL_ON_FINDINGS="$fail_on_findings" \
    SOURCE_SHA=0123456789012345678901234567890123456789 \
    IMAGE_URI="$image_uri" \
    IMAGE_REFERENCE=registry.example/app \
    REPORT_TO_SNYK="$report_to_snyk" \
    SNYK_TOKEN=test-token \
    SNYK_ORG_ID="$snyk_org_id" \
    SNYK_CALL_LOG="$tmp_dir/calls.log" \
    SNYK_TEST_EXIT="$snyk_test_exit" \
    SNYK_EMPTY_SCANS="$empty_scans" \
    SNYK_DELTA_NO_BASELINE="${SNYK_DELTA_NO_BASELINE:-false}" \
    SNYK_LOW_SEVERITY_SCANS="${SNYK_LOW_SEVERITY_SCANS:-}" \
    SNYK_REPORT_ERROR="${SNYK_REPORT_ERROR:-}" \
    SNYK_HIGH_FINDINGS="${SNYK_HIGH_FINDINGS:-false}" \
    GITHUB_SERVER_URL=https://github.com \
    GITHUB_REPOSITORY=ministryofjustice/laa-record-controlled-work \
    GITHUB_RUN_ID=123456789 \
    GITHUB_RUN_ATTEMPT=1 \
    SNYK_DELTA_EXIT="$delta_exit" \
    SNYK_MONITOR_EXIT="$monitor_exit" \
    SNYK_CONTAINER_MONITOR_EXIT="$container_monitor_exit" \
    SNYK_REPORT_DIR="$tmp_dir/reports" \
    SNYK_RENDER_DIR="$tmp_dir/rendered" \
    GITHUB_STEP_SUMMARY="$tmp_dir/summary.md" \
    SETUP_NODE_OUTCOME=success \
    ECR_AUTH_OUTCOME=success \
    ECR_LOGIN_OUTCOME=success \
    HELM_SETUP_OUTCOME=success \
    SNYK_CLI_INSTALL_OUTCOME=success \
    SNYK_DELTA_INSTALL_OUTCOME=success \
    SNYK_AUTH_OUTCOME="${SNYK_AUTH_OUTCOME:-success}" \
    SNYK_TOKEN_MASK_OUTCOME=success \
    bash "$script" > "$tmp_dir/output.log" 2>&1
}

assert_logged() {
  if ! grep -Fq -- "$1" "$tmp_dir/calls.log"; then
    printf 'Expected command not found: %s\n' "$1" >&2
    cat "$tmp_dir/calls.log" >&2
    exit 1
  fi
}

if ! run_case delta 1 0; then
  cat "$tmp_dir/output.log" >&2
  echo 'Existing high findings should pass when Delta finds no regression' >&2
  exit 1
fi
if grep -Fq '## Findings' "$tmp_dir/summary.md"; then
  echo 'Delta scans should not report an empty SARIF findings list' >&2
  exit 1
fi
assert_logged 'snyk test --org=test-org-id --project-name=laa-record-controlled-work-open-source --target-reference=main --dev --severity-threshold=high --json --print-deps'
assert_logged 'snyk-delta --targetReference main'
assert_logged 'snyk-delta --targetReference main --type vuln'
if [[ -f "$tmp_dir/reports/snyk-open-source.sarif" ]]; then
  echo 'The JSON-based OSS delta gate must not require or produce SARIF' >&2
  exit 1
fi

if ! run_case delta 0 0; then
  cat "$tmp_dir/output.log" >&2
  echo 'A clean OSS scan should pass when the main baseline is available' >&2
  exit 1
fi

if SNYK_DELTA_NO_BASELINE=true run_case delta 0 0; then
  echo 'A clean OSS scan should fail when the main baseline is unavailable' >&2
  exit 1
fi
if ! grep -Fq 'Proceeding without a baseline' "$tmp_dir/output.log";
then
  echo 'The missing baseline should be identified as a comparison failure' >&2
  exit 1
fi
for scan in 'snyk container test' 'snyk code test' 'snyk iac test'; do
  assert_logged "$scan"
done
for environment in uat staging production; do
  if [[ ! -f "$tmp_dir/rendered/$environment.yaml" ]]; then
    printf 'Expected %s manifests to render after a baseline failure\n' "$environment" >&2
    exit 1
  fi
done
if [[ ! -f "$tmp_dir/reports/snyk-open-source-delta.log" ]]; then
  echo 'The Delta comparison output should be retained after baseline failure' >&2
  exit 1
fi

if SNYK_AUTH_OUTCOME=failure run_case delta 0 0; then
  echo 'An OAuth setup failure should fail the comparison workflow' >&2
  exit 1
fi
if ! grep -Fq 'Snyk OAuth action failed' "$tmp_dir/output.log"; then
  echo 'An authentication failure should be reported' >&2
  exit 1
fi
assert_logged 'snyk-delta --targetReference main --type vuln'

if run_case delta 2 0; then
  echo 'An OSS scan error should fail the workflow' >&2
  exit 1
fi
if ! grep -Fq 'Snyk Open Source test failed with exit code 2' "$tmp_dir/output.log"; then
  echo 'An OSS scan error should be reported' >&2
  exit 1
fi
for scan in 'snyk container test' 'snyk code test' 'snyk iac test'; do
  assert_logged "$scan"
done

if run_case delta 1 1; then
  echo 'A new high or critical finding should fail' >&2
  exit 1
fi
if ! grep -Fq 'Snyk Delta found new high or critical findings' "$tmp_dir/output.log"; then
  echo 'The failure should identify a high or critical Delta regression' >&2
  exit 1
fi

if run_case delta 1 2; then
  echo 'A Delta tool error should fail the workflow' >&2
  exit 1
fi
if ! grep -Fq 'Snyk Delta failed with exit code 2' "$tmp_dir/output.log"; then
  echo 'The failure should identify the Delta tool error' >&2
  exit 1
fi

if run_case delta 1 0 0 ''; then
  echo 'Delta mode should require an explicit Snyk organization' >&2
  exit 1
fi
if ! grep -Fq 'SNYK_ORG_ID is required' "$tmp_dir/output.log"; then
  echo 'The missing organization should be reported clearly' >&2
  exit 1
fi

if ! run_case absolute 1 0; then
  cat "$tmp_dir/output.log" >&2
  echo 'Absolute scans should report findings without failing by default' >&2
  exit 1
fi
assert_logged 'snyk test --all-projects --dev --severity-threshold=high --sarif-file-output='
for scan in container code iac; do
  if ! grep -F "snyk $scan" "$tmp_dir/calls.log" | grep -Fq -- '--severity-threshold=high'; then
    printf 'Contributor %s scans must retain the high severity gate\n' "$scan" >&2
    exit 1
  fi
done
setup_section=$(sed -n '/^## Setup checks$/,/^## Snyk scan results$/p' "$tmp_dir/summary.md")
scan_section=$(sed -n '/^## Snyk scan results$/,/^## Validation$/p' "$tmp_dir/summary.md")
validation_section=$(sed -n '/^## Validation$/,/^## Findings$/p' "$tmp_dir/summary.md")
if ! grep -Fq '| Node and dependency setup | passed |' <<< "$setup_section" ||
  grep -Fq '| Node and dependency setup | passed |' <<< "$scan_section"; then
  echo 'Setup checks should appear outside the Snyk scan results' >&2
  exit 1
fi
if ! grep -Fq '| Open Source | findings |' <<< "$scan_section"; then
  echo 'Snyk scan results should appear in their own section' >&2
  exit 1
fi
if ! grep -Fq '| Helm rendering | passed |' <<< "$validation_section"; then
  echo 'Helm rendering should appear under validation, not as a Snyk scan' >&2
  exit 1
fi
for finding in \
  '### Open Source findings' \
  '### Container findings' \
  '### Code findings' \
  '### IaC findings'; do
  if ! grep -Fq -- "$finding" "$tmp_dir/reports/findings.md"; then
    printf 'Expected findings section not found: %s\n' "$finding" >&2
    cat "$tmp_dir/output.log" >&2
    cat "$tmp_dir/reports/findings.md" >&2
    exit 1
  fi
  if ! grep -Fq -- "$finding" "$tmp_dir/summary.md"; then
    printf 'Expected findings section missing from workflow summary: %s\n' "$finding" >&2
    exit 1
  fi
done
for finding in \
  '[SNYK-JS-ZOD-20510278](https://security.snyk.io/vuln/SNYK-JS-ZOD-20510278) (High): Crafted input bypasses validation in zod. (package.json:12)' \
  '[SNYK-LINUX-BZIP2-106947](https://security.snyk.io/vuln/SNYK-LINUX-BZIP2-106947) (Critical): The image contains a vulnerable bzip2 package. (Dockerfile:12)' \
  'javascript/NoSQLInjection (Medium): Untrusted input reaches a database query. (src/query.ts:12)' \
  '[SNYK-CC-K8S-123](https://security.snyk.io/vuln/SNYK-CC-K8S-123) (Low): The resource permits public access. (deploy/main.yaml:12)'; do
  if ! grep -Fq -- "$finding" "$tmp_dir/reports/findings.md" ||
    ! grep -Fq -- "$finding" "$tmp_dir/summary.md"; then
    printf 'Expected markdown finding missing: %s\n' "$finding" >&2
    exit 1
  fi
done
for finding in \
  '<https://security.snyk.io/vuln/SNYK-JS-ZOD-20510278|SNYK-JS-ZOD-20510278> (High): Crafted input bypasses validation in zod. (package.json:12)' \
  '<https://security.snyk.io/vuln/SNYK-LINUX-BZIP2-106947|SNYK-LINUX-BZIP2-106947> (Critical): The image contains a vulnerable bzip2 package. (Dockerfile:12)' \
  'javascript/NoSQLInjection (Medium): Untrusted input reaches a database query. (src/query.ts:12)' \
  '<https://security.snyk.io/vuln/SNYK-CC-K8S-123|SNYK-CC-K8S-123> (Low): The resource permits public access. (deploy/main.yaml:12)'; do
  if ! grep -Fq -- "$finding" "$tmp_dir/reports/findings.txt"; then
    printf 'Expected Slack finding missing: %s\n' "$finding" >&2
    exit 1
  fi
done

if [[ "${SHOW_SUMMARY:-false}" == "true" ]]; then
  printf '\n--- Generated workflow summary (mock findings) ---\n'
  cat "$tmp_dir/summary.md"
  printf '%s\n' '--- End summary ---'
fi

if ! run_case absolute 1 0 0 test-org-id false false 'container,code'; then
  cat "$tmp_dir/output.log" >&2
  echo 'Partial scan findings should still produce a report' >&2
  exit 1
fi
for category in 'Open Source' IaC; do
  if ! grep -Fq "### $category findings" "$tmp_dir/summary.md"; then
    printf 'Expected non-empty scan section missing: %s\n' "$category" >&2
    exit 1
  fi
done
for category in Container Code; do
  if grep -Fq "### $category findings" "$tmp_dir/summary.md" ||
    grep -Fq "*$category findings*" "$tmp_dir/reports/findings.txt"; then
    printf 'Empty scan section should be omitted: %s\n' "$category" >&2
    exit 1
  fi
done

if ! run_case absolute 0 0 0 test-org-id false true; then
  cat "$tmp_dir/output.log" >&2
  echo 'Snyk reporting should allow absolute scans to complete' >&2
  exit 1
fi
if ! grep -Fq 'No findings.' "$tmp_dir/reports/findings.md" ||
  grep -Eq '^### (Open Source|Container|Code|IaC) findings$' "$tmp_dir/reports/findings.md"; then
  echo 'Successful clean scans should not create findings sections' >&2
  exit 1
fi
if ! run_case absolute 1 0 0 test-org-id false true; then
  cat "$tmp_dir/output.log" >&2
  echo 'Informational scans should pass when all severities have findings' >&2
  exit 1
fi
if grep -Fq -- '--severity-threshold' "$tmp_dir/calls.log"; then
  echo 'Informational scans should assess every supported severity' >&2
  exit 1
fi
for operation in \
  'snyk test --all-projects --dev --sarif-file-output=' \
  'snyk container test' \
  'snyk code test --report --project-name=laa-record-controlled-work-code' \
  'snyk iac test' \
  'snyk monitor --org=test-org-id --dev --project-name=laa-record-controlled-work-open-source' \
  'snyk container monitor'; do
  assert_logged "$operation"
done
for finding in \
  '| Open Source | findings |' \
  '| Container | findings |' \
  '| Code | findings |' \
  '| IaC | findings |' \
  '| Open Source monitoring | passed |' \
  '| Container monitoring | passed |'; do
  if ! grep -Fq -- "$finding" "$tmp_dir/summary.md"; then
    printf 'Expected informational result missing: %s\n' "$finding" >&2
    exit 1
  fi
done
for report in findings.md findings.txt; do
  for finding in \
    'javascript/NoSQLInjection (Medium)' \
    'SNYK-CC-K8S-123' \
    '(Low): The resource permits public access.'; do
    if ! grep -Fq -- "$finding" "$tmp_dir/reports/$report"; then
      printf 'Expected lower-severity finding missing from %s: %s\n' "$report" "$finding" >&2
      exit 1
    fi
  done
done
if ! jq -e '.runs[].results[] | select(.level == "warning")' "$tmp_dir/reports/snyk-code.sarif" >/dev/null ||
  ! jq -e '.runs[].results[] | select(.level == "note")' "$tmp_dir/reports/snyk-iac.sarif" >/dev/null; then
  echo 'Medium and low findings should remain in their SARIF reports' >&2
  exit 1
fi
if run_case absolute 1 0 2 test-org-id false true; then
  echo 'An OSS baseline publication failure should fail the run' >&2
  exit 1
fi
for operation in \
  'snyk container test' \
  'snyk code test --report --project-name=laa-record-controlled-work-code' \
  'snyk iac test' \
  'snyk container monitor'; do
  assert_logged "$operation"
done
for report in findings.md findings.txt snyk-open-source.sarif snyk-container.sarif snyk-code.sarif snyk-iac.sarif; do
  if [[ ! -f "$tmp_dir/reports/$report" ]]; then
    printf 'Expected report to remain available after publication failure: %s\n' "$report" >&2
    exit 1
  fi
done
if SNYK_REPORT_ERROR=code,iac run_case absolute 1 0 0 test-org-id false true; then
  echo 'A Snyk dashboard publication error should fail the informational run' >&2
  exit 1
fi
for result in '| Code | tool error (2) |' '| IaC | tool error (2) |'; do
  if ! grep -Fq -- "$result" "$tmp_dir/summary.md"; then
    printf 'Expected publication error result missing: %s\n' "$result" >&2
    exit 1
  fi
done
for operation in \
  'snyk monitor --org=test-org-id --dev --project-name=laa-record-controlled-work-open-source' \
  'snyk container monitor' \
  'snyk code test --report --project-name=laa-record-controlled-work-code' \
  'snyk iac test'; do
  assert_logged "$operation"
done
for report in findings.md findings.txt snyk-open-source.sarif snyk-container.sarif snyk-code.sarif snyk-iac.sarif; do
  if [[ ! -f "$tmp_dir/reports/$report" ]]; then
    printf 'Expected report to remain available after dashboard error: %s\n' "$report" >&2
    exit 1
  fi
done
if run_case absolute 0 0 0 test-org-id false true '' 1; then
  echo 'A failed Container monitor write with exit code 1 should fail the workflow' >&2
  exit 1
fi
if ! grep -Fq 'Snyk Container monitoring failed with exit code 1' "$tmp_dir/output.log" ||
  ! grep -Fq '| Container monitoring | tool error (1) |' "$tmp_dir/summary.md" ||
  grep -Fq '| Container monitoring | findings |' "$tmp_dir/summary.md"; then
  echo 'Container monitor failures should be reported as operational errors' >&2
  exit 1
fi
assert_logged 'snyk monitor --org=test-org-id --dev --project-name=laa-record-controlled-work-open-source --target-reference=main'
assert_logged 'snyk code test --report --project-name=laa-record-controlled-work-code --target-reference=main --sarif-file-output='
assert_logged '--report --target-name=laa-record-controlled-work-iac --target-reference=main --sarif-file-output='

if SNYK_HIGH_FINDINGS=true run_case absolute 1 0 0 test-org-id true; then
  echo 'High findings should fail when strict findings are enabled' >&2
  exit 1
fi
for scan in Open\ Source Container Code IaC; do
  if ! grep -Fq "| $scan | findings |" "$tmp_dir/summary.md"; then
    printf 'High-threshold findings should be gated for %s\n' "$scan" >&2
    exit 1
  fi
done

if ! SNYK_LOW_SEVERITY_SCANS=code,iac run_case absolute 1 0 0 test-org-id true false 'open-source,container'; then
  cat "$tmp_dir/output.log" >&2
  echo 'Medium and low findings should pass the high-threshold gate' >&2
  exit 1
fi
for scan in Code IaC; do
  if ! grep -Fq "| $scan | passed |" "$tmp_dir/summary.md"; then
    printf 'Lower-severity findings should not fail the %s gate\n' "$scan" >&2
    exit 1
  fi
done

if ! run_case monitor 0 0; then
  cat "$tmp_dir/output.log" >&2
  echo 'Baseline monitoring should pass without an image' >&2
  exit 1
fi
assert_logged 'snyk monitor --org=test-org-id --dev --project-name=laa-record-controlled-work-open-source --target-reference=main'
if grep -Fq 'container test' "$tmp_dir/calls.log"; then
  echo 'Monitor mode should run only the Open Source monitor' >&2
  exit 1
fi
if run_case monitor 0 0 1; then
  cat "$tmp_dir/output.log" >&2
  echo 'A failed monitoring write with exit code 1 should fail the workflow' >&2
  exit 1
fi
if ! grep -Fq 'Snyk Open Source monitoring failed with exit code 1' "$tmp_dir/output.log"; then
  echo 'The monitoring failure should be reported as an operational error' >&2
  exit 1
fi
if ! grep -Fq '| Open Source monitoring | tool error (1) |' "$tmp_dir/summary.md" ||
  grep -Fq '| Open Source monitoring | findings |' "$tmp_dir/summary.md"; then
  echo 'A failed OSS monitor write should not be summarized as vulnerability findings' >&2
  exit 1
fi
if run_case monitor 0 0 2; then
  echo 'A failed baseline update should fail the workflow' >&2
  exit 1
fi

if ! grep -Fq 'Snyk Open Source monitoring failed with exit code 2' "$tmp_dir/output.log"; then
  echo 'The monitoring failure should identify the operational exit code' >&2
  exit 1
fi
ruby -r yaml - "$repo_root" <<'RUBY'
repo_root = ARGV.fetch(0)
cicd = YAML.load_file(File.join(repo_root, ".github/workflows/cicd.yml"))
snyk = YAML.load_file(File.join(repo_root, ".github/workflows/snyk.yml"))
events = cicd.fetch(cicd.key?("on") ? "on" : true)
raise "CICD must run Snyk on pull requests" unless events.key?("pull_request")
raise "CICD must run Snyk on merge queues" unless events.key?("merge_group")

snyk_inputs = cicd.dig("jobs", "snyk", "with")
expected_mode = "${{ (github.event_name == 'pull_request' || github.event_name == 'merge_group') && 'delta' || 'absolute' }}"
expected_gate = "${{ github.event_name == 'pull_request' || github.event_name == 'merge_group' }}"
raise "PR and merge-group runs must select OSS delta" unless snyk_inputs["scan_mode"] == expected_mode
raise "PR and merge-group runs must gate absolute findings" unless snyk_inputs["fail_on_findings"] == expected_gate
raise "Contributor runs must not publish Snyk snapshots" unless snyk_inputs["report_to_snyk"] == false

nightly = YAML.load_file(File.join(repo_root, ".github/workflows/nightly.yml"))
nightly_events = nightly.fetch(nightly.key?("on") ? "on" : true)
raise "Nightly must retain scheduled and manual triggers" unless nightly_events.key?("schedule") && nightly_events.key?("workflow_dispatch")

nightly_jobs = nightly.fetch("jobs")
resolver = nightly_jobs.fetch("resolve-main-image")
raise "Only main may resolve a publishable image" unless resolver["if"] == "github.ref == 'refs/heads/main'"
image_tag = resolver.fetch("steps").filter_map { |step| step.dig("env", "IMAGE_TAG") }.first
raise "Nightly must assess the triggering main commit" unless image_tag == "${{ github.sha }}"

nightly_scan = nightly_jobs.fetch("snyk")
raise "Nightly scan must depend on trusted main image resolution" unless Array(nightly_scan["needs"]).include?("resolve-main-image")
raise "Non-main dispatches must not run the nightly scan" unless nightly_scan["if"] == "github.ref == 'refs/heads/main'"
nightly_inputs = nightly_scan.fetch("with")
raise "Nightly must scan the triggering commit" unless nightly_inputs["source_sha"] == "${{ github.sha }}"
raise "Nightly must use absolute all-severity scans" unless nightly_inputs["scan_mode"] == "absolute" && nightly_inputs["fail_on_findings"] == false
raise "Nightly must publish Snyk dashboards" unless nightly_inputs["report_to_snyk"] == true
raise "Nightly must scan the resolved immutable image" unless nightly_inputs["image_digest"] == "${{ needs.resolve-main-image.outputs.image_digest }}"
raise "Nightly must use the configured immutable image repository" unless nightly_inputs["image_repo"] == "${{ vars.ECR_REPOSITORY }}"

main_monitor = cicd.dig("jobs", "snyk-monitor", "with")
raise "Main CI must retain OSS-only baseline monitoring" unless main_monitor["scan_mode"] == "monitor" && main_monitor["source_sha"] == "${{ github.sha }}"

publication_guard = snyk.dig("jobs", "scan", "steps").find do |step|
  step.fetch("run", "").include?("Snyk UI reporting requires the current trusted main commit")
end
unless publication_guard && publication_guard["if"].include?("github.ref != 'refs/heads/main'") &&
  publication_guard["if"].include?("inputs.source_sha != github.sha")
  raise "Snyk publication must reject non-main or mismatched source commits"
end

uploads = snyk.dig("jobs", "scan", "steps").select do |step|
  step["uses"]&.include?("upload-sarif")
end
raise "All four available SARIF reports should retain upload steps" unless uploads.length == 4
uploads.each do |step|
  condition = step.fetch("if", "")
  unless condition.include?("always()") && condition.include?("github.event_name != 'merge_group'") && condition.include?("hashFiles(")
    raise "SARIF upload must attempt available PR reports and exclude merge groups"
  end
  raise "Required SARIF uploads must fail when publication fails" if step["continue-on-error"]
end

nightly_notification = nightly_jobs.values.find do |job|
  Array(job["needs"]).include?("snyk") &&
    job.fetch("steps", []).any? { |step| step["uses"] == "./.github/actions/notify-slack" }
end
raise "Nightly must notify Slack after its scan" unless nightly_notification
notification_condition = nightly_notification.fetch("if", "")
unless notification_condition.include?("always()") &&
  notification_condition.include?("github.ref == 'refs/heads/main'") &&
  !notification_condition.include?("contains(needs.*.result, 'failure')")
  raise "Nightly findings must reach Slack on successful main runs"
end
notification_steps = nightly_notification.fetch("steps")
slack_step = notification_steps.find { |step| step["uses"] == "./.github/actions/notify-slack" }
raise "Nightly findings must use the existing Slack action" unless slack_step
slack_message = slack_step.dig("with", "message")
raise "Nightly Slack reports must include formatted findings" unless slack_message.include?("${{ steps.findings.outputs.list }}")
unless slack_message.include?("needs.snyk.result == 'success'") &&
  slack_message.include?("Nightly Snyk scan failed")
  raise "Nightly Slack must retain an operational-failure alert"
end
raise "Nightly Slack reports must retain an unavailable-findings fallback" unless notification_steps.any? do |step|
  step.fetch("run", "").include?("Findings report unavailable.")
end
RUBY
node --test "$repo_root/.github/scripts/test-format-snyk-findings.mjs"

echo 'Snyk scan mode checks passed'
