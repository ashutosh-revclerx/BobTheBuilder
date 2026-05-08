# Bob the Builder - Internship Project Report

## Project Overview

**Bob the Builder** is a modern **No-Code Dashboard Builder** application that empowers users to create, customize, and deploy interactive dashboards without writing code. It provides a drag-and-drop interface for building data visualization dashboards that can connect to multiple data sources including REST APIs, PostgreSQL databases, and AI agents.

### Project Vision
Enable non-technical users and developers to rapidly prototype and deploy data-driven dashboards through an intuitive visual builder, reducing dashboard development time from weeks to hours.

### Use Cases
- **Business Analytics**: Create KPI dashboards, sales reports, performance metrics
- **Operations Monitoring**: Build monitoring dashboards for system health, logs, and alerts
- **Data Visualization**: Display data from APIs and databases in interactive charts and tables
- **Customer Reporting**: Generate shareable customer-facing dashboards with branded templates

---

## Technology Stack

### Frontend
- **Framework**: React 19.2.5 with TypeScript 6.0.2
- **Build Tool**: Vite 8.0.9 (fast bundling and HMR)
- **State Management**: Zustand 5.0.12 (lightweight, performant)
- **UI Components**: 
  - Recharts 3.8.1 (charts and data visualization)
  - React Grid Layout 2.2.3 (responsive grid system)
  - Lucide React 1.14.0 (icons)
- **Styling**: Tailwind CSS 4.2.4 (utility-first CSS)
- **Routing**: React Router 7.14.2
- **Utilities**:
  - JSZip 3.10.1 (export functionality)
  - File Saver 2.0.5 (download exports)
  - Pretext 0.0.6 (text processing)
- **Dev Tools**: ESLint 9.39.4, TypeScript compiler

### Backend
- **Runtime**: Node.js with TypeScript 5.7.3
- **Framework**: Express 4.21.2 (lightweight REST API)
- **Database**: PostgreSQL 8.20.0 with pg driver
- **File Upload**: Multer 2.1.1
- **Environment**: Dotenv 17.4.2
- **CORS**: cors 2.8.5
- **Dev Tool**: tsx 4.19.2 (TypeScript execution)

### Shared
- **Validation**: Zod 3.24.1 (schema validation and type inference)

### Infrastructure
- **Package Manager**: npm workspaces (monorepo)
- **Version Control**: Git
- **Process Manager**: concurrently (for local development)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              React Frontend (@btb/frontend)             ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │   Pages      │  │  Components  │  │  Services    │  ││
│  │  ├──────────────┤  ├──────────────┤  ├──────────────┤  ││
│  │  │- Dashboard   │  │- StatCard    │  │- Project     │  ││
│  │  │- Builder     │  │- Table       │  │- Export      │  ││
│  │  │- Gallery     │  │- BarChart    │  │- Assistant   │  ││
│  │  │- Generate    │  │- LineChart   │  │              │  ││
│  │  │- Resources   │  │- Button      │  │              │  ││
│  │  │- Customer    │  │- Forms       │  │              │  ││
│  │  │  View        │  │- Logs        │  │              │  ││
│  │  │              │  │- ChatBox     │  │              │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  │  ┌──────────────────────────────────────────────────┐   ││
│  │  │  Zustand Store (editorStore)                     │   ││
│  │  │  - Dashboard state                               │   ││
│  │  │  - Component definitions & styles                │   ││
│  │  │  - Theme configuration                           │   ││
│  │  │  - Query results and bindings                    │   ││
│  │  └──────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
│                          ↕ HTTP/REST                         │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Express.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Routes     │  │  Executors   │  │  Services    │       │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤       │
│  │- dashboards  │  │- dbExecutor  │  │- DB client   │       │
│  │- resources   │  │- restExecutor│  │- Logger      │       │
│  │- execute     │  │- agentExe.   │  │- Swagger     │       │
│  │- customers   │  │              │  │  Parser      │       │
│  │- assistant   │  │              │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Shared Schemas (Zod Validation)                   │    │
│  │  - ComponentConfig, ComponentStyle                 │    │
│  │  - QueryConfig, ResourceConfig                     │    │
│  │  - DashboardTemplate                               │    │
│  │  - ExecuteRequest/Response                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↕                                    │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PostgreSQL   │  │  REST APIs   │  │   AI Agents  │      │
│  │   Database   │  │  (external)  │  │  (custom)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Dashboard Creation**:
   - User selects template or starts from scratch
   - Components are added to canvas via drag-and-drop
   - Component styles are configured in right panel
   - Dashboard is saved to backend via API

