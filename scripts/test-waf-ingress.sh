#!/usr/bin/env bash
set -euo pipefail

readonly chart="deploy/laa-record-controlled-work"
readonly values_dir="${chart}/values"
branch_release="$(./scripts/release-name.sh 'feature/waf-contract-check')"
readonly branch_release
readonly branch_namespace="laa-record-controlled-work-uat"
readonly branch_host="${branch_release}-laa-record-controlled-work-uat.cloud-platform.service.justice.gov.uk"
readonly branch_identifier="${branch_release}-laa-record-controlled-work-${branch_namespace}-green"
temp_dir="$(mktemp -d)"
readonly temp_dir
trap 'rm -rf "$temp_dir"' EXIT

helm lint "$chart" \
  --namespace "$branch_namespace" \
  --values "${values_dir}/uat.yaml" \
  --set "ingress.annotations.external-dns\\.alpha\\.kubernetes\\.io/set-identifier=${branch_identifier}" \
  --set "ingress.hosts[0].host=${branch_host}"

helm lint "$chart" --values "${values_dir}/uat.yaml"
helm lint "$chart" --values "${values_dir}/staging.yaml"
helm lint "$chart" --values "${values_dir}/production.yaml"

helm template "$branch_release" "$chart" \
  --namespace "$branch_namespace" \
  --values "${values_dir}/uat.yaml" \
  --set "ingress.annotations.external-dns\\.alpha\\.kubernetes\\.io/set-identifier=${branch_identifier}" \
  --set "ingress.hosts[0].host=${branch_host}" \
  > "${temp_dir}/branch-uat.yaml"

helm template "laa-record-controlled-work" "$chart" \
  --namespace "$branch_namespace" \
  --values "${values_dir}/uat.yaml" \
  > "${temp_dir}/uat.yaml"

helm template "laa-record-controlled-work" "$chart" \
  --namespace "laa-record-controlled-work-staging" \
  --values "${values_dir}/staging.yaml" \
  > "${temp_dir}/staging.yaml"

helm template "laa-record-controlled-work" "$chart" \
  --namespace "laa-record-controlled-work-production" \
  --values "${values_dir}/production.yaml" \
  > "${temp_dir}/production.yaml"

ruby - \
  "${temp_dir}/branch-uat.yaml" "branch UAT" "modsec-non-prod" "$branch_host" "$branch_identifier" \
  "${temp_dir}/uat.yaml" "main UAT" "modsec-non-prod" "laa-record-controlled-work-uat.cloud-platform.service.justice.gov.uk" "laa-record-controlled-work-laa-record-controlled-work-uat-green" \
  "${temp_dir}/staging.yaml" "staging" "modsec-non-prod" "laa-record-controlled-work-staging.cloud-platform.service.justice.gov.uk" "laa-record-controlled-work-laa-record-controlled-work-staging-green" \
  "${temp_dir}/production.yaml" "production" "modsec" "record-controlled-work.service.justice.gov.uk" "laa-record-controlled-work-laa-record-controlled-work-production-green" <<'RUBY'
require "yaml"

def assert_equal(expected, actual, description)
  return if expected == actual

  abort "#{description}: expected #{expected.inspect}, got #{actual.inspect}"
end

expected_snippet = "SecRuleEngine On\nSecDefaultAction \"phase:2,pass,log,tag:github_team=laa-record-controlled-work\"\n"

ARGV.each_slice(5) do |path, environment, expected_class, expected_host, expected_identifier|
  documents = YAML.load_stream(File.read(path))
  ingresses = documents.grep(Hash).select { |document| document["kind"] == "Ingress" }
  abort "#{environment}: expected one rendered Ingress, found #{ingresses.length}" unless ingresses.one?

  ingress = ingresses.first
  assert_equal(expected_class, ingress.dig("spec", "ingressClassName"), "#{environment} ingress class")

  annotations = ingress.dig("metadata", "annotations") || {}
  assert_equal("true", annotations["nginx.ingress.kubernetes.io/enable-modsecurity"], "#{environment} ModSecurity enable annotation")
  assert_equal(expected_snippet, annotations["nginx.ingress.kubernetes.io/modsecurity-snippet"], "#{environment} blocking snippet")

  owasp_annotation = annotations.keys.find { |key| key.downcase.include?("owasp") }
  abort "#{environment}: unexpected OWASP annotation #{owasp_annotation.inspect}" if owasp_annotation

  hosts = ingress.dig("spec", "rules").map { |rule| rule["host"] }
  assert_equal([expected_host], hosts, "#{environment} ingress host")
  assert_equal(expected_identifier, annotations["external-dns.alpha.kubernetes.io/set-identifier"], "#{environment} DNS identifier")

  puts "#{environment}: rendered ingress contract passed"
end
RUBY
