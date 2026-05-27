import pytest

from helixfactory.api.schemas.models import SkillRefinement


def test_skill_refinement_rejects_generic_and_requires_human_review():
    with pytest.raises(ValueError):
        SkillRefinement(id="s1", agentExecutionId="e1", patternSummary="Always write tests best practice", evidenceRefs=["e1"], proposalText="generic")
    with pytest.raises(ValueError):
        SkillRefinement(id="s2", agentExecutionId="e1", patternSummary="In this repo preserve graph IDs", evidenceRefs=["e1"], proposalText="specific", status="approved")
    approved = SkillRefinement(id="s3", agentExecutionId="e1", patternSummary="In this repo preserve graph IDs", evidenceRefs=["e1"], proposalText="specific", status="approved", reviewer="dev")
    assert approved.status == "approved"
