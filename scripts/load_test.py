#!/usr/bin/env python3
"""
Load Testing Script for NovaCoreAI
Uses locust for load testing key endpoints

Usage:
    python scripts/load_test.py --host http://localhost:5000 --users 50 --spawn-rate 10 --run-time 60s

Requirements:
    pip install locust
"""

from locust import HttpUser, task, between
import random
import json


class NovaCoreUser(HttpUser):
    """Simulates a NovaCoreAI user performing various operations"""
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    
    def on_start(self):
        """Called when a user starts - performs login"""
        # Register a test user
        username = f"test_user_{random.randint(1000, 9999)}"
        password = "TestPassword123!"
        
        register_response = self.client.post("/api/auth/register", json={
            "email": f"{username}@example.com",
            "password": password
        })
        
        if register_response.status_code == 201 or register_response.status_code == 409:
            # Login
            login_response = self.client.post("/api/auth/login", json={
                "email": f"{username}@example.com",
                "password": password
            })
            
            if login_response.status_code == 200:
                data = login_response.json()
                self.token = data.get("access_token")
            else:
                self.token = None
        else:
            self.token = None
    
    def get_headers(self):
        """Get headers with authentication token"""
        if self.token:
            return {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        return {"Content-Type": "application/json"}
    
    @task(10)
    def send_chat_message(self):
        """Send a chat message (most frequent operation)"""
        if not self.token:
            return
        
        messages = [
            "Hello! Tell me about the Reclaimer Ethos.",
            "What are the principles of Noble Growth?",
            "How does memory work in NovaCoreAI?",
            "Explain constitutional AI.",
            "What is the NGS curriculum?",
        ]
        
        message = random.choice(messages)
        
        self.client.post(
            "/api/chat/message",
            headers=self.get_headers(),
            json={
                "message": message,
                "use_memory": True
            },
            name="/api/chat/message"
        )
    
    @task(3)
    def get_memories(self):
        """Retrieve user memories"""
        if not self.token:
            return
        
        self.client.get(
            "/api/memory",
            headers=self.get_headers(),
            name="/api/memory (list)"
        )
    
    @task(2)
    def search_memories(self):
        """Search memories by query"""
        if not self.token:
            return
        
        queries = [
            "learning",
            "growth",
            "principles",
            "ethics",
            "decision making"
        ]
        
        query = random.choice(queries)
        
        self.client.post(
            "/api/memory/search",
            headers=self.get_headers(),
            json={"query": query},
            name="/api/memory/search"
        )
    
    @task(2)
    def get_user_progress(self):
        """Get NGS curriculum progress"""
        if not self.token:
            return
        
        self.client.get(
            "/api/ngs/progress",
            headers=self.get_headers(),
            name="/api/ngs/progress"
        )
    
    @task(1)
    def get_usage_quota(self):
        """Check usage quota"""
        if not self.token:
            return
        
        self.client.get(
            "/api/usage/quota",
            headers=self.get_headers(),
            name="/api/usage/quota"
        )
    
    @task(1)
    def health_check(self):
        """Health check endpoint (unauthenticated)"""
        self.client.get("/health", name="/health")


class AdminUser(HttpUser):
    """Simulates admin operations (lower frequency)"""
    
    wait_time = between(5, 10)
    weight = 1  # 1 admin user for every 10 regular users
    
    @task
    def check_metrics(self):
        """Check Prometheus metrics"""
        self.client.get("/metrics", name="/metrics")


if __name__ == "__main__":
    import os
    os.system("locust -f scripts/load_test.py --host http://localhost:5000")
