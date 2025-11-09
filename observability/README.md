# Noble NovaCoreAI - Observability Stack

## Overview

This directory contains the complete observability stack for Noble NovaCoreAI, implementing Phase 13 of the project roadmap.

## Components

### 1. Prometheus
- **Port:** 9090
- **Purpose:** Metrics collection and alerting
- **Configuration:** `prometheus/prometheus.yml`
- **Alert Rules:** `prometheus/rules/alerts.yml`

### 2. Grafana
- **Port:** 3000
- **Purpose:** Visualization and dashboards
- **Default Credentials:** admin/admin (change in production)
- **Dashboards:** Pre-configured system overview dashboard

### 3. Exporters

#### PostgreSQL Exporter
- **Port:** 9187
- **Metrics:** Database connections, queries, table statistics

#### Redis Exporter
- **Port:** 9121
- **Metrics:** Memory usage, commands, key statistics

#### Node Exporter
- **Port:** 9100
- **Metrics:** CPU, memory, disk, network statistics

## Quick Start

### Start Observability Stack

```bash
# Start all services including observability
docker-compose up -d

# View Prometheus
open http://localhost:9090

# View Grafana
open http://localhost:3000
```

### Access Dashboards

1. **Prometheus UI:** http://localhost:9090
   - Query metrics
   - View alerts
   - Check targets

2. **Grafana:** http://localhost:3000
   - Login: admin/admin
   - Pre-configured dashboards automatically loaded
   - System Overview dashboard available

## Metrics Endpoints

All services expose metrics at `/metrics` endpoint:

- Gateway: http://localhost:5000/metrics
- Auth & Billing: http://localhost:3001/metrics
- Intelligence Core: http://localhost:8000/metrics
- Memory Service: http://localhost:8001/metrics
- Noble-Spirit: http://localhost:4000/metrics
- NGS Curriculum: http://localhost:9000/metrics
- MCP Server: http://localhost:7000/mcp/metrics

## Available Metrics

### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `http_requests_in_progress` - Current requests being processed

### Service-Specific Metrics

#### Intelligence Core
- `llm_tokens_used_total` - Total tokens consumed
- `llm_request_duration_seconds` - LLM request duration
- `ollama_health` - Ollama service health status

#### Memory Service
- `memory_storage_used_bytes` - Memory storage usage
- `memory_storage_quota_bytes` - Memory storage quota
- `embedding_generation_duration_seconds` - Embedding generation time
- `memory_tier_count` - Count by memory tier (STM/ITM/LTM)

#### Database
- `pg_stat_database_numbackends` - Active connections
- `pg_stat_database_xact_commit` - Committed transactions
- `pg_stat_database_xact_rollback` - Rolled back transactions

#### Redis
- `redis_memory_used_bytes` - Memory usage
- `redis_connected_clients` - Connected clients
- `redis_commands_processed_total` - Total commands processed

#### System
- `node_cpu_seconds_total` - CPU usage
- `node_memory_MemAvailable_bytes` - Available memory
- `node_filesystem_avail_bytes` - Available disk space

## Alert Rules

### Critical Alerts
- **ServiceDown:** Service unavailable for >1 minute
- **PostgresDown:** Database unavailable
- **RedisDown:** Cache unavailable
- **OllamaServiceUnavailable:** LLM service unavailable
- **DiskSpaceCritical:** <5% disk space remaining

### Warning Alerts
- **HighErrorRate:** >5% error rate for 5 minutes
- **HighLatency:** P95 latency >2 seconds
- **HighDatabaseConnections:** >80% connections used
- **RedisHighMemory:** >90% memory used
- **HighTokenUsage:** >1M tokens per hour
- **HighCPUUsage:** >80% CPU usage
- **HighMemoryUsage:** >85% memory usage
- **DiskSpaceLow:** <15% disk space remaining

## Grafana Dashboards

### System Overview Dashboard
- Service health status (pie chart)
- Total request rate (gauge)
- Request rate by service (time series)
- Response time P50 & P95 (time series)
- HTTP status codes (stacked time series)
- Service status table

### Creating Custom Dashboards

1. Access Grafana at http://localhost:3000
2. Click "+" → "Dashboard"
3. Add panels with Prometheus queries
4. Save dashboard

