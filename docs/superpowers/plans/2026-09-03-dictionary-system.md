# 字典系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded enums (role, review_status, gender) in the frontend with a dynamic dictionary API, so backend changes automatically reflect in the UI.

**Architecture:** A `dictionaries` table stores key-value pairs with type/category. A single API endpoint `/api/dict/:type` returns items by type. Frontend caches dictionary data in a React context, and all components consume it instead of hardcoding.

**Tech Stack:** Express + sql.js (backend), React Context (frontend caching)

---

## Dictionary Types

| type | Key | Label | Extra |
|------|-----|-------|-------|
| role | admin | 超级管理员 | color=red, level=4 |
| role | module_admin | 模块管理员 | color=orange, level=3 |
| role | creator | 摄影创作者 | color=blue, level=2 |
| role | viewer | 访客 | color=default, level=1 |
| review_status | 0 | 待审核 | color=orange |
| review_status | 1 | 已通过 | color=green |
| review_status | 2 | 已拒绝 | color=red |
| gender | male | 男 | |
| gender | female | 女 | |
| gender | secret | 保密 | |

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `server/db.cjs` | Modify | Add `dictionaries` table + seed data |
| `server/routes/dict.cjs` | Create | `GET /api/dict/:type` and `GET /api/dict` endpoints |
| `server/index.cjs` | Modify | Mount dict router |
| `src/api/dict.js` | Create | Frontend API functions |
| `src/contexts/DictContext.jsx` | Create | Cache dictionaries in React context |
| `src/main.jsx` | Modify | Wrap with DictProvider |
| `src/components/UserManage.jsx` | Modify | Replace hardcoded role/gender enums |
| `src/components/Profile.jsx` | Modify | Replace hardcoded role/gender enums |
| `src/components/Register.jsx` | Modify | Replace hardcoded role/gender enums |
| `src/components/Admin.jsx` | Modify | Replace hardcoded review_status enums |
| `src/components/ReviewManage.jsx` | Modify | Replace hardcoded review_status enums |
| `src/components/RoleManage.jsx` | Modify | Replace hardcoded level enums |

---

### Task 1: Backend — dictionaries table + seed data

**Files:**
- Modify: `server/db.cjs`

- [ ] **Step 1: Add dictionaries table to db.cjs initDb()**

Add after the role_permissions table creation (around line 180):

```js
// Create dictionaries table
db.run(`
  CREATE TABLE IF NOT EXISTS dictionaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT,
    level INTEGER,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, value)
  )
`);

// Seed dictionary data
const dicts = [
  // Roles
  ['role', 'admin', '超级管理员', 'red', 4, 1],
  ['role', 'module_admin', '模块管理员', 'orange', 3, 2],
  ['role', 'creator', '摄影创作者', 'blue', 2, 3],
  ['role', 'viewer', '访客', 'default', 1, 4],
  // Review statuses
  ['review_status', '0', '待审核', 'orange', null, 1],
  ['review_status', '1', '已通过', 'green', null, 2],
  ['review_status', '2', '已拒绝', 'red', null, 3],
  // Genders
  ['gender', 'male', '男', null, null, 1],
  ['gender', 'female', '女', null, null, 2],
  ['gender', 'secret', '保密', null, null, 3],
];
for (const [type, value, label, color, level, sort_order] of dicts) {
  db.run(`INSERT OR IGNORE INTO dictionaries (type, value, label, color, level, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    [type, value, label, color, level, sort_order]);
}
```

- [ ] **Step 2: Verify locally**

Start backend, query `GET /api/dict` — should return all dictionary items.

---

### Task 2: Backend — dict API routes

**Files:**
- Create: `server/routes/dict.cjs`
- Modify: `server/index.cjs:50` (mount)

- [ ] **Step 1: Create server/routes/dict.cjs**

```js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');

// GET /api/dict — all dictionary types
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(`SELECT type, value, label, color, level, sort_order FROM dictionaries WHERE status = 1 ORDER BY type, sort_order ASC`);
    const rows = result[0] ? result[0].values : [];
    const grouped = {};
    for (const [type, value, label, color, level, sort_order] of rows) {
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({ value, label, color, level, sort_order });
    }
    res.json({ code: 200, message: 'success', data: grouped });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// GET /api/dict/:type — single type
