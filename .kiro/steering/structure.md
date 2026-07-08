# Structure Steering

## Directory layout
```
.
├── .kiro/
│   ├── steering/          # persistent project context (this folder)
│   └── specs/             # feature specs: requirements → design → tasks
├── src/
│   └── app/
│       ├── main.py        # FastAPI app entrypoint
│       ├── config.py      # settings loaded from env
│       ├── models.py      # shared Pydantic models
│       ├── routers/       # HTTP endpoints only
│       └── services/      # business logic
├── tests/                 # pytest suite
└── docs/                  # human-facing docs (incl. Kiro application guide)
```

## Naming
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions/vars: `snake_case`
- Specs: one folder per feature, kebab-case name (e.g. `document-extraction`).

## Import rules
- `routers` may import `services` and `models`.
- `services` may import `models` and `config`.
- `services` must NOT import `routers` (no circular deps).
