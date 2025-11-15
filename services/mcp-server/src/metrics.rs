use std::time::Duration;

use lazy_static::lazy_static;
use prometheus::{self, Encoder, HistogramVec, IntCounterVec, TextEncoder, register_histogram_vec, register_int_counter_vec};

lazy_static! {
    pub static ref MCP_REQUESTS_TOTAL: IntCounterVec = register_int_counter_vec!(
        "mcp_requests_total",
        "Total MCP requests handled",
        &["endpoint", "status"]
    )
    .expect("failed to register mcp_requests_total metric");

    pub static ref MCP_REQUEST_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        "mcp_request_duration_seconds",
        "Request duration for MCP endpoints",
        &["endpoint"],
        vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
    )
    .expect("failed to register mcp_request_duration_seconds metric");
}

pub fn observe_request(endpoint: &str, status: &str, duration: Duration) {
    MCP_REQUESTS_TOTAL
        .with_label_values(&[endpoint, status])
        .inc();
    MCP_REQUEST_DURATION_SECONDS
        .with_label_values(&[endpoint])
        .observe(duration.as_secs_f64());
}

pub fn gather_metrics() -> Result<Vec<u8>, prometheus::Error> {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer)?;
    Ok(buffer)
}
