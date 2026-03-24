# Mini CRM — Task Manager

Мини-CRM с real-time обновлением задач. Fullstack проект на Next.js + NestJS + PostgreSQL + WebSocket.

## Стек технологий

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend:** NestJS 11, TypeScript, Prisma ORM, Passport JWT
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **WebSocket:** Socket.IO
- **Auth:** JWT + bcrypt
- **Validation:** class-validator + class-transformer
- **Infrastructure:** Docker Compose

## Структура проекта

```
circle-limited/
├── docker-compose.yml          # PostgreSQL + Redis
├── .env.example                # Шаблон переменных окружения
├── README.md
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Схема БД (User, Task)
│   ├── src/
│   │   ├── main.ts             # Entry point (CORS, ValidationPipe)
│   │   ├── app.module.ts       # Root module
│   │   ├── prisma/             # PrismaService (global)
│   │   ├── auth/               # Register, Login, JWT Guard
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── dto/
│   │   └── tasks/              # CRUD + WebSocket Gateway
│   │       ├── tasks.module.ts
│   │       ├── tasks.service.ts
│   │       ├── tasks.controller.ts
│   │       ├── tasks.gateway.ts
│   │       ├── tasks.service.spec.ts
│   │       └── dto/
│   └── .env
└── frontend/
    └── src/
        ├── lib/
        │   ├── api.ts              # HTTP API клиент
        │   ├── auth-context.tsx     # AuthProvider + useAuth
        │   └── use-socket.ts       # WebSocket hook
        └── app/
            ├── layout.tsx          # Root layout + AuthProvider
            ├── page.tsx            # Redirect → /tasks или /login
            ├── login/page.tsx      # Страница входа
            ├── register/page.tsx   # Страница регистрации
            └── tasks/page.tsx      # Kanban-доска задач
```

## Быстрый старт

### 1. Запуск PostgreSQL и Redis

```bash
docker-compose up -d
```

### 2. Настройка переменных окружения

```bash
cp .env.example backend/.env
```

Или проверь, что `backend/.env` содержит:

```
DATABASE_URL=postgresql://crm_user:crm_password@localhost:5434/crm_db
JWT_SECRET=dev-secret-key-change-in-production
REDIS_HOST=localhost
REDIS_PORT=6381
PORT=4000
```

### 3. Установка зависимостей

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Применение миграций Prisma

```bash
cd backend
npx prisma migrate dev --name init
```

### 5. Запуск backend (порт 4000)

```bash
cd backend
npm run start:dev
```

### 6. Запуск frontend (порт 3000)

```bash
cd frontend
npm run dev
```

### 7. Открыть приложение

Перейди на http://localhost:3000

## API Endpoints

### Auth

| Method | Endpoint       | Описание                     | Auth |
| ------ | -------------- | ---------------------------- | ---- |
| POST   | /auth/register | Регистрация (email+password) | Нет  |
| POST   | /auth/login    | Логин → JWT access token     | Нет  |

### Tasks (требуют JWT)

| Method | Endpoint   | Описание                  |
| ------ | ---------- | ------------------------- |
| GET    | /tasks     | Список задач пользователя |
| POST   | /tasks     | Создать задачу            |
| PATCH  | /tasks/:id | Обновить задачу / статус  |
| DELETE | /tasks/:id | Удалить задачу            |

### WebSocket Events

| Event        | Описание                         |
| ------------ | -------------------------------- |
| task:created | Задача создана                   |
| task:updated | Задача обновлена (статус/данные) |
| task:deleted | Задача удалена                   |

Формат события:

```json
{
  "id": 1,
  "status": "IN_PROGRESS",
  "timestamp": "2026-03-23T12:00:00.000Z"
}
```

## Проверка WebSocket (real-time)

1. Запусти backend и frontend
2. Открой http://localhost:3000 в **двух** вкладках/браузерах
3. Зарегистрируй аккаунт и залогинься в обоих
4. В первой вкладке создай задачу или смени статус
5. Во второй вкладке изменение отобразится **мгновенно** без перезагрузки

## Тесты

```bash
cd backend
npm test
```

## Prisma команды

```bash
cd backend

# Создать/применить миграции
npx prisma migrate dev --name <name>

# Сбросить БД и применить все миграции заново
npx prisma migrate reset

# Открыть Prisma Studio (GUI для БД)
npx prisma studio

# Сгенерировать клиент после изменений схемы
npx prisma generate
```

## Чек-лист функционала

- [x] Регистрация пользователя
- [x] Логин с JWT токеном
- [x] Защита роутов через JwtAuthGuard
- [x] CRUD задач (create, read, update, delete)
- [x] Привязка задач к пользователю (ownership)
- [x] Валидация входных данных (class-validator)
- [x] Kanban-доска с 3 колонками (TODO, IN_PROGRESS, DONE)
- [x] WebSocket real-time обновления
- [x] Два клиента видят изменения одновременно
- [x] Prisma schema + миграции
- [x] Docker Compose (PostgreSQL + Redis)
- [x] Unit-тесты (TasksService)
- [x] Production-like код без `any`
