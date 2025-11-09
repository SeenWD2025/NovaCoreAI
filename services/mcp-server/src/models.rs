use serde::{Deserialize, Serialize};
use uuid::Uuid;

// Request/Response models for MCP endpoints

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextFetchRequest {
    pub file_path: String,
    pub file_content: Option<String>,
    pub language: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextFetchResponse {
    pub memories: Vec<MemoryItem>,
    pub context_summary: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryItem {
    pub id: String,
    pub content: String,
    pub tier: String,
    pub confidence_score: f32,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryLogRequest {
    pub file_path: String,
    pub action: String, // "edit", "save", "run", "debug"
    pub content: Option<String>,
    pub outcome: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryLogResponse {
    pub memory_id: String,
    pub stored: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskSubmitRequest {
    pub task_description: String,
    pub file_context: Option<String>,
    pub session_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskSubmitResponse {
    pub session_id: String,
    pub response: String,
    pub tokens_used: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub memory_service: bool,
    pub intelligence_service: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}

// Internal models for service integration

#[derive(Debug, Serialize, Deserialize)]
pub struct MemorySearchRequest {
    pub query: String,
    pub limit: Option<usize>,
    pub tier: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryStoreRequest {
    #[serde(rename = "type")]
    pub memory_type: String,
    pub input_context: String,
    pub output_response: Option<String>,
    pub outcome: Option<String>,
    pub tier: String,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessageRequest {
    pub message: String,
    pub session_id: Option<Uuid>,
    pub use_memory: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessageResponse {
    pub session_id: String,
    pub response: String,
    pub tokens_used: Option<i32>,
}