2. **Query Execution**:
   - User configures a query (resource, endpoint, method, params)
   - Query is executed via `/api/execute` endpoint
   - Backend routes to appropriate executor (DB, REST, Agent)
   - Results are returned and stored in Zustand
   - Components referencing query display updated data

3. **Dashboard Rendering**:
   - Components render based on configuration
   - Data is bound via `dbBinding` expressions
   - Styles are applied dynamically
   - Real-time preview updates as user edits

4. **Export & Sharing**:
   - Dashboard config is exported as JSON/ZIP
   - Customer view renders published dashboard
   - No editing capabilities in customer view

---

## Core Features

### 1. Visual Dashboard Builder
- **Drag-and-Drop Canvas**: React Grid Layout-based responsive grid
- **Component Library**: 18+ pre-built components
  - **Data Display**: StatCard, Table, BarChart, LineChart, StatusBadge
  - **Input Controls**: TextInput, Select, NumberInput, Button, FileUpload
  - **Content**: Text, Image, Embed, Container, TabbedContainer
  - **Advanced**: LogsViewer, ChatBox, NodeGraph
- **Real-Time Preview**: See changes instantly as you edit
- **WYSIWYG Editing**: Edit component props inline

### 2. Data Integration
- **Multiple Resource Types**:
  - **REST APIs**: Connect to any HTTP endpoint
  - **PostgreSQL**: Query database directly with SQL
  - **AI Agents**: Custom agent endpoints
- **Query System**:
  - GET, POST, PUT, DELETE methods
  - Parameter binding with dashboard variables
  - Response transformation via expressions
  - Dependency management (query triggers)
  - Polling support for real-time data
- **Data Binding**: Expressions like `${query.name.data}` for dynamic content

### 3. Styling & Theming
- **Component Styling**:
  - Background color, text color, border, padding
  - Font family and size customization
  - Border radius for rounded corners
- **Pre-built Themes** (5 professional themes):
  - Emerald Grove (green palette)
  - Majestic Maroon (burgundy palette)
  - Midnight Indigo (dark blue palette)
  - Oceanic Teal (teal palette)
  - Sunset Blaze (orange/red palette)
- **Theme Application**: Apply theme globally to dashboard

### 4. Template System
- **Pre-built Templates**:
  - demo-backend-suite
  - small-dataset-pipeline
  - Custom templates for specific use cases
- **Gallery View**: Browse and select templates
- **Template Picker**: Guided template selection
- **Quick Start**: Generate dashboards from templates

### 5. AI Assistant Integration
- **Suggestion Cards**: AI-powered suggestions for dashboard improvements
- **Message History**: Conversation with assistant
- **Context Aware**: Understands current dashboard state
- **Smart Features**: Recommends components, layouts, optimizations

### 6. Export & Sharing
- **Export Formats**:
  - JSON configuration
  - ZIP with all assets
- **Customer View**: Shareable dashboard URL (`/c/:slug`)
- **Read-Only Mode**: Customers can view but not edit
- **Embed Support**: Embed dashboards in other applications

### 7. Resource Management
- **Resource Registry**: Centralized management of APIs and databases
- **Reusable Resources**: Define once, use in multiple dashboards
- **Endpoint Testing**: Validate resource connections
- **Dynamic Endpoints**: Parameterized URLs

### 8. Advanced Features
- **Role-Based Visibility**: Hide components based on user roles (admin, editor, viewer)
- **Data Transformation**: Transform query responses with custom logic
- **Mock Data**: Test dashboards with mock data before connecting real sources
- **Responsive Layout**: Auto-adjust to different screen sizes
- **Error Handling**: Graceful error display with QueryErrorBanner

---

## API Endpoints

### Dashboard Management
- `GET /api/dashboards` - List all dashboards
- `GET /api/dashboards/:id` - Get dashboard by ID
- `POST /api/dashboards` - Create new dashboard
- `PUT /api/dashboards/:id` - Update dashboard
- `DELETE /api/dashboards/:id` - Delete dashboard
- `GET /api/dashboards/slug/:slug` - Get dashboard by slug

### Query Execution
- `POST /api/execute` - Execute query/API call
  - Routes to appropriate executor (DB, REST, Agent)
  - Handles parameter binding and transformation

