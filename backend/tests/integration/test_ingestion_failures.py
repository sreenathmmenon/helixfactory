from git.exc import GitCommandError

from helixfactory.ingestion.service import _ingestion_failure_message


def test_clone_dns_failure_is_human_readable():
    error = GitCommandError("git clone", 128, "fatal: unable to access: Could not resolve host: github.com")
    assert _ingestion_failure_message(error) == "HelixFactory could not reach GitHub. Check network/DNS access and retry ingestion."
