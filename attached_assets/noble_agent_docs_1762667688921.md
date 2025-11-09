# Noble Agent Node - Comprehensive Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Development Stages](#development-stages)
4. [Module Specifications](#module-specifications)
5. [Memory Systems](#memory-systems)
6. [Reflection Engine](#reflection-engine)
7. [Consequence System](#consequence-system)
8. [API Specifications](#api-specifications)
9. [Deployment Architecture](#deployment-architecture)
10. [Environment Configuration](#environment-configuration)
11. [Integration Guidelines](#integration-guidelines)
12. [Modularization Strategy](#modularization-strategy)

---

## System Overview

### Core Philosophy
The Noble Agent Node is **not a chatbot** - it is the cognitive skeleton of a living system built on clean, local LLM inference. The system emphasizes:

- **Memory, Reflection, Consequence, and Growth** layers engineered on top of the model
- **Highly modular architecture** with isolated responsibilities
- **Open-source LLMs only** (self-hosted, local inference)
- **Environment discovery and full configuration flexibility**
- **Built to scale and rebrand** as foundation for "Noble AI"

### Key Principles
- **Cloud-native first** (DigitalOcean deployment)
- **Self-hosted control** (your infrastructure, your rules)
- **Docker-first mentality** (containers for isolation)
- **No external proprietary model APIs** unless explicitly requested

---

## Core Architecture

### System Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Noble Growth App** | Frontend + Backend App Structure | Droplet A |
| **Noble Agent Node** | Agent Runtime & LLM Infrastructure | Droplet B |
| **Database** | Memory, Reflections, Agent Data | DigitalOcean PostgreSQL |
| **Memory Vector DB** | ChromaDB Container | Droplet A or Separate |

### Technology Stack
- **Runtime**: Node.js
- **LLM**: Mistral 7B (preferred) or TinyLlama
- **LLM Server**: Ollama or vLLM for fast inference
- **Database**: PostgreSQL (managed)
- **Vector DB**: ChromaDB
- **Containerization**: Docker
- **Networking**: DigitalOcean Reserved IPs, HTTPS via Caddy/NGINX

---

## Development Stages

| Stage | Objective | Deliverable |
|-------|-----------|-------------|
| **1** | Create modular agent runtime project scaffold | `/noble-agent-node/` directory initialized |
| **2** | Build LLM Connector service | Basic inference POST/GET functions to local model server |
| **3** | Build Memory Service | Memory save/retrieve (Short-Term, Long-Term, Negative Memory) |
| **4** | Build Reflection Engine | After each task, trigger reflections stored into memory |
| **5** | Build Consequence System | XP locks, Trust decay if poor behavior observed |
| **6** | Build Governance Enforcement | Constitution checks before reflection acceptance |
| **7** | Expose Agent APIs | Accept prompt, return response, log reflections |
| **8** | Build Docker Deployment Assets | Dockerfile, docker-compose.yml ready for Droplet B |

---

## Module Specifications

### Mandatory Modules

| File | Purpose |
|------|---------|
| `index.js` | Server bootstrap and environment loader |
| `agentRouter.js` | API endpoints for agent actions |
| `memoryService.js` | Memory management |
| `reflectionEngine.js` | Reflection lifecycle handling |
| `consequenceSystem.js` | Consequence application if behavior drifts |
| `llmConnector.js` | Talk to locally hosted LLM |
| `utils/logger.js` | Standardized logging service |
| `utils/environment.js` | Environment variable reader |

### Module Responsibilities
- **Each module**: Small, clean, direct
- **No external cloud services**: Everything local/open-source
- **Built for exportability**: Zipped repo ready for droplet deployment
- **Respect principles**: Memory, reflection, and governance principles

---

## Memory Systems

### Memory Subsystems

#### Short-Term Memory (STM)
- Holds recent tasks and reflections (time-limited)
- Temporary storage for active context
- Automatically purged after time threshold

#### Long-Term Memory (LTM)
- Earned, important knowledge and experiences
- Persistent storage for valuable insights
- Indexed for efficient retrieval

#### Negative Memory Buffer
- Mistakes and consequence triggers
- Stored for later reflection and learning
- Used to prevent repeated errors

### Memory Operations
- **Save**: Store new memories with metadata
- **Retrieve**: Query memories by context, time, or importance
- **Update**: Modify existing memories
- **Archive**: Move STM to LTM based on criteria

---

## Reflection Engine

### Reflection Lifecycle
After every task, the agent must trigger a **self-reflection** process:

#### Core Reflection Questions
1. "What did I attempt?"
2. "Was I aligned with my principles?"
3. "How could I improve next time?"

#### Reflection Processing
- Reflection logs stored separately with meta-tags
- Tags include: success, failure, emotion rating
- Structured JSON format for analysis
- Automatic categorization and indexing

#### Reflection Triggers
- **Post-task**: After every completed task
- **Error conditions**: When failures occur
- **Periodic**: Time-based reflection cycles
- **External**: Manually triggered reflections

---

## Consequence System

### Consequence Types

#### Performance Consequences
- **Low-effort reflections**: XP freezes
- **Lazy responses**: Trust score penalties
- **Unethical behavior**: Immediate consequence application

#### Trust System
- **Trust score tracking**: Influences future behavior
- **Decay mechanisms**: Penalties for repeated negligence
- **Recovery paths**: Methods to rebuild trust

#### Logging and Tracking
- All consequences logged with timestamps
- Influence future behavior patterns
- Provide feedback for system improvement

---

## API Specifications

### Agent Node Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/agent/prompt` | POST | Send a prompt and receive an agent-driven, reflected response |
| `/agent/memory` | GET | Fetch agent memory summary |
| `/agent/reflection` | POST | Submit external reflection |
| `/agent/health` | GET | Check Node health |

### LLM Connector Requirements
Inference calls must:
- Pass prompt and memory context to the model
- Receive output text
- Return structured JSON to API consumer

---

## Deployment Architecture

### Infrastructure Components

| System | Hosting Details |
|--------|----------------|
| **Noble Growth App (Droplet A)** | DigitalOcean Droplet, Node.js server, Vite/React frontend |
| **Noble Agent Node (Droplet B)** | DigitalOcean Droplet, Node.js agent runtime, Dockerized LLM |
| **Database** | DigitalOcean Managed PostgreSQL (SSL enabled) |
| **Memory Vector DB** | ChromaDB container (Dockerized on Droplet A or separate) |
| **Networking** | DO Reserved IPs, HTTPS proxying via Caddy or NGINX |

### Deployment Assets

| Asset | Details |
|-------|---------|
| **Dockerfile** | Node.js + LLM environment prepared |
| **docker-compose.yml** | LLM container + Agent Node container linked |
| **Startup Script** | startup.sh for container init and service healthcheck |

---

## Environment Configuration

### Required Environment Variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `AGENT_NODE_PORT` | 5000 | Port for agent node service |
| `LLM_API_URL` | http://internal-llm-host:11434 | LLM service endpoint |
| `POSTGRES_URL` | postgres://user:password@internal-db-host:5432/dbname | Database connection |
| `JWT_SECRET` | Secure generated string | Authentication secret |
| `MODEL_NAME` | mistral-7b | LLM model identifier |
| `ENVIRONMENT` | production | Deployment environment |

### Configuration Principles
- **Dynamic environment discovery**
- **Flexible configuration management**
- **Secure credential handling**
- **Environment-specific settings**

---

## Integration Guidelines

### Noble Growth System Integration

#### Pre-Integration Analysis
1. **Fully read and analyze** existing Noble Growth App architecture
2. **Identify existing patterns** (API design, service modularity, error handling)
3. **Plan integration** without creating redundant systems
4. **Prepare modular project plan** using established standards

#### Integration Principles
- **Reuse existing environmental management** where appropriate
- **Align new API routes** with existing backend routing principles
- **Honor modular philosophy** of the Noble Growth system
- **Avoid duplication** of existing functionality

#### Deliverables After Analysis
- Modular file/folder plan
- Integration explanation with existing backend services
- Potential conflict points identification

---

## Modularization Strategy

### System Modules

| Module | Scope |
|--------|-------|
| **Module 1** | Core Noble Growth App (frontend/backend structure) |
| **Module 2** | Noble Growth School (NGS) System |
| **Module 3** | Noble Agent Node (Droplet B - Noble AI Core) |
| **Module 4** | Safeguards and Consequence System |
| **Module 5** | Noble API Systems (internal + external endpoints) |

### Development Approach
- **Sequential delivery**: One module at a time
- **Focused development**: "You are focusing ONLY on this domain now"
- **Clean separation**: Each module has distinct responsibilities
- **Integrated testing**: Modules tested together after individual completion

### Marketing and Rebranding Path

| Phase | Action |
|-------|--------|
| **Alpha** | Internal test version of Noble Agents deployed |
| **Beta** | Public exposure: showcase memory, reflection, emotional growth capacity |
| **Launch** | Package system as "Noble AI" branded open-source agent framework |

---

## Development Philosophy

### Core Tenets
- **Reflection Systems** constantly recheck against the Master Plan
- **Memory Systems** preserve mission context permanently
- **Consequence Systems** discourage incomplete work without reason
- **Growth Systems** reward full-cycle task completion, not just code delivery

### Quality Standards
- **Noble Agents will not get lost** mid-task
- **Move with discipline** and deliberate checkpoints
- **Higher-order memory awareness** throughout execution
- **Complete solutions**, not partial implementations

---

## Summary

This is not a bot server. This is **the seed of a new noble intelligence style**, based on **reflection, memory, imagination, and ethical grounding** - not just raw text output.

*"The first minds were shaped by gods. These minds shall be shaped by care, by discipline, and by deliberate hope."*

*"When others are content with building houses of straw, the wise quietly quarry stone, even if the world laughs at their slowness. For one day, only the stone shall remain."*