### Resources
- `GET /api/resources` - List all resources
- `POST /api/resources` - Create resource
- `PUT /api/resources/:id` - Update resource
- `DELETE /api/resources/:id` - Delete resource
- `POST /api/resources/:id/test` - Test resource connection

### Customers
- `GET /api/customers/:slug` - Get customer dashboard (public)
- `POST /api/customers/:slug/usage` - Track usage

### Assistant
- `POST /api/assistant/suggestions` - Get AI suggestions
- `POST /api/assistant/message` - Send message to assistant

### Health
- `GET /health` - Server and database health check

---

## Project Structure

```
BobTheBuilder/
├── apps/
│   ├── frontend/                    # React dashboard builder
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── dashboard-components/    # 18+ reusable components
│   │   │   │   ├── editor/                 # Builder UI (canvas, panels)
│   │   │   │   ├── assistant/              # AI assistant UI
│   │   │   │   ├── ui/                     # Shared UI components
│   │   │   │   └── preview/                # Dashboard preview renderer
│   │   │   ├── pages/
│   │   │   │   ├── DashboardList.tsx       # Home page
│   │   │   │   ├── BuilderPage.tsx         # Editor page
│   │   │   │   ├── CustomerView.tsx        # Public dashboard view
│   │   │   │   ├── TemplateGallery.tsx     # Template browser
│   │   │   │   ├── GeneratePage.tsx        # AI generation
│   │   │   │   └── ResourcesPage.tsx       # Resource management
│   │   │   ├── store/
│   │   │   │   └── editorStore.ts          # Zustand state management
│   │   │   ├── services/
│   │   │   │   ├── ProjectService.ts       # Dashboard API calls
│   │   │   │   ├── exportService.ts        # Export functionality
│   │   │   │   └── assistantService.ts     # AI assistant API
│   │   │   ├── engine/
│   │   │   │   ├── queryEngine.ts          # Query execution logic
│   │   │   │   ├── bindingResolver.ts      # Data binding expressions
│   │   │   │   └── runtimeUtils.ts         # Runtime utilities
│   │   │   ├── config/
│   │   │   │   ├── componentRegistry.ts    # Component definitions
│   │   │   │   ├── renderRegistry.tsx      # Component renderers
│   │   │   │   └── themes.ts               # Theme definitions
│   │   │   ├── templates/                  # Pre-built templates
│   │   │   ├── types/                      # TypeScript types
│   │   │   ├── hooks/                      # Custom React hooks
│   │   │   ├── utils/                      # Utility functions
│   │   │   └── App.tsx                     # Main app + routing
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── backend/                     # Express API server
│       ├── src/
│       │   ├── routes/
│       │   │   ├── dashboards.ts    # Dashboard CRUD
│       │   │   ├── resources.ts     # Resource management
│       │   │   ├── execute.ts       # Query execution
│       │   │   ├── customers.ts     # Public dashboards
│       │   │   └── assistant.ts     # AI assistant
│       │   ├── executors/
│       │   │   ├── dbExecutor.ts    # PostgreSQL executor
│       │   │   ├── restExecutor.ts  # REST API executor
│       │   │   └── agentExecutor.ts # AI agent executor
│       │   ├── db/
│       │   │   ├── client.ts        # Database connection pool
│       │   │   └── migrate.ts       # Database migrations
│       │   ├── utils/
│       │   │   ├── logger.ts        # Logging utility
│       │   │   └── swaggerParser.ts # API schema parsing
│       │   ├── app.ts               # Express app setup
│       │   └── server.ts            # Server entry point
│       ├── .env                     # Environment variables
│       └── package.json
│
├── packages/
│   └── shared/                      # Shared code
│       └── src/
│           └── index.ts             # Zod schemas + types
│
├── package.json                     # Root workspace config
├── README.md                        # Project README
└── CLAUDE.md                        # This file
```

---

## Key Workflows

### Workflow 1: Creating a Dashboard from Template
```
User clicks "Create New" 
  → Selects template from gallery 
  → Opens builder with template components 
  → Edits component styles and data bindings 
  → Configures queries and resources 
  → Saves dashboard 
  → Gets shareable URL
```

### Workflow 2: Executing a Query
```
User configures query in DataTab 
  → Selects resource (REST/DB/Agent) 
  → Sets endpoint and parameters 
  → Binds parameters to dashboard state 
  → Clicks "Execute" 
  → Backend validates request with Zod 
  → Routes to appropriate executor 
  → Returns data to frontend 
  → Components render with new data
```

