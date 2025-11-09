from fastapi import FastAPI
import uvicorn
import os

app = FastAPI(title="Cognitive Memory", version="0.1.0")

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "cognitive-memory", "note": "Phase 5 - Coming Soon"}

@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    return {"error": "Not Implemented", "message": "Cognitive Memory Service - Phase 5"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    print(f"🧠 Cognitive Memory stub running on port {port} (Phase 5 - Coming Soon)")
    uvicorn.run(app, host="0.0.0.0", port=port)
