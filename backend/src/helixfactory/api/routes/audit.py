from fastapi import APIRouter

from helixfactory.api.schemas.requests import EvidencePackage, EvidencePackageRequest
from helixfactory.audit.evidence_package import EvidencePackageBuilder

router = APIRouter()
builder = EvidencePackageBuilder()


@router.post("/audit/evidence-package", response_model=EvidencePackage)
def evidence_package(request: EvidencePackageRequest) -> EvidencePackage:
    return builder.build(request)
