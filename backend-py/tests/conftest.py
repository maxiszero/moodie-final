import os

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.config import settings


def _uses_production_database() -> bool:
    uri = settings.mongodb_uri.lower()
    if os.getenv("CI") == "true":
        return False
    if ".mongodb.net" in uri:
        return True
    if os.getenv("MOODIE_ALLOW_PROD_TESTS") == "1":
        return False
    return False


@pytest.fixture(scope="session", autouse=True)
def _guard_integration_database() -> None:
    if _uses_production_database():
        pytest.exit(
            "Refusing to run tests against MongoDB Atlas / production. "
            "Use a local test DB (mongodb://127.0.0.1:27017/moodie_test) or set CI=true.",
            returncode=2,
        )


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(create_app()) as test_client:
        yield test_client