### Dashboard Variables

Use template variables for dynamic dashboards:
- `$service` - Filter by service name
- `$instance` - Filter by instance
- `$interval` - Time interval for aggregation

## Production Considerations

### Security

1. **Change Default Credentials:**
   ```bash
   # In .env file
   GRAFANA_ADMIN_USER=your_username
   GRAFANA_ADMIN_PASSWORD=your_secure_password
   ```

2. **Enable Authentication:**
   - Configure OAuth2 or LDAP for Grafana
   - Use Prometheus with authentication proxy

3. **Network Security:**
   - Expose only necessary ports
   - Use firewall rules
   - Consider VPN for metrics access

### Data Retention

**Prometheus:**
```yaml
# Add to prometheus.yml
global:
  scrape_interval: 15s
storage:
  tsdb:
    retention.time: 15d  # Keep metrics for 15 days
    retention.size: 10GB  # Or limit by size
```

**Grafana:**
- Grafana uses Prometheus as datasource
- No separate retention needed
- Consider long-term storage solutions (Thanos, Cortex) for production

### Scaling

#### Prometheus
- Use federation for multiple Prometheus instances
- Consider Thanos or Cortex for long-term storage
- Use recording rules for expensive queries

#### Grafana
- Use multiple Grafana instances with load balancer
- Share dashboards via JSON export/import
- Use Grafana Enterprise for advanced features

### Alerting

#### Configure AlertManager

1. Create alertmanager.yml:
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@novacore.ai'
  smtp_auth_username: 'alerts@novacore.ai'
  smtp_auth_password: 'your_password'

route:
  receiver: 'team'
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h

receivers:
  - name: 'team'
    email_configs:
      - to: 'team@novacore.ai'
```

2. Add to docker-compose.yml:
```yaml
alertmanager:
  image: prom/alertmanager:latest
  ports:
    - "9093:9093"
  volumes:
    - ./observability/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
```

#### Notification Channels
- Email (SMTP)
- Slack
- PagerDuty
- Webhooks
- Discord
- Telegram

## Troubleshooting

### Prometheus Not Scraping Targets

1. Check target health in Prometheus UI
2. Verify service is exposing /metrics
3. Check network connectivity:
   ```bash
   docker exec noble-prometheus wget -O- http://intelligence:8000/metrics
   ```

### Grafana Not Showing Data

1. Verify Prometheus datasource:
   - Configuration → Data Sources
   - Test connection

2. Check query syntax in panel editor

3. Verify time range matches data availability

### High Memory Usage

1. Reduce retention time
2. Use recording rules for expensive queries
3. Increase Prometheus memory limit:
   ```yaml
   prometheus:
     deploy:
       resources:
         limits:
           memory: 4G
   ```

### Missing Metrics

1. Check service logs:
   ```bash
   docker logs noble-intelligence
   ```

2. Verify Prometheus is scraping:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

3. Check for Python instrumentation errors

## Best Practices

### Metric Naming
- Use consistent naming: `service_resource_unit`
- Example: `memory_storage_used_bytes`
- Use base units (seconds, bytes)

### Labels
- Keep cardinality low (<100 unique values)
- Use meaningful label names
- Avoid user IDs in labels (use attributes)

### Dashboard Design
- Start with system overview
- Create service-specific dashboards
- Use consistent time ranges
- Add descriptions to panels

### Alerting
- Alert on symptoms, not causes
- Use appropriate thresholds
- Avoid alert fatigue
- Include runbooks in annotations

## Monitoring Checklist

- [ ] All services exposing metrics
- [ ] Prometheus scraping all targets
- [ ] Grafana dashboards configured
- [ ] Alert rules defined
- [ ] AlertManager configured (production)
- [ ] Notification channels tested
- [ ] Data retention configured
- [ ] Backup strategy for dashboards
- [ ] Access controls configured
- [ ] Documentation updated

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)

## Support

For issues or questions:
1. Check service logs: `docker-compose logs [service]`
2. Review Prometheus targets: http://localhost:9090/targets
3. Check Grafana datasource configuration
4. Consult project documentation in `/docs`

---

**Last Updated:** November 9, 2025  
**Phase:** 13 - Observability  
**Status:** Complete
