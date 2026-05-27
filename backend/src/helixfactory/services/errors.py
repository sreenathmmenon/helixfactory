class HelixFactoryError(Exception):
    """Base domain exception with API-safe metadata."""

    code = "domain_error"
    status_code = 400

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.details = details or {}


class PartialFailureError(HelixFactoryError):
    code = "partial_failure"
    status_code = 207


class BlockedOperationError(HelixFactoryError):
    code = "blocked_operation"
    status_code = 409


class UnsupportedLanguageError(HelixFactoryError):
    code = "unsupported_language"
    status_code = 422


class InsufficientEvidenceError(HelixFactoryError):
    code = "insufficient_evidence"
    status_code = 422


class AuditFailureError(HelixFactoryError):
    code = "audit_failure"
    status_code = 500


class NotFoundError(HelixFactoryError):
    code = "not_found"
    status_code = 404


class ParserDependencyError(HelixFactoryError):
    code = "parser_dependency_missing"
    status_code = 503