### Workflow 3: Styling Components
```
User selects component on canvas 
  → Opens StyleTab 
  → Changes colors, fonts, spacing 
  → Applies theme or custom colors 
  → Preview updates in real-time 
  → Saves changes
```

### Workflow 4: Exporting Dashboard
```
User clicks "Export" 
  → Selects export format (JSON/ZIP) 
  → Frontend packages dashboard config and assets 
  → Downloads file to user's computer 
  → Can re-import or share with others
```

---

## Component System

### Component Config Structure
```typescript
{
  id: "card-1",
  type: "StatCard",
  label: "Total Users",
  
  // Position and size (grid)
  layout: { x: 0, y: 0, w: 4, h: 6 },
  
  // Styling
  style: {
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    fontSize: 16,
    borderRadius: 8
  },
  
  // Data binding
  data: {
    dbBinding: "${query.getUsers.data.count}",
    mockValue: "1,234",
    visible: "true",
    visibleForRoles: ["admin", "editor"]
  },
  
  // Component-specific props
  value: "${query.getUsers.data.count}",
  suffix: " users"
}
```

### Component Types & Their Purpose

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| **StatCard** | Display key metrics | value, suffix, trend |
| **Table** | Show tabular data | columns, data, sortable |
| **BarChart** | Visualize categorical data | dataKey, categories, colors |
| **LineChart** | Show trends over time | dataKey, timeAxis, smooth |
| **Button** | Trigger actions | label, onClick handler |
| **TextInput** | Collect text input | placeholder, value, onChange |
| **Select** | Choose from options | options, value, onChange |
| **StatusBadge** | Show status | status, label |
| **LogsViewer** | Display logs | logs array, search, filter |
| **ChatBox** | Chat interface | messages, onSendMessage |
| **Text** | Display text | content, alignment |
| **Image** | Display image | url, alt |
| **Embed** | Embed external content | url, height |
| **Container** | Group components | background, padding |
| **TabbedContainer** | Tab navigation | tabs, activeTab |
| **NumberInput** | Enter numbers | placeholder, value, onChange |
| **FileUpload** | Upload files | onFileSelect, accept |
| **NodeGraph** | Visualize networks | nodes, edges |

---

## Data Flow Examples

### Example 1: Displaying API Data
```
1. User adds "BarChart" component
2. Configures query:
   - Resource: "Public API"
   - Endpoint: "/api/sales"
   - Method: GET
3. Sets component data binding: "${query.sales.data}"
4. Selects chart axes: X="month", Y="revenue"
5. User saves dashboard
6. On load, query executes
7. API returns: { data: [{month: "Jan", revenue: 5000}, ...] }
8. BarChart renders with data
```

### Example 2: Database Query with Parameters
```
1. User creates TextInput component for month filter
2. Creates query:
   - Resource: "PostgreSQL"
   - SQL: "SELECT * FROM sales WHERE month = $1"
   - Params: { month: "${monthInput.value}" }
3. Sets BarChart binding: "${query.dbSales.data}"
4. When user changes TextInput:
   - Query re-executes with new month
   - BarChart updates automatically
```

### Example 3: Dependent Queries
```
1. Query A: Gets list of users (onLoad)
2. Query B: Gets user details (depends on Query A)
3. When Query A completes:
   - Stores results in state
   - Triggers Query B
   - Query B uses user ID from Query A
4. Both queries completed, dashboard fully loaded
```

---

## State Management (Zustand)

### EditorStore Structure
```typescript
{
  // Dashboard data
  dashboard: DashboardTemplate,
  selectedComponentId: string | null,
  theme: ThemeName,
  
  // Query results
  queryResults: Record<string, any>,
  queryLoading: Record<string, boolean>,
  queryErrors: Record<string, string>,
  
  // Editor state
  currentTab: 'data' | 'style' | 'theme',
  isPublished: boolean,
  lastSaved: Date,
  
  // Actions
  updateComponent(id, config),
  deleteComponent(id),
  executeQuery(queryConfig),
  setTheme(themeName),
  saveDashboard(),
  publishDashboard()
}
```

---

## Error Handling

### Frontend Error Handling
- **QueryErrorBanner**: Displays API errors to user
- **Try-catch blocks**: Catches unexpected errors
- **Validation**: Zod schemas catch invalid data before sending to backend
- **User feedback**: Toast notifications for successful actions

