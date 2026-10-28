{{/*
Expand the name of the chart.
*/}}
{{- define "laa-record-controlled-work.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "laa-record-controlled-work.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "laa-record-controlled-work.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "laa-record-controlled-work.labels" -}}
helm.sh/chart: {{ include "laa-record-controlled-work.chart" . }}
{{ include "laa-record-controlled-work.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "laa-record-controlled-work.selectorLabels" -}}
app.kubernetes.io/name: {{ include "laa-record-controlled-work.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "laa-record-controlled-work.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "laa-record-controlled-work.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "laa-record-controlled-work.egress.validate" -}}
{{- $egress := .Values.networkPolicy.egress -}}
{{- range $name, $group := dict "rcwExternalHttps" $egress.rcwExternalHttps "ccqExternalHttps" $egress.ccqExternalHttps "redis" $egress.redis }}
{{- if empty $group.cidrs }}
{{- fail (printf "networkPolicy.egress.%s.cidrs must not be empty when egress is enabled" $name) }}
{{- end }}
{{- range $index, $cidr := $group.cidrs }}
{{- if empty (trim $cidr) }}
{{- fail (printf "networkPolicy.egress.%s.cidrs[%d] must not be empty when egress is enabled" $name $index) }}
{{- end }}
{{- end }}
{{- end }}
{{- if empty $egress.dns.namespace }}
{{- fail "networkPolicy.egress.dns.namespace must be set when egress is enabled" }}
{{- end }}
{{- if empty $egress.dns.podSelector }}
{{- fail "networkPolicy.egress.dns.podSelector must not be empty when egress is enabled" }}
{{- end }}
{{- if empty $egress.rcwApi.namespace }}
{{- fail "networkPolicy.egress.rcwApi.namespace must be set when egress is enabled" }}
{{- end }}
{{- if empty $egress.rcwApi.podSelector }}
{{- fail "networkPolicy.egress.rcwApi.podSelector must not be empty when egress is enabled" }}
{{- end }}
{{- if $egress.ccqTelemetry.enabled }}
{{- if empty $egress.ccqTelemetry.cidrs }}
{{- fail "networkPolicy.egress.ccqTelemetry.cidrs must not be empty when telemetry is enabled" }}
{{- end }}
{{- range $index, $cidr := $egress.ccqTelemetry.cidrs }}
{{- if empty (trim $cidr) }}
{{- fail (printf "networkPolicy.egress.ccqTelemetry.cidrs[%d] must not be empty when telemetry is enabled" $index) }}
{{- end }}
{{- end }}
{{- end }}
{{- end -}}

{{- define "laa-record-controlled-work.egress.dnsRule" -}}
- to:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: {{ .Values.networkPolicy.egress.dns.namespace | quote }}
    podSelector:
      matchLabels:
        {{- toYaml .Values.networkPolicy.egress.dns.podSelector | nindent 8 }}
  ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
{{- end -}}

{{- define "laa-record-controlled-work.egress.ipBlocks" -}}
{{- $blocks := list -}}
{{- range . -}}
{{- $blocks = append $blocks (dict "ipBlock" (dict "cidr" .)) -}}
{{- end -}}
{{- toYaml $blocks -}}
{{- end -}}
