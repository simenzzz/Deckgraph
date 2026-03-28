from fastapi import FastAPI, HTTPException
from auth.models import LoginRequest, TokenResponse
import jwt
import bcrypt

app = FastAPI(title="Auth Service")

SECRET_KEY = "dev-secret-key"

@app.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest) -> TokenResponse:
    # Simplified auth logic for testing
    hashed = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt())
    token = jwt.encode(
        {"sub": request.username},
        SECRET_KEY,
        algorithm="HS256",
    )
    return TokenResponse(token=token, success=True)

@app.get("/health")
async def health():
    return {"status": "ok"}
