use crate::errors::McpError;
use crate::models::*;
use reqwest::{Client, StatusCode};
use serde_json::Value;

pub struct MemoryServiceClient {
    base_url: String,
    client: Client,
}

impl MemoryServiceClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
        }
    }

    pub async fn search_memories(
        &self,
        user_id: &str,
        query: &str,
        limit: Option<usize>,
    ) -> Result<Vec<MemoryItem>, McpError> {
        let url = format!("{}/memory/search", self.base_url);
        
        let request_body = MemorySearchRequest {
            query: query.to_string(),
            limit,
            tier: None,
        };

        let response = self.client
            .post(&url)
            .header("X-User-Id", user_id)
            .json(&request_body)
            .send()
            .await?;

        if response.status() != StatusCode::OK {
            return Err(McpError::ServiceUnavailable(
                format!("Memory service returned status: {}", response.status())
            ));
        }

        let result: Value = response.json().await.map_err(|e| {
            McpError::InternalError(format!("Failed to parse memory response: {}", e))
        })?;

        // Parse memories from response
        let memories = result["results"]
            .as_array()
            .ok_or_else(|| McpError::InternalError("Invalid memory response format".to_string()))?
            .iter()
            .map(|m| MemoryItem {
                id: m["id"].as_str().unwrap_or_default().to_string(),
                content: format!(
                    "Input: {}\nOutput: {}",
                    m["input_context"].as_str().unwrap_or(""),
                    m["output_response"].as_str().unwrap_or("")
                ),
                tier: m["tier"].as_str().unwrap_or("ltm").to_string(),
                confidence_score: m["confidence_score"].as_f64().unwrap_or(0.0) as f32,
                created_at: m["created_at"].as_str().unwrap_or_default().to_string(),
            })
            .collect();

        Ok(memories)
    }

    pub async fn store_memory(
        &self,
        user_id: &str,
        memory_type: &str,
        input_context: &str,
        output_response: Option<&str>,
        outcome: Option<&str>,
        tags: Option<Vec<String>>,
    ) -> Result<String, McpError> {
        let url = format!("{}/memory/store", self.base_url);
        
        let request_body = MemoryStoreRequest {
            memory_type: memory_type.to_string(),
            input_context: input_context.to_string(),
            output_response: output_response.map(|s| s.to_string()),
            outcome: outcome.map(|s| s.to_string()),
            tier: "ltm".to_string(),
            tags,
        };

        let response = self.client
            .post(&url)
            .header("X-User-Id", user_id)
            .json(&request_body)
            .send()
            .await?;

        if response.status() != StatusCode::OK && response.status() != StatusCode::CREATED {
            return Err(McpError::ServiceUnavailable(
                format!("Memory service returned status: {}", response.status())
            ));
        }

        let result: Value = response.json().await.map_err(|e| {
            McpError::InternalError(format!("Failed to parse store response: {}", e))
        })?;

        Ok(result["id"].as_str().unwrap_or_default().to_string())
    }

    pub async fn health_check(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        self.client.get(&url).send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }
}

pub struct IntelligenceServiceClient {
    base_url: String,
    client: Client,
}

impl IntelligenceServiceClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
        }
    }

    pub async fn send_message(
        &self,
        user_id: &str,
        message: &str,
        session_id: Option<uuid::Uuid>,
        use_memory: bool,
    ) -> Result<ChatMessageResponse, McpError> {
        let url = format!("{}/chat/message", self.base_url);
        
        let request_body = ChatMessageRequest {
            message: message.to_string(),
            session_id,
            use_memory,
        };

        let response = self.client
            .post(&url)
            .header("X-User-Id", user_id)
            .json(&request_body)
            .send()
            .await?;

        if response.status() != StatusCode::OK {
            return Err(McpError::ServiceUnavailable(
                format!("Intelligence service returned status: {}", response.status())
            ));
        }

        let result: ChatMessageResponse = response.json().await.map_err(|e| {
            McpError::InternalError(format!("Failed to parse intelligence response: {}", e))
        })?;

        Ok(result)
    }

    pub async fn health_check(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        self.client.get(&url).send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }
}
