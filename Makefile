.PHONY: up down build logs restart clean db-reset simulator agent dashboards

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

restart:
	docker compose restart

clean:
	docker compose down -v --remove-orphans

# Individual services
simulator:
	docker compose up -d postgres redis simulator

agent:
	docker compose up -d postgres redis simulator agent

dashboards:
	docker compose up -d dashboard-network dashboard-agent dashboard-chaos

# Development - run backends locally
dev-simulator:
	cd simulator && python -m uvicorn netsim.app:create_app --factory --host 0.0.0.0 --port 8000 --reload

dev-agent:
	cd agent && python -m uvicorn nocagent.app:create_app --factory --host 0.0.0.0 --port 8001 --reload

dev-dashboard-network:
	cd dashboard-network && npm run dev

dev-dashboard-agent:
	cd dashboard-agent && npm run dev -- --port 5174

dev-dashboard-chaos:
	cd dashboard-chaos && npm run dev -- --port 5175

# Database
db-reset:
	docker compose down -v postgres
	docker compose up -d postgres
	@echo "Waiting for postgres..."
	@sleep 5
	@echo "Run migrations with: cd simulator && alembic upgrade head"
