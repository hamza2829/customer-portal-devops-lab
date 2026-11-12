variable "kubeconfig" {
  type        = string
  description = "Kubeconfig file for the local kind cluster."
  default     = "~/.kube/config"
}

variable "kube_context" {
  type        = string
  description = "Context for the local kind cluster."
  default     = "kind-portal"
}

variable "namespace" {
  type        = string
  description = "Namespace for all lab workloads."
  default     = "customer-portal"
}

variable "app_images" {
  type        = object({ web = string, api = string, report = string })
  description = "Locally built image tags preloaded into kind."
  default     = { web = "portal-web:lab", api = "portal-api:lab", report = "portal-report:lab" }
}

variable "postgres_image" {
  type        = string
  description = "PostgreSQL container image."
  default     = "postgres:16-alpine"
}

variable "postgres_password" {
  type        = string
  description = "Synthetic lab database password."
  sensitive   = true
  default     = "portal-demo-db"
}

variable "jwt_secret" {
  type        = string
  description = "Lab JWT signing secret."
  sensitive   = true
  default     = "lab-jwt-signing-secret"
}

variable "report_token" {
  type        = string
  description = "Lab token used by the API to call the report service."
  sensitive   = true
  default     = "lab-report-token"
}