router.get('/:type', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT value, label, color, level, sort_order FROM dictionaries WHERE type = ? AND status = 1 ORDER BY sort_order ASC`,
      [req.params.type]
    );
    const rows = result[0] ? result[0].values : [];
    const data = rows.map(([value, label, color, level, sort_order]) => ({ value, label, color, level, sort_order }));
    res.json({ code: 200, message: 'success', data });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount in server/index.cjs**

Add after line 50 (`app.use('/api/menus', menusRouter);`):

```js
const dictRouter = require('./routes/dict.cjs');
app.use('/api/dict', dictRouter);
```

- [ ] **Step 3: Test locally**

```bash
curl http://localhost:3001/api/dict/role
curl http://localhost:3001/api/dict
```

---

### Task 3: Frontend — API + Context

**Files:**
- Create: `src/api/dict.js`
- Create: `src/contexts/DictContext.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Create src/api/dict.js**

```js
const API_BASE = '/api';
const ACCESS_TOKEN_KEY = 'accessToken';

async function request(url) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  return await res.json();
}

export function fetchAllDicts() {
  return request(`${API_BASE}/dict`);
}

export function fetchDict(type) {
  return request(`${API_BASE}/dict/${type}`);
}
```

- [ ] **Step 2: Create src/contexts/DictContext.jsx**

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchAllDicts } from '../api/dict';

const DictContext = createContext(null);

