mod config;
mod metrics;
mod models;
mod routes;
mod services;
mod middleware;
mod errors;

use actix_web::{web, App, HttpServer, middleware::Logger};
use actix_cors::Cors;
use std::sync::Arc;

use config::Config;
use services::{MemoryServiceClient, IntelligenceServiceClient};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logging
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    // Load configuration
    let config = Config::from_env();
    log::info!("Starting MCP Server on port {}", config.port);
    log::info!("Memory Service: {}", config.memory_service_url);
    log::info!("Intelligence Service: {}", config.intelligence_service_url);
    
    // Create service clients
    let memory_client = Arc::new(MemoryServiceClient::new(&config.memory_service_url));
    let intelligence_client = Arc::new(IntelligenceServiceClient::new(&config.intelligence_service_url));
    
    let bind_address = ("0.0.0.0", config.port);
    
    // Start HTTP server
    HttpServer::new(move || {
        // Configure CORS
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        
        App::new()
            .wrap(Logger::default())
            .wrap(cors)
            .app_data(web::Data::new(memory_client.clone()))
            .app_data(web::Data::new(intelligence_client.clone()))
            .configure(routes::configure_routes)
    })
    .bind(bind_address)?
    .run()
    .await
}
