# Simplified Database Query Binding - Implementation Guide

## Overview
The database query binding system has been simplified from a complex SQL-writing experience to a visual 3-step query builder. **No SQL knowledge required.**

---

## What Changed

### Before (Complex)
```
1. Write raw SQL in textarea:
   SELECT * FROM users WHERE id = {{componentState.input1.value}}
   
2. Manually configure binding expression:
   {{queries.myQuery.data}}
   
3. Result: Confusing, error-prone, SQL injection risk
```

### After (Simple)
```
1. Pick table: [users ▾]
2. Pick columns: ☑ id  ☑ name  ☑ email
3. Add filters: status = {{input1.value}}
4. Click Preview → see 3 sample rows
5. Save → Auto-binds to component
   Result: Zero SQL, zero manual binding steps
```

---

## How It Works

### Step 1: Create a PostgreSQL Resource
In the Resources tab, create a new PostgreSQL resource pointing to your database.

### Step 2: Edit a Component's DataTab
1. Open a component (StatCard, Table, BarChart, etc.)
2. Go to the **Data** tab
3. Under **Query bindings** → select your PostgreSQL resource
4. **INSTEAD OF SQL textarea, you now see:**

```
┌─────────────────────────────────────────┐
│  Visual Query Builder                   │
├─────────────────────────────────────────┤
│  [Select table ▾]                       │
│                                         │
│  Columns:                               │
│  ☑ id      ☑ name     ☑ email         │
│  ☑ status  ☐ created_at                │
│                                         │
│  Filters:                               │
│  [status ▾] [= ▾] [active]       [x]   │
│                                         │
│  + Add Filter                           │
│  [▶ Preview]                            │
│  (shows 3 sample rows)                  │
└─────────────────────────────────────────┘
```

### Step 3: Auto-Binding
When you save the query:
- **StatCard** → auto-binds to first numeric column
- **Table** → auto-binds to all selected columns
- **BarChart/LineChart** → auto-binds and suggests X/Y fields
- **Button** → auto-binds to trigger execution
- **Other components** → auto-binds to full data

**No BindingPicker step needed.** The component just works.

---

## New Endpoints (Backend)

### `GET /api/resources/:id/schema`
Returns database schema for a PostgreSQL resource.

**Response:**
```json
{
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "integer" },
        { "name": "name", "type": "character varying" },
        { "name": "email", "type": "character varying" }
      ]
    }
  ]
}
```

### `POST /api/resources/:id/preview`
Runs a query and returns first 5 rows for preview.

**Request:**
```json
{
  "sql": "SELECT id, name FROM users WHERE status = $1",
  "params": ["active"]
}
```

**Response:**
```json
{
  "rows": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ]
}
```

---

## New Component (Frontend)

### `DBQueryBuilder.tsx`
**Location:** `apps/frontend/src/components/editor/DBQueryBuilder.tsx`

**Key Features:**
- **Table picker** → dropdown of available tables from schema
- **Column selector** → checkboxes to include/exclude columns
- **Filter builder** → visual rows for WHERE clauses
- **Binding support** → filters can use `{{componentState.input1.value}}`
- **Parameterized SQL** → generates `$1, $2, ...` placeholders (SQL injection safe)
- **Live preview** → shows first 3 rows with one click

**Props:**
```ts
interface Props {
  resourceId: string;
  value: { path?: string; method?: string };
  onChange: (value: { path: string; method: string; params?: Record<string, unknown> }) => void;
}
```

---

## Workflow Examples

### Example 1: Display Active Users in Table
```
1. Create Table component
2. Open DataTab → Select PostgreSQL resource
3. Query Builder appears:
   - Select table: "users"
   - Select columns: ☑ id  ☑ name  ☑ email
   - Add filter: status = "active"
4. Click Preview → see sample rows
5. Save
6. Table component auto-populates with data ✅
```

### Example 2: Filter by User Input
```
1. Create TextInput component (id: searchInput)
2. Create StatCard component
3. Open StatCard DataTab:
   - Query Builder:
     - Table: "orders"
     - Columns: COUNT(*) (if supported) or total
     - Filter: user_id = {{componentState.searchInput.value}}
4. Click Preview → enter a value, see results
5. Save
6. Now whenever user types in TextInput, StatCard updates ✅
```

