# Database Module - Managed PostgreSQL

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_uuid" {
  type = string
}

# Managed PostgreSQL Database
resource "digitalocean_database_cluster" "postgres" {
  name       = "novacore-db-${var.environment}"
  engine     = "pg"
  version    = "15"
  size       = var.environment == "production" ? "db-s-2vcpu-4gb" : "db-s-1vcpu-2gb"
  region     = var.region
  node_count = var.environment == "production" ? 2 : 1 # HA in production
  
  private_network_uuid = var.vpc_uuid

  tags = [
    "database",
    "postgres",
    var.environment
  ]
}

# Create database
resource "digitalocean_database_db" "novacore" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "noble_novacore"
}

# Create connection pool for better performance
resource "digitalocean_database_connection_pool" "pool" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "novacore-pool"
  mode       = "transaction"
  size       = 25
  db_name    = digitalocean_database_db.novacore.name
  user       = digitalocean_database_cluster.postgres.user
}

# Firewall rule to allow VPC access
resource "digitalocean_database_firewall" "postgres_fw" {
  cluster_id = digitalocean_database_cluster.postgres.id

  rule {
    type  = "vpc"
    value = var.vpc_uuid
  }
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = digitalocean_database_cluster.postgres.uri
  sensitive   = true
}

output "host" {
  description = "Database host"
  value       = digitalocean_database_cluster.postgres.host
}

output "port" {
  description = "Database port"
  value       = digitalocean_database_cluster.postgres.port
}

output "database_name" {
  description = "Database name"
  value       = digitalocean_database_db.novacore.name
}

output "user" {
  description = "Database user"
  value       = digitalocean_database_cluster.postgres.user
  sensitive   = true
}

output "password" {
  description = "Database password"
  value       = digitalocean_database_cluster.postgres.password
  sensitive   = true
}

output "pool_uri" {
  description = "Connection pool URI"
  value       = digitalocean_database_connection_pool.pool.uri
  sensitive   = true
}
