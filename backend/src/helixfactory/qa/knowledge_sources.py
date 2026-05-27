from helixfactory.api.schemas.models import KnowledgeSource


def repository_source(repository_id: str) -> KnowledgeSource:
    return KnowledgeSource(
        id=f"source-{repository_id}",
        source_type="repository",
        external_ref=repository_id,
        title=f"Repository twin {repository_id}",
        provenance="graph",
    )
