def pytest_addoption(parser):
    parser.addoption(
        "--mock-orchestrator",
        action="store_true",
        default=False,
        help="Use a mocked orchestrator (no API keys needed, for CI)",
    )
