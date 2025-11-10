# NovaCoreAI Observability Guide

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** DevOps Architect - Noble Growth Collective

## Overview

This guide provides comprehensive instructions for monitoring, debugging, and maintaining observability in the NovaCoreAI platform using Prometheus and Grafana.

## Quick Start

### Accessing Observability Tools

```bash
# Start all services including observability stack
docker-compose up -d

# Access Grafana (Dashboards & Visualization)
open http://localhost:3000
# Default credentials: admin / admin (change on first login)

# Access Prometheus (Metrics & Alerts)
open http://localhost:9090

# Access Service Metrics Directly
curl http://localhost:5000/metrics  # Gateway
curl http://localhost:3001/metrics  # Auth-Billing
curl http://localhost:8000/metrics  # Intelligence
curl http://localhost:8001/metrics  # Memory
curl http://localhost:4000/metrics  # Noble-Spirit
curl http://localhost:9000/metrics  # NGS Curriculum
```

## Grafana Dashboards

### Available Dashboards

1. **Service Health** (`novacore-service-health`)
   - Real-time service uptime status
   - Request rate per service
   - Latency percentiles (p50, p95, p99)
   - Error rates (5xx errors)
   - Active WebSocket connections

2. **Business Metrics** (`novacore-business`)
   - Active users (24h, 7d, 30d)
   - Messages sent per day
   - Token usage by subscription tier
   - Quota exceeded events
   - Subscription changes
   - User distribution by tier

3. **AI/ML Metrics** (`novacore-ai-ml`)
   - Ollama inference latency
   - Token usage rate (input/output)
   - Average tokens per request
   - Memory context size
   - Reflection task success rate
   - Distillation success rate
   - Memory tier distribution (STM/ITM/LTM)
   - Vector search performance
   - Constitutional alignment scores

4. **System Overview** (`system-overview`)
   - CPU usage
   - Memory usage
   - Disk space
   - Database connections
   - Redis memory usage
   - Network I/O

### Creating Custom Dashboards

1. Navigate to Grafana: http://localhost:3000
2. Click "+" → "Dashboard" → "Add new panel"
3. Select Prometheus as data source
4. Enter PromQL query (examples below)
5. Configure visualization (time series, gauge, stat, etc.)
6. Save dashboard

## Prometheus Queries (PromQL)

### Service Health Queries

```promql
# Service uptime (1 = up, 0 = down)
up{job="gateway"}

# Request rate per service
rate(http_requests_total[5m])

# Error rate (5xx errors)
rate(http_requests_total{status=~"5.."}[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active connections
sum(websocket_connections_active)
```

### Business Metrics Queries

```promql
# Active users in last 24 hours
count(count by (user_id) (usage_ledger_timestamp))

# Messages sent per hour
rate(chat_messages_total[1h]) * 3600

# Token usage by tier
sum by (tier) (rate(chat_tokens_total[1h]))

# Quota exceeded events
increase(quota_exceeded_total[24h])

# Subscription conversions
increase(subscription_changes_total{tier="pro"}[7d])
```

### AI/ML Metrics Queries

```promql
# Ollama inference latency (p95)
histogram_quantile(0.95, rate(ollama_latency_seconds_bucket[5m]))

# Average tokens per request
avg(chat_tokens_per_request)

# Memory context utilization
avg(memory_context_size)

# Reflection task success rate
rate(reflection_task_completion_total[5m]) / rate(reflection_task_total[5m]) * 100

# Memory tier distribution
sum by (tier) (memory_tier_distribution)

# Vector search latency (p95)
histogram_quantile(0.95, rate(vector_search_latency_seconds_bucket[5m]))
```

### Infrastructure Queries

```promql
# CPU usage
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage percentage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk space remaining
(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100

# Database connections
pg_stat_database_numbackends

# Redis memory usage
redis_memory_used_bytes
```

## Alert Configuration

### Alert Rules Location

Alert rules are defined in: `observability/prometheus/rules/alerts.yml`

### Alert Severity Levels

- **Critical:** Immediate action required (service down, data loss risk)
- **Warning:** Action needed soon (high resource usage, elevated error rate)
- **Info:** Informational (user quota warnings, maintenance notices)

### Configured Alerts

#### Service Health Alerts

| Alert Name | Condition | Duration | Severity |
|------------|-----------|----------|----------|
| ServiceDown | `up == 0` | 1 minute | Critical |
| HighErrorRate | Error rate > 5% | 5 minutes | Warning |
| HighLatency | p95 latency > 2s | 5 minutes | Warning |

#### Database Health Alerts

| Alert Name | Condition | Duration | Severity |
|------------|-----------|----------|----------|
| PostgresDown | `pg_up == 0` | 1 minute | Critical |
| HighDatabaseConnections | > 80% capacity | 5 minutes | Warning |
| RedisDown | `redis_up == 0` | 1 minute | Critical |
| RedisHighMemory | > 90% memory | 5 minutes | Warning |

#### Usage & Quota Alerts

| Alert Name | Condition | Duration | Severity |
|------------|-----------|----------|----------|
| HighQuotaHitRate | > 10 per hour | 5 minutes | Warning |
| UserTokenQuotaWarning | > 80% daily quota | 5 minutes | Info |
| UserMessageQuotaWarning | > 80% daily quota | 5 minutes | Info |
| UnusualUsageSpike | 3x average usage | 10 minutes | Warning |

#### Infrastructure Alerts

