locals {
  workloads = {
    postgres = {
      image  = var.postgres_image, port = 5432, health = null, pull_policy = "IfNotPresent"
      config = ["POSTGRES_DB", "POSTGRES_USER"], secrets = ["POSTGRES_PASSWORD"]
    }
    report = {
      image  = var.app_images.report, port = 8000, health = "/health", pull_policy = "Never"
      config = [], secrets = ["REPORT_TOKEN"]
    }
    api = {
      image   = var.app_images.api, port = 3001, health = "/api/health", pull_policy = "Never"
      config  = ["DB_HOST", "POSTGRES_DB", "POSTGRES_USER", "REPORT_URL"]
      secrets = ["POSTGRES_PASSWORD", "JWT_SECRET", "REPORT_TOKEN"]
    }
    web = {
      image  = var.app_images.web, port = 3000, health = "/health", pull_policy = "Never"
      config = ["API_URL"], secrets = []
    }
  }
}

resource "kubernetes_namespace_v1" "portal" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_config_map_v1" "portal" {
  metadata {
    name      = "portal-config"
    namespace = kubernetes_namespace_v1.portal.metadata[0].name
  }
  data = {
    DB_HOST       = "postgres"
    POSTGRES_DB   = "portal"
    POSTGRES_USER = "portal"
    REPORT_URL    = "http://report:8000"
    API_URL       = "http://api:3001"
  }
}

resource "kubernetes_secret_v1" "portal" {
  metadata {
    name      = "portal-secrets"
    namespace = kubernetes_namespace_v1.portal.metadata[0].name
  }
  type = "Opaque"
  data = {
    POSTGRES_PASSWORD = var.postgres_password
    JWT_SECRET        = var.jwt_secret
    REPORT_TOKEN      = var.report_token
  }
}

resource "kubernetes_service_v1" "portal" {
  for_each = local.workloads

  metadata {
    name      = each.key
    namespace = kubernetes_namespace_v1.portal.metadata[0].name
  }
  spec {
    selector = { app = each.key }
    port {
      name        = "service"
      port        = each.value.port
      target_port = each.value.port
    }
  }
}

resource "kubernetes_deployment_v1" "portal" {
  for_each = local.workloads

  metadata {
    name      = each.key
    namespace = kubernetes_namespace_v1.portal.metadata[0].name
    labels    = { app = each.key }
  }

  spec {
    replicas = 1
    strategy {
      type = "Recreate"
    }
    selector {
      match_labels = { app = each.key }
    }
    template {
      metadata {
        labels = { app = each.key }
      }
      spec {
        automount_service_account_token = false
        container {
          name              = each.key
          image             = each.value.image
          image_pull_policy = each.value.pull_policy
          port {
            container_port = each.value.port
          }
          dynamic "env" {
            for_each = toset(each.value.config)
            content {
              name = env.key
              value_from {
                config_map_key_ref {
                  name = kubernetes_config_map_v1.portal.metadata[0].name
                  key  = env.key
                }
              }
            }
          }
          dynamic "env" {
            for_each = toset(each.value.secrets)
            content {
              name = env.key
              value_from {
                secret_key_ref {
                  name = kubernetes_secret_v1.portal.metadata[0].name
                  key  = env.key
                }
              }
            }
          }
          readiness_probe {
            period_seconds  = 3
            timeout_seconds = 2
            dynamic "http_get" {
              for_each = each.value.health == null ? [] : [each.value.health]
              content {
                path = http_get.value
                port = each.value.port
              }
            }
            dynamic "exec" {
              for_each = each.key == "postgres" ? [1] : []
              content {
                command = ["pg_isready", "-h", "127.0.0.1", "-U", "portal", "-d", "portal"]
              }
            }
          }
        }
      }
    }
  }
  depends_on = [kubernetes_service_v1.portal]
}

resource "kubernetes_ingress_v1" "portal" {
  metadata {
    name      = "portal"
    namespace = kubernetes_namespace_v1.portal.metadata[0].name
  }
  spec {
    rule {
      http {
        path {
          path      = "/api"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service_v1.portal["api"].metadata[0].name
              port {
                number = local.workloads.api.port
              }
            }
          }
        }
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service_v1.portal["web"].metadata[0].name
              port {
                number = local.workloads.web.port
              }
            }
          }
        }
      }
    }
  }
}
