use actix_web::{error::ResponseError, http::StatusCode, HttpResponse};
use std::fmt;

#[derive(Debug)]
pub enum McpError {
    ServiceUnavailable(String),
    InvalidRequest(String),
    Unauthorized(String),
    NotFound(String),
    InternalError(String),
}

impl fmt::Display for McpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            McpError::ServiceUnavailable(msg) => write!(f, "Service unavailable: {}", msg),
            McpError::InvalidRequest(msg) => write!(f, "Invalid request: {}", msg),
            McpError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            McpError::NotFound(msg) => write!(f, "Not found: {}", msg),
            McpError::InternalError(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl ResponseError for McpError {
    fn status_code(&self) -> StatusCode {
        match self {
            McpError::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            McpError::InvalidRequest(_) => StatusCode::BAD_REQUEST,
            McpError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            McpError::NotFound(_) => StatusCode::NOT_FOUND,
            McpError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let error_message = self.to_string();
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "error": error_message,
            "status": self.status_code().as_u16(),
        }))
    }
}

impl From<reqwest::Error> for McpError {
    fn from(err: reqwest::Error) -> Self {
        McpError::ServiceUnavailable(err.to_string())
    }
}

impl From<serde_json::Error> for McpError {
    fn from(err: serde_json::Error) -> Self {
        McpError::InvalidRequest(err.to_string())
    }
}
