# Noble NovaCoreAI - Main Terraform Configuration
# Provider: DigitalOcean
# Purpose: Infrastructure as Code for production deployment

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    # Configure S3-compatible storage (DigitalOcean Spaces)
    endpoint                    = "https://nyc3.digitaloceanspaces.com"
    region                      = "us-east-1"
    bucket                      = "novacore-terraform-state"
    key                         = "production/terraform.tfstate"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
  }
}

provider "digitalocean" {
  token = var.do_token
}

# Data sources
data "digitalocean_ssh_keys" "all" {}

# Variables
variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "app_domain" {
  description = "Application domain name"
  type        = string
  default     = "novacore.ai"
}

# Modules
module "networking" {
  source = "./modules/networking"
  
  environment = var.environment
  region      = var.region
}

module "database" {
  source = "./modules/database"
  
  environment = var.environment
  region      = var.region
  vpc_uuid    = module.networking.vpc_id
}

module "redis" {
  source = "./modules/redis"
  
  environment = var.environment
  region      = var.region
  vpc_uuid    = module.networking.vpc_id
}

module "storage" {
  source = "./modules/storage"
  
  environment = var.environment
  region      = var.region
}

module "app_server" {
  source = "./modules/droplet"
  
  name         = "novacore-app-${var.environment}"
  environment  = var.environment
  region       = var.region
  size         = "s-4vcpu-8gb"
  vpc_uuid     = module.networking.vpc_id
  ssh_keys     = data.digitalocean_ssh_keys.all.ssh_keys[*].id
  volume_ids   = []
  tags         = ["app", "backend", var.environment]
}

module "gpu_server" {
  source = "./modules/droplet"
  
  name         = "novacore-gpu-${var.environment}"
  environment  = var.environment
  region       = var.region
  size         = "g-8vcpu-32gb" # GPU-optimized droplet
  vpc_uuid     = module.networking.vpc_id
  ssh_keys     = data.digitalocean_ssh_keys.all.ssh_keys[*].id
  volume_ids   = [module.storage.model_volume_id]
  tags         = ["gpu", "llm", var.environment]
}

# Outputs
output "app_server_ip" {
  description = "Public IP of the application server"
  value       = module.app_server.ipv4_address
}

output "gpu_server_ip" {
  description = "Public IP of the GPU server"
  value       = module.gpu_server.ipv4_address
}

output "database_connection" {
  description = "Database connection details"
  value       = module.database.connection_string
  sensitive   = true
}

output "redis_connection" {
  description = "Redis connection details"
  value       = module.redis.connection_string
  sensitive   = true
}

output "storage_endpoint" {
  description = "Object storage endpoint"
  value       = module.storage.bucket_endpoint
}
