# MongoDB Manager

Ứng dụng web full-stack để quản lý và truy xuất MongoDB nhanh chóng, mượt mà với giao diện trực quan.

## 🎯 Tính năng

### Backend (Node.js + Express)
- ✅ **Env Service** — Đọc/ghi cấu hình `.env` (MONGO_URI, MONGO_HOST, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB)
- ✅ **Connection Manager** — Quản lý nhiều MongoDB connection profiles, connect/disconnect, URI parser
- ✅ **Schema Explorer** — List databases, collections, document count
- ✅ **Document Service** — CRUD documents với pagination (10/20/50/100), filter JSON, sort theo field
- ✅ **Query Service** — Thực thi 8 operations: find, aggregate, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany (timeout 30s)
- ✅ **Error Handling** — Global error handler, 404 handler, descriptive error messages

### Frontend (React + TypeScript + Vite)
- ✅ **Zustand Store** — State management: connections, navigation, documents, UI (theme, loading, notifications)
- ✅ **API Client** — Axios với interceptor, base URL `/api`
- ✅ **App Shell** — Layout sidebar + main content, dark/light theme (localStorage)
- ✅ **Connection Panel** — Tạo/connect/disconnect/delete connection profiles
- ✅ **Notifications** — react-hot-toast (success auto-dismiss 3s, error persistent)
- 🚧 **Schema Explorer** — Tree view Database → Collection (chưa hoàn thiện UI)
- 🚧 **Document Viewer** — Table/card view, pagination, sort, filter (chưa hoàn thiện UI)
- 🚧 **Query Editor** — Monaco Editor với MongoDB syntax highlighting (chưa hoàn thiện UI)
- 🚧 **CRUD Forms** — Add/Edit/Delete documents với JSON validation (chưa hoàn thiện UI)

## 📁 Cấu trúc Project

```
mongo-db-manager/
├── start.bat                    # Windows quick-start script
├── .env.example                 # Mẫu cấu hình MongoDB
├── .env                         # Cấu hình thực (tạo từ .env.example)
├── package.json                 # Root: concurrently để chạy backend + frontend
├── src/
│   ├── server/                  # Backend (Node.js + Express)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── index.ts             # Entry point, mount routers
│   │   ├── env/                 # Env Service
│   │   │   ├── envService.ts    # readEnv, writeEnv
│   │   │   └── envRouter.ts     # GET/PUT /api/env
│   │   ├── connections/         # Connection Manager
│   │   │   ├── connectionManager.ts  # createProfile, connect, disconnect, parseUri
│   │   │   └── connectionRouter.ts   # 6 endpoints
│   │   ├── schema/              # Schema Explorer
│   │   │   ├── schemaService.ts       # listDatabases, listCollections, getCollectionStats
│   │   │   └── schemaRouter.ts        # 3 endpoints GET
│   │   ├── documents/           # Document Service
│   │   │   ├── documentService.ts     # listDocuments, insertDocument, updateDocument, deleteDocument
│   │   │   └── documentRouter.ts      # 4 endpoints (GET, POST, PUT, DELETE)
│   │   └── query/               # Query Service
│   │       ├── queryService.ts        # executeQuery (8 operations, timeout 30s)
│   │       └── queryRouter.ts         # POST /api/connections/:id/databases/:db/query
│   └── client/                  # Frontend (React + TypeScript + Vite)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts       # Proxy /api → http://localhost:3001
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx          # App Shell với sidebar + main content
│           ├── index.css        # Tailwind imports
│           ├── store/
│           │   └── appStore.ts  # Zustand store
│           ├── api/
│           │   ├── apiClient.ts       # Axios instance
│           │   ├── connectionsApi.ts
│           │   ├── schemaApi.ts
│           │   ├── documentsApi.ts
│           │   ├── queryApi.ts
│           │   └── envApi.ts
│           └── components/
│               └── connection/
│                   └── ConnectionPanel.tsx
└── .kiro/specs/mongo-db-manager/  # Spec files
    ├── requirements.md          # 8 requirements với acceptance criteria
    ├── design.md                # Architecture, components, data models, 19 correctness properties
    └── tasks.md                 # 19 tasks (tất cả đã completed)
```

## 🚀 Cách chạy

### 1. Quick Start (Windows)
```bash
# Double-click file start.bat
# Hoặc chạy từ terminal:
start.bat
```

Script `start.bat` sẽ:
1. Kiểm tra Node.js và npm đã cài chưa
2. Copy `.env.example` → `.env` nếu chưa có
3. Chạy `npm run install:all` (cài dependencies cho root, server, client)
4. Chạy `npm run dev` (concurrently backend + frontend)

### 2. Manual Start

```bash
# Cài dependencies
npm run install:all

# Chạy dev (backend + frontend cùng lúc)
npm run dev

# Hoặc chạy riêng:
# Backend
cd src/server
npm run dev

# Frontend (terminal khác)
cd src/client
npm run dev
```

### 3. Truy cập

- **Backend API**: http://localhost:3001
- **Frontend**: http://localhost:5173
- **Health check**: http://localhost:3001/api/health

## ⚙️ Cấu hình

### File `.env` (tạo từ `.env.example`)

```env
# MongoDB connection
MONGO_URI=mongodb://localhost:27017
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=admin
MONGO_PASSWORD=secret
MONGO_DB=mydb

# Server port
PORT=3001
```

