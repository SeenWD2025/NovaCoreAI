# Storage Module - Block Storage and Spaces

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

# Block storage volume for ML models
resource "digitalocean_volume" "models" {
  region                  = var.region
  name                    = "novacore-models-${var.environment}"
  size                    = 100 # 100GB for LLM models
  description             = "Storage for LLM models and artifacts"
  initial_filesystem_type = "ext4"
  
  tags = [
    "storage",
    "models",
    var.environment
  ]
}

# Spaces bucket for static assets and backups
resource "digitalocean_spaces_bucket" "assets" {
  name   = "novacore-assets-${var.environment}"
  region = var.region == "nyc3" ? "nyc3" : "nyc3" # Spaces regions are limited
  
  acl = "private"

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://novacore.ai", "https://www.novacore.ai"]
    max_age_seconds = 3600
  }

  versioning {
    enabled = var.environment == "production"
  }

  lifecycle_rule {
    id      = "cleanup-old-backups"
    enabled = true
    
    prefix = "backups/"
    
    expiration {
      days = 30
    }
  }
}

# Spaces bucket for database backups
resource "digitalocean_spaces_bucket" "backups" {
  name   = "novacore-backups-${var.environment}"
  region = var.region == "nyc3" ? "nyc3" : "nyc3"
  
  acl = "private"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    id      = "cleanup-old-backups"
    enabled = true
    
    expiration {
      days = 90 # Keep backups for 90 days
    }
  }
}

output "model_volume_id" {
  description = "Block storage volume ID for models"
  value       = digitalocean_volume.models.id
}

output "bucket_endpoint" {
  description = "Spaces bucket endpoint"
  value       = "https://${digitalocean_spaces_bucket.assets.name}.${digitalocean_spaces_bucket.assets.region}.digitaloceanspaces.com"
}

output "assets_bucket_name" {
  description = "Assets bucket name"
  value       = digitalocean_spaces_bucket.assets.name
}

output "backups_bucket_name" {
  description = "Backups bucket name"
  value       = digitalocean_spaces_bucket.backups.name
}