### Example 3: Chart with Multiple Filters
```
1. Create BarChart component
2. Open DataTab:
   - Table: "sales"
   - Columns: category, revenue
   - Filter 1: region = "North"
   - Filter 2: date > "2024-01-01"
3. Save
4. BarChart auto-sets xField=category, yField=revenue ✅
```

---

## Filter Operators

| Operator | Example | Use Case |
|----------|---------|----------|
| `=` | status = "active" | Exact match |
| `!=` | type != "internal" | Not equal |
| `>` | price > 100 | Greater than |
| `<` | date < "2024-12-31" | Less than |
| `LIKE` | name LIKE "%john%" | Pattern matching |
| `IS NULL` | description IS NULL | Null check |

**Special:** Any filter value can use bindings: `{{componentState.input1.value}}`

---

## Technical Details

### SQL Generation (Client-Side)
```ts
SELECT col1, col2 
FROM table_name
WHERE column1 = $1 AND column2 > $2
```

**Key points:**
- Values are parameterized (`$1, $2, ...`)
- Safe from SQL injection
- Backend receives both SQL and params array
- Filters with `{{ }}` expressions are resolved before sending

### Auto-Binding Logic
```ts
function getSmartAutoBinding(componentType?: ComponentType): string {
  if (componentType === 'Button') {
    return `{{queries.${queryName}.trigger}}`;  // Trigger execution
  }
  return `{{queries.${queryName}.data}}`;       // Display data
}
```

---

## Testing

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Create Test Database
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  status VARCHAR(20)
);

INSERT INTO users (name, email, status) VALUES
  ('Alice', 'alice@example.com', 'active'),
  ('Bob', 'bob@example.com', 'active'),
  ('Charlie', 'charlie@example.com', 'inactive');
```

### 3. Test the Builder
1. Create a PostgreSQL resource pointing to your DB
2. Create a Table component
3. Open DataTab → Select PostgreSQL resource
4. Visual Query Builder should appear
5. Select table: "users"
6. Select columns: all checkboxes
7. Click Preview → should see all 3 rows
8. Add filter: status = "active"
9. Click Preview → should see 2 rows (Alice, Bob)
10. Save → Table component displays filtered data

---

## Breaking Changes

### What Changed
- PostgreSQL resources in DataTab no longer show SQL textarea
- Instead, they show visual query builder
- Manual BindingPicker step is eliminated (auto-bind happens)
- REST/agent resources are unchanged

### What Stayed the Same
- Query execution logic (existing queryEngine)
- REST/agent resources
- Response transformers still work
- Binding expressions (`{{queries.xxx.data}}`) work identically
- Dependencies and triggers work the same way

---

## Future Improvements

1. **Advanced Filters**
   - AND/OR logic grouping
   - IN operator for lists
   - Date range picker

2. **Schema Caching**
   - Cache schema in browser localStorage
   - Reduce API calls

3. **Query Templates**
   - Save frequently used queries
   - Reuse across dashboards

4. **JOIN Support**
   - Visually select related tables
   - Auto-join on foreign keys

5. **Aggregations**
   - COUNT, SUM, AVG, MIN, MAX
   - GROUP BY visual builder

---

## Troubleshooting

### Query Builder doesn't appear
- Ensure resource type is "postgresql"
- Check browser console for schema fetch errors
- Verify database credentials in resource

### Preview shows no data
- Check filter values are correct
- Verify table and column names exist
- Check database permissions

### Component doesn't update after save
- Check if query is set to "onLoad" trigger
- Verify database connection is working
- Check browser console for errors

---

## Summary

The new simplified DB query binding system makes dashboard creation **dramatically easier**:
- ✅ No SQL knowledge required
- ✅ Visual feedback with preview
- ✅ Auto-binding saves steps
- ✅ SQL injection safe (parameterized)
- ✅ Supports dynamic filters via bindings
- ✅ Works for all component types

**Result:** Non-technical users can now create data-driven dashboards in minutes instead of hours.