**Lưu ý**: Bạn có thể dùng `MONGO_URI` (ưu tiên) hoặc các field riêng lẻ (HOST, PORT, USER, PASSWORD, DB).

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 18+ |
| Backend framework | Express 4 |
| MongoDB driver | `mongodb` (official) |
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite |
| State management | Zustand |
| HTTP client | Axios |
| Code editor | Monaco Editor (chưa tích hợp) |
| JSON viewer | react-json-view-lite (chưa tích hợp) |
| Styling | Tailwind CSS |
| Notifications | react-hot-toast |
| Process manager | concurrently (dev) |

## 📋 API Endpoints

### Env Service
- `GET /api/env` — Lấy cấu hình hiện tại (password masked)
- `PUT /api/env` — Cập nhật cấu hình

### Connection Manager
- `POST /api/connections` — Tạo connection profile
- `GET /api/connections` — List tất cả profiles
- `POST /api/connections/:id/connect` — Kết nối MongoDB
- `POST /api/connections/:id/disconnect` — Ngắt kết nối
- `GET /api/connections/:id/status` — Lấy trạng thái
- `DELETE /api/connections/:id` — Xóa profile

### Schema Explorer
- `GET /api/connections/:id/databases` — List databases
- `GET /api/connections/:id/databases/:db/collections` — List collections
- `GET /api/connections/:id/databases/:db/collections/:col/stats` — Document count

### Document Service
- `GET /api/connections/:id/databases/:db/collections/:col/documents` — List documents (query params: filter, sort, page, pageSize)
- `POST /api/connections/:id/databases/:db/collections/:col/documents` — Insert document
- `PUT /api/connections/:id/databases/:db/collections/:col/documents/:docId` — Update document
- `DELETE /api/connections/:id/databases/:db/collections/:col/documents/:docId` — Delete document

### Query Service
- `POST /api/connections/:id/databases/:db/query` — Execute custom query

**Query Request Body:**
```json
{
  "operation": "find|aggregate|insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany",
  "collection": "collectionName",
  "filter": {},
  "pipeline": [],
  "document": {},
  "documents": [],
  "update": {},
  "options": {}
}
```

## 🐛 Known Issues

### 1. TypeScript Config (server)
File `src/server/tsconfig.json` có thể báo lỗi "No inputs were found" do cache. 

**Fix**: Restart TypeScript server trong VS Code:
- `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

### 2. Frontend UI Components chưa hoàn thiện
Các components sau chỉ có skeleton/placeholder:
- Schema Explorer tree view
- Document Viewer table/card
- Query Editor với Monaco
- CRUD forms với JSON validation

**Next steps**: Implement UI components còn lại theo design trong `.kiro/specs/mongo-db-manager/design.md`

### 3. Tests chưa có
Property-based tests và integration tests chưa được implement (optional tasks trong `tasks.md`).

## 📝 Development Notes

### Thêm router mới
1. Tạo service file trong `src/server/<module>/<module>Service.ts`
2. Tạo router file trong `src/server/<module>/<module>Router.ts`
3. Mount router trong `src/server/index.ts`:
   ```typescript
   import myRouter from './<module>/<module>Router';
   app.use('/api/<path>', myRouter);
   ```

### Thêm API function (frontend)
1. Tạo file trong `src/client/src/api/<module>Api.ts`
2. Import `apiClient` và export async functions
3. Sử dụng trong components với try/catch + toast

### Thêm state vào Zustand
1. Mở `src/client/src/store/appStore.ts`
2. Thêm interface fields và setter functions
3. Sử dụng trong components: `const value = useAppStore((state) => state.value)`

## 🎨 UI Customization

### Theme
- Light/Dark theme toggle (chưa có UI button, nhưng logic đã sẵn)
- Theme lưu trong `localStorage`
- Apply class `dark` lên `document.documentElement`

### Tailwind
- Config: `src/client/tailwind.config.js`
- Dark mode: `class` strategy
- Responsive: breakpoints mặc định (sm, md, lg, xl, 2xl)

## 📚 Tài liệu tham khảo

- **Requirements**: `.kiro/specs/mongo-db-manager/requirements.md` — 8 requirements với acceptance criteria
- **Design**: `.kiro/specs/mongo-db-manager/design.md` — Architecture, components, 19 correctness properties
- **Tasks**: `.kiro/specs/mongo-db-manager/tasks.md` — 19 tasks implementation plan

## 🤝 Contributing

Để tiếp tục phát triển:

1. **Hoàn thiện UI components** (Tasks 12-16):
   - Schema Explorer tree view với expand/collapse
   - Document Viewer table với pagination controls
   - Query Editor với Monaco Editor
   - CRUD forms với JSON validation

2. **Thêm features**:
   - Export data (JSON, CSV)
   - Import data
   - Index management
   - Aggregation pipeline builder
   - Query history

3. **Testing**:
   - Property-based tests với fast-check
   - Integration tests với mongodb-memory-server
   - E2E tests với Playwright

4. **Performance**:
   - Virtual scrolling cho large datasets
   - Query result caching
   - Connection pooling optimization

## 📄 License

MIT

---

**Status**: MVP hoàn thành — Backend đầy đủ, Frontend có Connection Panel. UI components còn lại cần implement.
