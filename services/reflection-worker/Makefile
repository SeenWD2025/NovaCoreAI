.PHONY: lint format typecheck test

lint:
	ruff check .

format:
	ruff format .

typecheck:
	mypy app/

test:
	pytest

all: format lint typecheck test
