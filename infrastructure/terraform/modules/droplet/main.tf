# Droplet Module - Virtual Machine Configuration

variable "name" {
  type        = string
  description = "Droplet name"
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "size" {
  type        = string
  description = "Droplet size slug"
}

variable "vpc_uuid" {
  type = string
}

variable "ssh_keys" {
  type        = list(string)
  description = "SSH key IDs"
}

variable "volume_ids" {
  type        = list(string)
  default     = []
  description = "Volume IDs to attach"
}

variable "tags" {
  type        = list(string)
  default     = []
  description = "Tags for the droplet"
}

# Create droplet
resource "digitalocean_droplet" "server" {
  name   = var.name
  region = var.region
  size   = var.size
  image  = "ubuntu-22-04-x64"
  
  vpc_uuid = var.vpc_uuid
  ssh_keys = var.ssh_keys
  
  tags = concat(var.tags, ["novacore", var.environment])
  
  # Enable monitoring
  monitoring = true
  
  # Enable backups for production
  backups = var.environment == "production"
  
  # User data for initial setup
  user_data = templatefile("${path.module}/user-data.sh", {
    hostname    = var.name
    environment = var.environment
  })
}

# Attach volumes if provided
resource "digitalocean_volume_attachment" "attachments" {
  count      = length(var.volume_ids)
  droplet_id = digitalocean_droplet.server.id
  volume_id  = var.volume_ids[count.index]
}

# Reserved IP for production stability
resource "digitalocean_reserved_ip" "server_ip" {
  count  = var.environment == "production" ? 1 : 0
  region = var.region
}

resource "digitalocean_reserved_ip_assignment" "server_ip_assignment" {
  count      = var.environment == "production" ? 1 : 0
  ip_address = digitalocean_reserved_ip.server_ip[0].ip_address
  droplet_id = digitalocean_droplet.server.id
}

output "id" {
  description = "Droplet ID"
  value       = digitalocean_droplet.server.id
}

output "ipv4_address" {
  description = "Public IPv4 address"
  value       = var.environment == "production" ? digitalocean_reserved_ip.server_ip[0].ip_address : digitalocean_droplet.server.ipv4_address
}

output "ipv4_address_private" {
  description = "Private IPv4 address"
  value       = digitalocean_droplet.server.ipv4_address_private
}

output "name" {
  description = "Droplet name"
  value       = digitalocean_droplet.server.name
}