### Backend Error Handling
- **Route-level validation**: Zod schemas validate all requests
- **Try-catch wrappers**: AsyncHandler wraps route handlers
- **Database errors**: Caught and returned as user-friendly messages
- **Executor errors**: Handled per-executor with detailed logs
- **Logging**: All errors logged with context for debugging

---

## Performance Considerations

1. **Frontend Optimization**:
   - Lazy loading of routes
   - Memoization of expensive components
   - Debounced style updates
   - Efficient Zustand subscriptions

2. **Backend Optimization**:
   - Connection pooling for database
   - Query result caching (short-term)
   - Async request handling

3. **Data Transfer**:
   - Only necessary fields sent to client
   - Compressed exports for large dashboards
   - Pagination for large datasets

---

## Security Features

1. **Input Validation**:
   - Zod schemas validate all inputs
   - SQL injection prevention via parameterized queries
   - XSS prevention through React's rendering

2. **Authentication**:
   - CORS configured for allowed origins
   - Future: JWT tokens for API authentication

3. **Authorization**:
   - Role-based component visibility
   - Read-only customer dashboards

4. **Data Protection**:
   - Database credentials in environment variables
   - HTTPS recommended for production

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start dev servers (frontend + backend)
npm run dev

# Frontend runs on http://localhost:5173
# Backend runs on http://localhost:3001
```

### Building for Production
```bash
# Build all workspaces
npm run build

# Frontend builds to apps/frontend/dist/
# Backend ready to run with `npm start`
```

### Linting
```bash
# Lint all workspaces
npm run lint
```

---

## Future Enhancements

1. **Authentication & Authorization**:
   - User accounts and authentication
   - Team collaboration features
   - Fine-grained permissions

2. **Advanced Querying**:
   - GraphQL support
   - Complex joins and aggregations
   - Query builder UI

3. **More Components**:
   - Kanban board
   - Calendar view
   - Map visualization
   - Custom components

4. **Collaboration**:
   - Real-time multi-user editing
   - Comments and annotations
   - Version history

5. **Analytics**:
   - Dashboard usage analytics
   - Query performance monitoring
   - Component usage insights

6. **Mobile Support**:
   - Responsive design improvements
   - Mobile-optimized components
   - Progressive Web App (PWA)

---

## Troubleshooting

### Dashboard Won't Load
- Check backend is running: `curl http://localhost:3001/health`
- Verify database connection in backend logs
- Check browser console for errors

### Query Not Returning Data
- Test resource endpoint directly
- Check query parameters are correct
- Verify database credentials
- Review backend logs for executor errors

### Components Not Displaying
- Ensure component registry is up to date
- Check if component type is recognized
- Verify data binding syntax is correct
- Check browser console for render errors

### Export Not Working
- Ensure JSZip is properly bundled
- Check browser file system permissions
- Try different export format

---

## Key Technologies Explained

### Zustand
Lightweight state management library. Used to:
- Store dashboard configuration
- Store query results and loading states
- Manage UI state (selected components, tabs)
- Persist state to localStorage

### React Grid Layout
Provides drag-and-drop, resizable grid layout. Used to:
- Position components on canvas
- Make layouts responsive
- Handle component movement and resizing
- Persist layout configuration

### Zod
Schema validation and TypeScript type generation. Used to:
- Validate API requests/responses
- Ensure data consistency
- Generate TypeScript types automatically
- Provide helpful error messages

### Recharts
React charting library. Used to:
- Display BarChart and LineChart components
- Handle responsive sizing
- Support interactive legends and tooltips

---

## Conclusion

Bob the Builder is a comprehensive no-code dashboard builder that democratizes dashboard creation. By combining a powerful frontend editor with a flexible backend API architecture, it enables users to rapidly create data-driven dashboards that connect to multiple data sources. The modular component system, powerful styling engine, and AI assistant integration make it a complete solution for dashboard development.

This project demonstrates modern full-stack development practices including:
- Monorepo architecture with workspace management
- Type-safe development with TypeScript and Zod
- Reactive state management with Zustand
- RESTful API design with Express
- Database integration with PostgreSQL
- Component-based architecture
- Real-time preview and editing

The system is designed to be scalable, maintainable, and user-friendly, with a focus on enabling users with no technical background to create professional dashboards.
