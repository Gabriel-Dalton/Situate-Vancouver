import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health

_origins = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000',
)
_allow_origins = [o.strip() for o in _origins.split(',') if o.strip()]

app = FastAPI(title='AI Service', version='0.1.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(health.router, tags=['health'])


@app.get('/')
def root():
    return {'service': 'ai-service', 'docs': '/docs'}
