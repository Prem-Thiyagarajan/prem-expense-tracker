# File: app/main.py

import logging
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.api_router import api_router
from dotenv import load_dotenv

# Load a standard .env file for consistency. Render will use its own environment variables.
load_dotenv(".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Personal Finance Tracker API")

# ✅ --- THIS IS THE CRITICAL FIX ---
# This list defines which frontend URLs are allowed to make requests to your API.
# The "*" wildcard has been removed for security.
origins = [
    # This is the URL you will get AFTER you deploy your frontend to Vercel.
    # You MUST replace this placeholder with your real Vercel URL.
    "https://prem-expense-tracker.vercel.app", 

    # You can also add your local development URL for testing if needed.
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Use the specific list of allowed origins
    allow_credentials=True,
    allow_methods=["*"],    # Allows all standard methods (GET, POST, etc.)
    allow_headers=["*"],    # Allows all standard headers
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log the real error; return a generic message so internals never leak."""
    request_id = str(uuid.uuid4())
    logger.exception("Unhandled error [%s] on %s %s", request_id, request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred.", "request_id": request_id},
    )

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Welcome to the Personal Finance Tracker API"}