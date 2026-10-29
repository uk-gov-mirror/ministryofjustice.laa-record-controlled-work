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
{{- if empty $rule.to }}
{{- fail (printf "%s.%s.egress[%d].to must not be empty" $policyPath $policy.name $ruleIndex) }}
{{- end }}
{{- range $destination := $rule.to }}
{{- if hasKey $destination "ipBlock" }}
{{- if empty (trim (default "" $destination.ipBlock.cidr)) }}
{{- fail (printf "%s.%s.egress[%d].ipBlock.cidr must not be empty" $policyPath $policy.name $ruleIndex) }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
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
