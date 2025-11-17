# Grafana Dashboard Updates Required

This document tracks required updates to Grafana dashboards for new services (Notes API, Study Engine, Quiz Engine).

## Background

Three new services were added to the platform but are not yet represented in Grafana dashboards:
- **Notes API** (port 8085) - Note management service
- **Study Engine** (port 8090) - Study session management
- **Quiz Engine** (port 8091) - Quiz generation and grading

These services are already configured in Prometheus (`observability/prometheus/prometheus.yml`) and expose `/metrics` endpoints, but the Grafana dashboards need to be updated to visualize their metrics.

## Required Dashboard Updates

### 1. Service Health Dashboard (`service-health.json`)

**Add service status panels:**
- Notes API availability panel (similar to existing service panels)
- Study Engine availability panel
- Quiz Engine availability panel

**Add to request rate graph:**
- `rate(http_requests_total{job="notes-api"}[5m])`
- `rate(http_requests_total{job="study-engine"}[5m])`
- `rate(http_requests_total{job="quiz-engine"}[5m])`

**Add to latency percentiles graph:**
- Notes API p50/p95/p99 latency
- Study Engine p50/p95/p99 latency
- Quiz Engine p50/p95/p99 latency

**Add to error rate graph:**
- Notes API error rate
- Study Engine error rate
- Quiz Engine error rate

### 2. Business Metrics Dashboard (`business-metrics.json`)

**Add new panels:**
- **Note Creation Rate**: `rate(notes_created_total[5m])`
- **Note Retrieval Rate**: `rate(notes_retrieved_total[5m])`
- **Study Sessions Started**: `rate(study_sessions_started_total[5m])`
- **Study Sessions Completed**: `rate(study_sessions_completed_total[5m])`
- **Quiz Generation Rate**: `rate(quizzes_generated_total[5m])`
- **Quiz Completion Rate**: `rate(quizzes_completed_total[5m])`
- **Quiz Average Score**: `avg(quiz_score)`

### 3. AI/ML Metrics Dashboard (`ai-ml-metrics.json`)

**Add new panels:**
- **Quiz Generation Latency**: Time to generate quiz from study material
- **Quiz Generation Success Rate**: Percentage of successful quiz generations
- **Study Material Processing Time**: Time to process notes into study material
- **Gemini API Usage for Quizzes**: Track Gemini API calls for quiz generation

## How to Update Dashboards

### Option 1: Update via Grafana UI (Recommended)

1. **Access Grafana**: http://localhost:3000 (admin/admin)

2. **Edit Service Health Dashboard**:
   - Navigate to Dashboards → Service Health
   - Click "Add panel" or edit existing panels
   - Add queries for new services using the Prometheus data source
   - Use existing panels as templates (copy panel JSON and modify)
   - Save dashboard

3. **Edit Business Metrics Dashboard**:
   - Navigate to Dashboards → Business Metrics
   - Add new panels for note/study/quiz metrics
   - Configure appropriate visualizations (time series, stat, gauge)
   - Save dashboard

4. **Edit AI/ML Metrics Dashboard**:
   - Navigate to Dashboards → AI/ML Metrics
   - Add quiz generation and study processing metrics
   - Save dashboard

5. **Export Updated Dashboards**:
   - Click dashboard settings (gear icon)
   - Select "JSON Model"
   - Copy JSON
   - Save to `observability/grafana/dashboards/<dashboard-name>.json`
   - Commit changes to repository

### Option 2: Manual JSON Editing (Advanced)

Grafana dashboard JSON files are complex (800+ lines). Manual editing is error-prone but possible:

1. Open dashboard JSON file
2. Find existing panel definitions
3. Copy a similar panel
4. Modify:
   - `id` (must be unique)
   - `title`
   - `targets[].expr` (Prometheus query)
   - `gridPos` (x, y, w, h coordinates)
5. Validate JSON syntax
6. Test in Grafana UI

## Verification

After updating dashboards:

1. **Start services**: `docker compose up -d`
2. **Generate traffic**: Use services to create metrics
3. **Check Prometheus**: http://localhost:9090
   - Verify metrics are being scraped: `up{job="notes-api"}`
   - Test queries: `rate(http_requests_total{job="notes-api"}[5m])`
4. **Check Grafana**: http://localhost:3000
   - Verify panels show data (not "No data")
   - Verify time series graphs display correctly
   - Verify stat panels show current values

## Current Status

- ✅ Services added to Prometheus scrape configuration
- ✅ Services expose `/metrics` endpoints
- ✅ Metrics are being collected
- ⏳ Grafana dashboards need manual updates (via UI or JSON)

## Notes

- The Prometheus configuration is complete and working
- Services are already instrumented with metrics
- Dashboard updates are cosmetic/visualization only
- No code changes required, only dashboard configuration
- Recommended to use Grafana UI for updates (safer than manual JSON editing)
