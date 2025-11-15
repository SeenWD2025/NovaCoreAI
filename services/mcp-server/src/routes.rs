use actix_web::{web, HttpRequest, HttpResponse, Result};
use std::sync::Arc;
use std::time::Instant;

use crate::errors::McpError;
use crate::models::*;
use crate::services::{IntelligenceServiceClient, MemoryServiceClient};
use crate::metrics;

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/mcp")
            .route("/health", web::get().to(health_check))
            .route("/context/fetch", web::post().to(fetch_context))
            .route("/memory/log", web::post().to(log_memory))
            .route("/task/submit", web::post().to(submit_task))
            .route("/metrics", web::get().to(export_metrics))
    );
}

async fn export_metrics() -> Result<HttpResponse, McpError> {
    let start = Instant::now();
    match metrics::gather_metrics() {
        Ok(buffer) => {
            metrics::observe_request("/mcp/metrics", "success", start.elapsed());
            Ok(HttpResponse::Ok()
                .content_type("text/plain; version=0.0.4")
                .body(buffer))
        }
        Err(err) => {
            metrics::observe_request("/mcp/metrics", "error", start.elapsed());
            Err(McpError::InternalError(format!(
                "failed to encode metrics: {}",
                err
            )))
        }
    }
}

/// GET /mcp/health
/// Health check endpoint
async fn health_check(
    memory_client: web::Data<Arc<MemoryServiceClient>>,
    intelligence_client: web::Data<Arc<IntelligenceServiceClient>>,
) -> Result<HttpResponse, McpError> {
    let start = Instant::now();
    log::info!("Health check requested");

    let memory_ok = memory_client.health_check().await;
    let intelligence_ok = intelligence_client.health_check().await;

    let response = HealthResponse {
        status: if memory_ok && intelligence_ok {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
        version: env!("CARGO_PKG_VERSION").to_string(),
        memory_service: memory_ok,
        intelligence_service: intelligence_ok,
    };

    metrics::observe_request("/mcp/health", "success", start.elapsed());

    Ok(HttpResponse::Ok().json(response))
}

/// POST /mcp/context/fetch
/// Fetch relevant context from memory for a file
async fn fetch_context(
    req: HttpRequest,
    request: web::Json<ContextFetchRequest>,
    memory_client: web::Data<Arc<MemoryServiceClient>>,
) -> Result<HttpResponse, McpError> {
    let start = Instant::now();
    let endpoint = "/mcp/context/fetch";
    // Extract user_id from request
    let user_id = match crate::middleware::extract_user_id(&req) {
        Some(id) => id,
        None => {
            metrics::observe_request(endpoint, "error", start.elapsed());
            return Err(McpError::Unauthorized("User ID not found in request".to_string()));
        }
    };

    log::info!("Fetching context for file: {} (user: {})", request.file_path, user_id);

    // Build search query from file path and content
    let query = if let Some(content) = &request.file_content {
        format!("{} {}", request.file_path, content)
    } else {
        request.file_path.clone()
    };

    // Search memories
    let limit = request.limit.unwrap_or(5);
    let memories = match memory_client
        .search_memories(&user_id, &query, Some(limit))
        .await
    {
        Ok(memories) => memories,
        Err(err) => {
            metrics::observe_request(endpoint, "error", start.elapsed());
            return Err(err);
        }
    };

    // Build context summary
    let context_summary = if memories.is_empty() {
        "No relevant context found.".to_string()
    } else {
        format!(
            "Found {} relevant memory items related to {}",
            memories.len(),
            request.file_path
        )
    };

    let response = ContextFetchResponse {
        memories,
        context_summary,
    };

    metrics::observe_request(endpoint, "success", start.elapsed());

    Ok(HttpResponse::Ok().json(response))
}

/// POST /mcp/memory/log
/// Log a code interaction to memory
async fn log_memory(
    req: HttpRequest,
    request: web::Json<MemoryLogRequest>,
    memory_client: web::Data<Arc<MemoryServiceClient>>,
) -> Result<HttpResponse, McpError> {
    let start = Instant::now();
    let endpoint = "/mcp/memory/log";
    // Extract user_id from request
    let user_id = match crate::middleware::extract_user_id(&req) {
        Some(id) => id,
        None => {
            metrics::observe_request(endpoint, "error", start.elapsed());
            return Err(McpError::Unauthorized("User ID not found in request".to_string()));
        }
    };

    log::info!(
        "Logging memory: {} action on {} (user: {})",
        request.action,
        request.file_path,
        user_id
    );

    // Prepare memory content
    let input_context = format!(
        "File: {}\nAction: {}\n{}",
        request.file_path,
        request.action,
        request.content.as_ref().unwrap_or(&String::new())
    );

    let output_response = request.outcome.as_ref().map(|s| s.as_str());
    
    // Prepare tags
    let tags = Some(vec![
        request.action.clone(),
        "vscode".to_string(),
        "mcp".to_string(),
    ]);

    // Store memory
    let memory_id = match memory_client
        .store_memory(
            &user_id,
            "code_interaction",
            &input_context,
            output_response,
            request.outcome.as_deref(),
            tags,
        )
        .await
    {
        Ok(id) => id,
        Err(err) => {
            metrics::observe_request(endpoint, "error", start.elapsed());
            return Err(err);
        }
    };

    let response = MemoryLogResponse {
        memory_id: memory_id.clone(),
        stored: true,
        message: format!("Memory {} stored successfully", memory_id),
    };

    metrics::observe_request(endpoint, "success", start.elapsed());

    Ok(HttpResponse::Ok().json(response))
}

/// POST /mcp/task/submit
/// Submit a task to the Intelligence Core
async fn submit_task(
    req: HttpRequest,
    request: web::Json<TaskSubmitRequest>,
    intelligence_client: web::Data<Arc<IntelligenceServiceClient>>,
) -> Result<HttpResponse, McpError> {
    let start = Instant::now();
    let endpoint = "/mcp/task/submit";
    // Extract user_id from request
    let user_id = match crate::middleware::extract_user_id(&req) {
        Some(id) => id,
        None => {
            metrics::observe_request(endpoint, "error", start.elapsed());
            return Err(McpError::Unauthorized("User ID not found in request".to_string()));
        }
    };

    log::info!("Submitting task for user: {}", user_id);

    // Build message with file context if provided
    let message = if let Some(context) = &request.file_context {
        format!(
            "File Context:\n{}\n\nTask: {}",
            context, request.task_description
        )
    } else {
        request.task_description.clone()
    };

    // Send to intelligence service with memory enabled
    let result = match intelligence_client
        .send_message(&user_id, &message, request.session_id, true)
        .await
    {
        Ok(result) => result,
        Err(err) => {
            metrics::observe_request(endpoint, "error", start.elapsed());
            return Err(err);
        }
    };

    let response = TaskSubmitResponse {
        session_id: result.session_id,
        response: result.response,
        tokens_used: result.tokens_used,
    };

    metrics::observe_request(endpoint, "success", start.elapsed());

    Ok(HttpResponse::Ok().json(response))
}
