# High Level Architecture

The server is a basic Socket.io server

## Entity Diagram

```mermaid
erDiagram
  server ||--|| lobby_manager : has
  lobby_manager ||--o{ lobby : has
  lobby ||--|| room : has
  lobby ||--o| game : has

  server ||--|| pool : has
  pool ||--|| lobby_manager: uses
```