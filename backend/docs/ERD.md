# ERD - Database FlexAdmin (PostgreSQL)

```mermaid
erDiagram
    users ||--o{ user_menu_permissions : has
    menus ||--o{ user_menu_permissions : "is granted by"
    menus ||--o{ menus : "parent_id"
    users ||--o{ refresh_tokens : owns
    users ||--o{ audit_logs : "acts in"

    users {
        int id PK
        string username UK
        string full_name
        string email
        string password_hash "argon2id"
        bool is_active
        bool is_superadmin
        bool must_change_password
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }
    menus {
        int id PK
        string code UK "permission key, never change"
        string name
        string group_name
        string icon
        string path
        int parent_id FK
        int sort_order
        bool is_active
    }
    user_menu_permissions {
        int id PK
        int user_id FK
        int menu_id FK
        enum access_level "read | write"
    }
    refresh_tokens {
        int id PK
        int user_id FK
        string token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
    }
    audit_logs {
        int id PK
        int actor_user_id FK
        string action
        string target
        jsonb detail
        timestamptz created_at
    }
```

Rules:
- `user_menu_permissions` is unique on (`user_id`, `menu_id`). No row means no access. `write` includes `read`.
- `menus.group_name` is the sidebar group label (not in the original design, added so the sidebar can group menus).
- Every schema change goes through an Alembic migration in `backend/migrations/versions/`.
