from dataclasses import dataclass

@dataclass
class LoginRequest:
    username: str
    password: str

@dataclass
class TokenResponse:
    token: str
    success: bool
