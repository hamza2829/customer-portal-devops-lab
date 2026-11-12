output "namespace" {
  description = "Namespace of the deployed portal."
  value       = kubernetes_namespace_v1.portal.metadata[0].name
}

output "ingress_name" {
  description = "Ingress resource that routes browser and API traffic."
  value       = kubernetes_ingress_v1.portal.metadata[0].name
}

output "services" {
  description = "Cluster-local service addresses."
  value = {
    for name, service in kubernetes_service_v1.portal :
    name => "${service.metadata[0].name}.${var.namespace}.svc.cluster.local:${local.workloads[name].port}"
  }
}
