# Networking Module - VPC, Firewall Rules

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

# Create VPC for private networking
resource "digitalocean_vpc" "main" {
  name     = "novacore-vpc-${var.environment}"
  region   = var.region
  ip_range = "10.10.0.0/16"
  
  description = "Private network for Noble NovaCoreAI ${var.environment}"
}

# Firewall for application servers
resource "digitalocean_firewall" "app" {
  name = "novacore-app-firewall-${var.environment}"

  droplet_ids = [] # Will be populated by droplet module

  # SSH access
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Gateway API
  inbound_rule {
    protocol         = "tcp"
    port_range       = "5000"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Prometheus
  inbound_rule {
    protocol         = "tcp"
    port_range       = "9090"
    source_addresses = ["10.10.0.0/16"] # Only from VPC
  }

  # Grafana
  inbound_rule {
    protocol         = "tcp"
    port_range       = "3000"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Allow all outbound
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Firewall for GPU server (more restrictive)
resource "digitalocean_firewall" "gpu" {
  name = "novacore-gpu-firewall-${var.environment}"

  droplet_ids = [] # Will be populated by droplet module

  # SSH access
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Intelligence service (internal only)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "8000"
    source_addresses = ["10.10.0.0/16"] # Only from VPC
  }

  # Allow all outbound
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

output "vpc_id" {
  description = "VPC ID"
  value       = digitalocean_vpc.main.id
}

output "firewall_app_id" {
  description = "Application firewall ID"
  value       = digitalocean_firewall.app.id
}

output "firewall_gpu_id" {
  description = "GPU firewall ID"
  value       = digitalocean_firewall.gpu.id
}
