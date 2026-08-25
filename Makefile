.PHONY: test validate infra-up infra-down

test:
	npm run test

validate:
	npm run validate

infra-up:
	docker compose up -d

infra-down:
	docker compose down