export function DictProvider({ children }) {
  const [dicts, setDicts] = useState({});
  const [loading, setLoading] = useState(true);

  const loadDicts = useCallback(async () => {
    try {
      const res = await fetchAllDicts();
      if (res.code === 200 && res.data) {
        setDicts(res.data);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDicts();
  }, [loadDicts]);

  const getDict = useCallback((type) => dicts[type] || [], [dicts]);

  const getLabel = useCallback((type, value) => {
    const items = dicts[type] || [];
    const item = items.find(i => i.value === String(value));
    return item?.label || String(value);
  }, [dicts]);

  const getColor = useCallback((type, value) => {
    const items = dicts[type] || [];
    const item = items.find(i => i.value === String(value));
    return item?.color || 'default';
  }, [dicts]);

  const getLevel = useCallback((type, value) => {
    const items = dicts[type] || [];
    const item = items.find(i => i.value === String(value));
    return item?.level || 0;
  }, [dicts]);

  return (
    <DictContext.Provider value={{ dicts, loading, getDict, getLabel, getColor, getLevel, reload: loadDicts }}>
      {children}
    </DictContext.Provider>
  );
}

export function useDict() {
  const ctx = useContext(DictContext);
  if (!ctx) throw new Error('useDict must be used within DictProvider');
  return ctx;
}
```

- [ ] **Step 3: Wrap app with DictProvider in src/main.jsx**

Add import and wrap existing providers:

```jsx
import { DictProvider } from './contexts/DictContext';
```

Wrap inside the existing providers (inside AuthProvider, inside ThemeProvider):

```jsx
<DictProvider>
  {/* existing content */}
</DictProvider>
```

---

### Task 4: Replace hardcoded enums in UserManage.jsx

**Files:**
- Modify: `src/components/UserManage.jsx`

- [ ] **Step 1: Import useDict, remove hardcoded constants**

Remove lines 8 (`GENDER_LABELS`), 122-134 (`roleColors`, `roleLabels`).

Add at top:
```jsx
import { useDict } from '../contexts/DictContext';
```

Inside component, add:
```jsx
const { getDict, getLabel, getColor } = useDict();
const roles = getDict('role');
const genders = getDict('gender');
```

- [ ] **Step 2: Replace role Tag render**

Replace line 178-181:
```jsx
render: (role) => (
  <Tag color={getColor('role', role)}>{getLabel('role', role)}</Tag>
),
```

- [ ] **Step 3: Replace gender render**

Replace line 158:
```jsx
render: (g) => g ? getLabel('gender', g) : '-',
```

- [ ] **Step 4: Replace Select options for role**

Replace lines 313-318:
```jsx
<Select>
  {roles.map(r => (
    <Select.Option key={r.value} value={r.value}>{r.label}</Select.Option>
  ))}
</Select>
```

- [ ] **Step 5: Replace Select options for gender**

Replace lines 303-307:
```jsx
<Select allowClear placeholder="选择性别">
  {genders.map(g => (
    <Select.Option key={g.value} value={g.value}>{g.label}</Select.Option>
  ))}
</Select>
```

---

### Task 5: Replace hardcoded enums in Profile.jsx

**Files:**
- Modify: `src/components/Profile.jsx`

- [ ] **Step 1: Import useDict, remove hardcoded constants**

Remove line 11 (`GENDER_LABELS`) and line 120 (`roleLabels`).

Add:
```jsx
import { useDict } from '../contexts/DictContext';
const { getLabel } = useDict();
```

- [ ] **Step 2: Replace role label display**

Replace line 227:
```jsx
<Text type="secondary">{getLabel('role', user?.role)}</Text>
```

- [ ] **Step 3: Replace gender label**

Replace line 229:
```jsx
· {getLabel('gender', user.gender)}
```

- [ ] **Step 4: Replace gender Radio.Group**

Replace lines 138-142:
```jsx
<Form.Item name="gender" label="性别">
  <Radio.Group>
    {getDict('gender').map(g => (
      <Radio.Button key={g.value} value={g.value}>{g.label}</Radio.Button>
    ))}
  </Radio.Group>
</Form.Item>
```

(Need to also import `getDict` from useDict)

---

### Task 6: Replace hardcoded enums in Register.jsx

**Files:**
- Modify: `src/components/Register.jsx`

- [ ] **Step 1: Import useDict**

```jsx
import { useDict } from '../contexts/DictContext';
```

Inside component:
```jsx
const { getDict } = useDict();
```

- [ ] **Step 2: Replace gender Radio.Group**

Replace lines 58-62:
```jsx
<Form.Item name="gender" label="性别">
  <Radio.Group>
    {getDict('gender').map(g => (
      <Radio.Button key={g.value} value={g.value}>{g.label}</Radio.Button>
    ))}
  </Radio.Group>
</Form.Item>
```

- [ ] **Step 3: Replace role Radio.Group**

Replace lines 64-68:
```jsx
<Form.Item name="role" label="身份" initialValue="creator">
  <Radio.Group>
    {getDict('role').filter(r => ['creator', 'viewer'].includes(r.value)).map(r => (
      <Radio.Button key={r.value} value={r.value}>{r.label}</Radio.Button>
    ))}
  </Radio.Group>
</Form.Item>
```

---

### Task 7: Replace hardcoded enums in Admin.jsx + ReviewManage.jsx

**Files:**
- Modify: `src/components/Admin.jsx`
- Modify: `src/components/ReviewManage.jsx`

- [ ] **Step 1: Admin.jsx — import useDict, remove statusMap**

Remove lines 279-283 (`statusMap` inside render).

Add:
```jsx
import { useDict } from '../contexts/DictContext';
const { getLabel, getColor } = useDict();
```

Replace lines 280-285:
```jsx
render: (_, record) => {
  const color = getColor('review_status', record.review_status);
  const label = getLabel('review_status', record.review_status);
  return <span style={{ color: color === 'default' ? undefined : `var(--${color === 'orange' ? 'accent' : color === 'green' ? 'success' : 'error'}, ${color})`, fontWeight: 500 }}>{label}</span>;
},
```

Actually simpler — just use the color string directly since antd Tag colors work:
```jsx
render: (_, record) => {
  const colorMap = { orange: 'orange', green: 'green', red: 'red' };
  const color = getColor('review_status', record.review_status);
  return <span style={{ color: colorMap[color] || undefined, fontWeight: 500 }}>{getLabel('review_status', record.review_status)}</span>;
},
```

- [ ] **Step 2: ReviewManage.jsx — import useDict, remove STATUS_MAP**

Remove lines 8-12 (`STATUS_MAP`).

Add:
```jsx
import { useDict } from '../contexts/DictContext';
const { getDict, getLabel, getColor } = useDict();
```

Replace STATUS_MAP usage in columns render:
```jsx
const reviewStatuses = getDict('review_status');
```

Replace filter options (line 160-164):
```jsx
options={reviewStatuses.map(s => ({ value: parseInt(s.value), label: s.label }))}
```

Replace magic numbers with named values from the dict.

---

### Task 8: Replace hardcoded enums in RoleManage.jsx

**Files:**
- Modify: `src/components/RoleManage.jsx`

- [ ] **Step 1: Import useDict, remove hardcoded level mappings**

Remove lines 128-129 (`levelColors`, `levelLabels`).

Add:
```jsx
import { useDict } from '../contexts/DictContext';
const { getColor, getLabel } = useDict();
```

Replace line 155:
```jsx
render: (level) => <Tag color={getColor('role', /* need to find role by level */)}>
  {/* level label */}
</Tag>,
```

Actually RoleManage shows role level, not role key. Need to find role by level. Add helper:
```jsx
const getRoleByLevel = (level) => {
  const roles = getDict('role');
  return roles.find(r => r.level === level);
};
```

Then render:
```jsx
render: (level) => {
  const role = getRoleByLevel(level);
  return <Tag color={role?.color || 'default'}>{role?.label || level}</Tag>;
},
```

---

### Task 9: Build, deploy, migrate DB

- [ ] **Step 1: Build frontend**

```bash
cd "D:\01_mine\玩\life-gallery" && npm run build
```

- [ ] **Step 2: Deploy to server**

Upload: `dist/*`, `server/db.cjs`, `server/routes/dict.cjs`, `server/index.cjs`

- [ ] **Step 3: Run DB migration on server**

Create and run migration script to add dictionaries table + seed data to existing DB.

- [ ] **Step 4: Restart PM2**

```bash
ssh root@47.116.197.41 "pm2 restart life-gallery"
```

---

### Task 10: Verify

- [ ] **Step 1: Test all pages**

- UserManage: role tags show correct colors/labels, gender column shows Chinese
- Profile: role label shows Chinese, gender radio buttons from API
- Register: gender + role options from API
- Admin: review status shows correct colors/labels
- ReviewManage: filter dropdown from API, status tags correct
- RoleManage: level tags correct

- [ ] **Step 2: Test dictionary update**

Add a new dict entry via direct DB insert, refresh frontend — should appear without code change.
