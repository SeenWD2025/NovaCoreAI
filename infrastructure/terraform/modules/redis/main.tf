# Redis Module - Managed Redis

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_uuid" {
  type = string
}

# Managed Redis Cluster
resource "digitalocean_database_cluster" "redis" {
  name       = "novacore-redis-${var.environment}"
  engine     = "redis"
  version    = "7"
  size       = var.environment == "production" ? "db-s-2vcpu-4gb" : "db-s-1vcpu-2gb"
  region     = var.region
  node_count = 1
  
  private_network_uuid = var.vpc_uuid

  tags = [
    "cache",
    "redis",
    var.environment
  ]
}

# Firewall rule to allow VPC access
resource "digitalocean_database_firewall" "redis_fw" {
  cluster_id = digitalocean_database_cluster.redis.id

  rule {
    type  = "vpc"
    value = var.vpc_uuid
  }
}

output "connection_string" {
  description = "Redis connection string"
  value       = digitalocean_database_cluster.redis.uri
  sensitive   = true
}

output "host" {
  description = "Redis host"
  value       = digitalocean_database_cluster.redis.host
}

output "port" {
  description = "Redis port"
  value       = digitalocean_database_cluster.redis.port
}

output "password" {
  description = "Redis password"
  value       = digitalocean_database_cluster.redis.password
  sensitive   = true
}
