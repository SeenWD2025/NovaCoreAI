# Distillation Worker Tests

## TODO: Implement Tests

### Unit Tests Needed
- [ ] `test_distillation_service.py` - Nightly distillation logic
- [ ] `test_memory_aggregator.py` - Memory aggregation
- [ ] `test_promotion_logic.py` - Tier promotion (STM→ITM→LTM)
- [ ] `test_scheduler.py` - Cron job scheduling

### Integration Tests Needed
- [ ] `test_distillation_flow.py` - End-to-end distillation
- [ ] `test_memory_service_integration.py` - Memory service calls
- [ ] `test_batch_processing.py` - Batch memory processing

### Test Patterns
Follow patterns from:
- `/services/memory/tests/` for structure
- `/services/intelligence/tests/` for examples

### Coverage Target
**70%+ code coverage**

### Key Test Scenarios
1. Nightly job execution
2. Memory aggregation by user
3. STM→ITM promotion (access count threshold)
4. ITM→LTM promotion (importance score)
5. Batch processing efficiency
6. Error handling and retries
7. Metrics collection
