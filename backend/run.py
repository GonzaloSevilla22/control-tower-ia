"""Entry point — starts the FastAPI server on localhost:8765."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
        workers=1,
        log_level="info",
    )