| Alert Name | Condition | Duration | Severity |
|------------|-----------|----------|----------|
| HighCPUUsage | > 80% CPU | 10 minutes | Warning |
| HighMemoryUsage | > 85% memory | 10 minutes | Warning |
| DiskSpaceLow | < 15% remaining | 5 minutes | Warning |
| DiskSpaceCritical | < 5% remaining | 1 minute | Critical |

### Alert Notification Channels

#### Slack (Recommended for Production)

```yaml
# Add to observability/prometheus/alertmanager.yml
receivers:
  - name: 'slack-alerts'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#novacore-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

#### Email

```yaml
receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'devops@nobleai.com'
        from: 'alerts@novacore.ai'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@novacore.ai'
        auth_password: 'YOUR_APP_PASSWORD'
```

### Testing Alerts

```bash
# Trigger test alert
curl -X POST http://localhost:9090/api/v1/alerts \
  -d '[
    {
      "labels": {
        "alertname": "TestAlert",
        "severity": "warning"
      },
      "annotations": {
        "summary": "Test alert",
        "description": "This is a test"
      }
    }
  ]'
```

## Log Aggregation

### Viewing Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f gateway
docker-compose logs -f intelligence
docker-compose logs -f memory

# View last 100 lines
docker-compose logs --tail=100 gateway

# Search logs for errors
docker-compose logs | grep -i error

# Search logs by correlation ID
docker-compose logs | grep "correlation_id=abc123"
```

### Structured Logging Format

All logs use JSON format with consistent fields:

```json
{
  "timestamp": "2025-11-09T12:34:56.789Z",
  "level": "info",
  "service": "intelligence",
  "correlation_id": "abc123-def456",
  "user_id": "usr_123",
  "message": "Chat message processed",
  "duration_ms": 234,
  "tokens_used": 150
}
```

### Log Levels

- **ERROR:** Critical errors requiring immediate attention
- **WARN:** Warning conditions that should be investigated
- **INFO:** Normal operational messages
- **DEBUG:** Detailed debugging information (disabled in production)

## Troubleshooting

### High Latency Issues

1. **Check service health:**
   ```bash
   curl http://localhost:5000/health
   ```

2. **Query latency metrics:**
   ```promql
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
   ```

3. **Check Ollama performance:**
   ```bash
   docker logs noble-intelligence | grep ollama
   ```

4. **Review database connections:**
   ```promql
   pg_stat_database_numbackends
   ```

### High Error Rate

1. **Identify failing service:**
   ```promql
   rate(http_requests_total{status=~"5.."}[5m]) by (service)
   ```

2. **Check service logs:**
   ```bash
   docker-compose logs --tail=100 service-name | grep -i error
   ```

3. **Verify service dependencies:**
   ```bash
   docker-compose ps
   ```

### Database Connection Issues

1. **Check PostgreSQL health:**
   ```bash
   docker exec -it noble-postgres pg_isready -U noble
   ```

2. **Monitor connections:**
   ```promql
   pg_stat_database_numbackends / pg_settings_max_connections
   ```

3. **Check for connection leaks:**
   ```bash
   docker exec -it noble-postgres psql -U noble -d noble_novacore \
     -c "SELECT COUNT(*) FROM pg_stat_activity;"
   ```

### Memory Leaks

1. **Monitor service memory:**
   ```promql
   container_memory_usage_bytes{name=~"noble-.*"}
   ```

2. **Check memory trends:**
   - View Grafana System Overview dashboard
   - Look for continuously increasing memory usage

3. **Restart affected service:**
   ```bash
   docker-compose restart service-name
   ```

### Quota Issues

1. **Check quota exceeded rate:**
   ```promql
   rate(quota_exceeded_total[1h])
   ```

2. **Identify users hitting quotas:**
   ```bash
   docker-compose logs intelligence | grep "quota exceeded"
   ```

3. **Review usage patterns:**
   - View Grafana Business Metrics dashboard
   - Check for unusual usage spikes

## Best Practices

### Monitoring Checklist

Daily:
- [ ] Check Grafana Service Health dashboard
- [ ] Review active alerts
- [ ] Monitor error rates
- [ ] Check disk space

Weekly:
- [ ] Review Business Metrics trends
- [ ] Analyze performance bottlenecks
- [ ] Check for memory leaks
- [ ] Review log aggregation

Monthly:
- [ ] Capacity planning review
- [ ] Alert rule tuning
- [ ] Dashboard optimization
- [ ] Documentation updates

### Performance Tuning

1. **Set appropriate scrape intervals:**
   - Default: 15 seconds
   - High-traffic: 10 seconds
   - Low-traffic: 30 seconds

2. **Configure retention periods:**
   - Prometheus: 30 days (production)
   - Logs: 30 days
   - Grafana dashboards: Permanent

3. **Optimize queries:**
   - Use rate() instead of increase() for counters
   - Limit time range for expensive queries
   - Use recording rules for frequently-used queries

### Security

1. **Restrict access to observability tools:**
   - Use strong passwords
   - Enable HTTPS
   - Configure authentication
   - Use firewall rules

2. **Secure metrics endpoints:**
   - Use service-to-service authentication
   - Limit network access
   - Don't expose publicly

3. **Sanitize sensitive data:**
   - Don't log passwords or tokens
   - Redact PII in logs
   - Use correlation IDs instead of user IDs in public metrics

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [TASK_DELEGATION_PLAN.md](./TASK_DELEGATION_PLAN.md) - Observability requirements

---

**Document Status:** Active  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025  
**Maintained By:** DevOps Architect
