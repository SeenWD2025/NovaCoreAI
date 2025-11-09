use std::env;

#[derive(Clone)]
pub struct Config {
    pub port: u16,
    pub memory_service_url: String,
    pub intelligence_service_url: String,
    pub jwt_secret: String,
    pub database_url: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        dotenv::dotenv().ok();
        
        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "7000".to_string())
                .parse()
                .expect("PORT must be a valid u16"),
            memory_service_url: env::var("MEMORY_SERVICE_URL")
                .unwrap_or_else(|_| "http://memory:8001".to_string()),
            intelligence_service_url: env::var("INTELLIGENCE_SERVICE_URL")
                .unwrap_or_else(|_| "http://intelligence:8000".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-secret-key".to_string()),
            database_url: env::var("DATABASE_URL").ok(),
        }
    }
}
