// Simple authentication middleware for MCP server
// Extracts user_id from X-User-Id header or Authorization token
// This is an internal service, so we trust the gateway for auth validation

use actix_web::{HttpMessage};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // user_id
    pub exp: usize,   // expiration
    pub iat: usize,   // issued at
}

// Helper function to extract user_id from request
// This can be called in route handlers
pub fn extract_user_id(req: &actix_web::HttpRequest) -> Option<String> {
    // First try to get from extensions (if set by upstream middleware)
    if let Some(user_id) = req.extensions().get::<String>() {
        return Some(user_id.clone());
    }
    
    // Try X-User-Id header
    if let Some(header_value) = req.headers().get("X-User-Id") {
        if let Ok(user_id) = header_value.to_str() {
            return Some(user_id.to_string());
        }
    }
    
    // Try to extract from Authorization Bearer token
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(_token) = auth_str.strip_prefix("Bearer ") {
                // For now, we'll trust the gateway to validate JWTs
                // In production, we'd decode and validate here
                // For MVP, we'll use X-User-Id header which gateway sets
                log::debug!("Bearer token present but using X-User-Id header");
            }
        }
    }
    
    None
}
