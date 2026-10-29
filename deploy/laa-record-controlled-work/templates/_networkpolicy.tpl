{{- define "laa-record-controlled-work.validateNetworkPolicies" -}}
{{- $policyPath := .policyPath -}}
{{- range $policy := .policies }}
{{- if or (not (hasKey $policy "enabled")) $policy.enabled }}
{{- if empty $policy.name }}
{{- fail (printf "%s[].name must not be empty" $policyPath) }}
{{- end }}
{{- if empty $policy.policyTypes }}
{{- fail (printf "%s.%s.policyTypes must not be empty" $policyPath $policy.name) }}
{{- end }}
{{- $policyTypes := $policy.policyTypes }}
{{- if $policyTypes }}
{{- if and (has "Ingress" $policyTypes) (empty $policy.ingress) }}
{{- fail (printf "%s.%s.ingress must not be empty" $policyPath $policy.name) }}
{{- end }}
{{- if and (has "Egress" $policyTypes) (empty $policy.egress) }}
{{- fail (printf "%s.%s.egress must not be empty" $policyPath $policy.name) }}
{{- end }}
{{- if has "Egress" $policyTypes }}
{{- range $ruleIndex, $rule := $policy.egress }}
{{- if empty $rule.action }}
{{- fail (printf "%s.%s.egress[%d].action must not be empty" $policyPath $policy.name $ruleIndex) }}
{{- end }}
{{- $destination := $rule.destination }}
{{- if empty $destination }}
{{- fail (printf "%s.%s.egress[%d].destination must not be empty" $policyPath $policy.name $ruleIndex) }}
{{- end }}
{{- if and (empty $destination.nets) (empty $destination.selector) (empty $destination.namespaceSelector) }}
{{- fail (printf "%s.%s.egress[%d].destination must include nets or a selector" $policyPath $policy.name $ruleIndex) }}
{{- end }}
{{- range $cidr := $destination.nets }}
{{- if empty (trim (default "" $cidr)) }}
{{- fail (printf "%s.%s.egress[%d].destination.nets must not contain empty entries" $policyPath $policy.name $ruleIndex) }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- define "laa-record-controlled-work.renderCalicoEgressPolicies" -}}
{{- $root := .root -}}
{{- $component := .component -}}
{{- range $policy := .policies }}
{{- if and (or (not (hasKey $policy "enabled")) $policy.enabled) (has "Egress" $policy.policyTypes) }}
---
apiVersion: projectcalico.org/v3
kind: NetworkPolicy
metadata:
  name: {{ include "laa-record-controlled-work.fullname" $root }}-{{ $policy.name }}
  namespace: {{ $root.Release.Namespace | quote }}
  labels:
    {{- include "laa-record-controlled-work.labels" $root | nindent 4 }}
spec:
  order: 49.0
  selector: {{ printf "app.kubernetes.io/name == '%s' && app.kubernetes.io/instance == '%s' && app.kubernetes.io/component == '%s'" (include "laa-record-controlled-work.name" $root) $root.Release.Name $component | quote }}
  types:
    - Egress
  egress:
    {{- tpl (toYaml $policy.egress) $root | nindent 4 }}
{{- end }}
{{- end }}
{{- end }}
{{- define "laa-record-controlled-work.hasEnabledEgressPolicy" -}}
{{- $hasEnabledEgressPolicy := false -}}
{{- range $policy := . }}
{{- if and (has "Egress" $policy.policyTypes) (or (not (hasKey $policy "enabled")) $policy.enabled) }}
{{- $hasEnabledEgressPolicy = true -}}
{{- end }}
{{- end }}
{{- $hasEnabledEgressPolicy -}}
{{- end }}
