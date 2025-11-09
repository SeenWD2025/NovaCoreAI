#!/usr/bin/env python3
"""
Validation script to verify all implementations are complete.
This checks for common issues and missing implementations.
"""
import os
import sys
from pathlib import Path

def check_file_exists(filepath, description):
    """Check if a file exists."""
    if Path(filepath).exists():
        print(f"✓ {description}: {filepath}")
        return True
    else:
        print(f"✗ {description}: {filepath} - MISSING")
        return False

def check_implementation(filepath, patterns, description):
    """Check if file contains expected patterns."""
    if not Path(filepath).exists():
        print(f"✗ {description}: {filepath} - FILE MISSING")
        return False
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    missing = []
    for pattern in patterns:
        if pattern not in content:
            missing.append(pattern)
    
    if missing:
        print(f"✗ {description}: Missing implementations:")
        for m in missing:
            print(f"  - {m}")
        return False
    else:
        print(f"✓ {description}: All patterns found")
        return True

def main():
    """Run all validation checks."""
    print("=" * 70)
    print("NovaCoreAI Implementation Validation")
    print("=" * 70)
    
    checks = []
    
    # Check Phase 4: Intelligence Core
    print("\n--- Phase 4: Intelligence Core ---")
    checks.append(check_implementation(
        "services/intelligence/app/routers/chat.py",
        [
            "track_token_usage",
            "get_user_tier",
            "trigger_reflection",
            "store_stm_interaction",
            "get_memory_context"
        ],
        "Intelligence Core - Memory Integration"
    ))
    
    checks.append(check_implementation(
        "services/intelligence/app/services/session_service.py",
        [
            "def get_user_tier",
            "def track_token_usage",
            "usage_ledger"
        ],
        "Intelligence Core - Usage Tracking"
    ))
    
    # Check Phase 5: Memory Service
    print("\n--- Phase 5: Cognitive Memory Service ---")
    checks.append(check_implementation(
        "services/memory/app/routers/memory.py",
        [
            "store_memory",
            "get_memory",
            "search_memories",
            "promote_memory",
            "store_stm",
            "get_itm",
            "get_context"
        ],
        "Memory Service - All Endpoints"
    ))
    
    checks.append(check_implementation(
        "services/memory/app/services/memory_service.py",
        [
            "generate_embedding",
            "vector_embedding",
            "pgvector"
        ],
        "Memory Service - Vector Search"
    ))
    
    checks.append(check_implementation(
        "services/memory/app/redis_client.py",
        [
            "store_stm",
            "get_stm",
            "store_itm",
            "get_itm"
        ],
        "Memory Service - Redis Operations"
    ))
    
    # Check Phase 6: Policy Service
    print("\n--- Phase 6: Noble-Spirit Policy Service ---")
    checks.append(check_implementation(
        "services/noble-spirit/app/services/policy_service.py",
        [
            "validate_content",
            "validate_alignment",
            "HARMFUL_PATTERNS",
            "create_policy",
            "log_audit"
        ],
        "Policy Service - Validation Logic"
    ))
    
    # Check Phase 7: Reflection Worker
    print("\n--- Phase 7: Reflection Worker ---")
    checks.append(check_implementation(
        "services/reflection-worker/app/tasks.py",
        [
            "reflect_on_interaction",
            "validate_alignment_with_policy",
            "generate_self_assessment",
            "store_reflection"
        ],
        "Reflection Worker - Task Implementation"
    ))
    
    # Check Phase 8: Distillation Worker
    print("\n--- Phase 8: Distillation Worker ---")
    checks.append(check_implementation(
        "services/distillation-worker/app/distiller.py",
        [
            "run_distillation",
            "fetch_recent_reflections",
            "create_distilled_knowledge",
            "promote_itm_to_ltm"
        ],
        "Distillation Worker - Distillation Logic"
    ))
    
    checks.append(check_file_exists(
        "services/distillation-worker/main.py",
        "Distillation Worker - Main Entry Point"
    ))
    
    # Check Docker Configuration
    print("\n--- Docker Configuration ---")
    checks.append(check_file_exists(
        "docker-compose.yml",
        "Docker Compose Configuration"
    ))
    
    for service in ["intelligence", "memory", "noble-spirit", "reflection-worker", "distillation-worker"]:
        checks.append(check_file_exists(
            f"services/{service}/Dockerfile",
            f"{service} - Dockerfile"
        ))
    
    # Check Database Schema
    print("\n--- Database Schema ---")
    checks.append(check_implementation(
        "shared/schemas/01_init.sql",
        [
            "CREATE TABLE IF NOT EXISTS memories",
            "CREATE TABLE IF NOT EXISTS usage_ledger",
            "CREATE TABLE IF NOT EXISTS policies",
            "CREATE TABLE IF NOT EXISTS reflections",
            "CREATE TABLE IF NOT EXISTS distilled_knowledge",
            "CREATE EXTENSION IF NOT EXISTS vector"
        ],
        "Database Schema - All Tables"
    ))
    
    # Summary
    print("\n" + "=" * 70)
    total = len(checks)
    passed = sum(checks)
    failed = total - passed
    
    print(f"Total Checks: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n✅ ALL IMPLEMENTATIONS VERIFIED!")
        return 0
    else:
        print(f"\n❌ {failed} CHECKS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
