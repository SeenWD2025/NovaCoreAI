from fastapi import FastAPI
import uvicorn
import os

app = FastAPI(title="Intelligence Core", version="0.1.0")

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "intelligence-core", "note": "Phase 4 - Coming Soon"}

@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    return {"error": "Not Implemented", "message": "Intelligence Core Service - Phase 4"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"🧠 Intelligence Core stub running on port {port} (Phase 4 - Coming Soon)")
    uvicorn.run(app, host="0.0.0.0", port=port)
