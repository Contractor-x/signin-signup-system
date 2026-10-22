class ApiError(Exception):
    """Raised by services; rendered as {"error": {...}, "detail": msg} by main.py."""

    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message
