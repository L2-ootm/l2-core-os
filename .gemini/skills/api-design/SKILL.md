---
name: api-design
description: "Use this skill when designing REST APIs - creating endpoints, defining request/response schemas, choosing HTTP methods, implementing authentication, or planning API versioning."
---

# API Design Patterns

## When to use this skill
- When the user wants to create new API endpoints
- When designing a new feature that needs backend API
- When planning authentication/authorization
- When structuring request/response schemas

## RESTful Conventions

### URL Structure
- Use plural nouns: `/users`, `/orders`
- Use kebab-case for multi-word: `/order-items`
- Nest related resources: `/users/{id}/orders`
- Use query params for filtering: `/users?status=active`

### HTTP Methods
- **GET**: Retrieve resources (idempotent)
- **POST**: Create new resources
- **PUT**: Replace entire resource (idempotent)
- **PATCH**: Partial update (idempotent)
- **DELETE**: Remove resources (idempotent)

### Response Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Server Error |

## Authentication Patterns

### JWT Implementation
- Short-lived access tokens (15-60 min)
- Refresh tokens for session extension
- Include in Authorization header: `Bearer <token>`

### Role-Based Access Control (RBAC)
- Define roles: owner, operator, viewer
- Check roles in middleware/dependencies
- Apply to endpoints: `Depends(require_roles({"owner"}))`

## Request/Response Patterns

### Standard Response Format
```json
{
  "ok": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1 }
}
```

### Error Response Format
```json
{
  "ok": false,
  "error": "error_code",
  "message": "Human readable message"
}
```

## Pagination
- Use cursor or offset-based pagination
- Include metadata: total, page, limit, has_more

## Versioning
- URL path: `/api/v1/users`
- Header: `Accept: application/vnd.api.v1+json`

## Best Practices
1. Use nouns, not verbs in URLs
2. Return appropriate status codes
3. Validate input with schemas (Pydantic)
4. Log all operations for audit
5. Implement rate limiting
6. Use idempotency keys for POST/PUT
7. Document with OpenAPI/Swagger
