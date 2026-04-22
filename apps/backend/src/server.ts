import express from 'express';
import cors from 'cors';
import { ExecuteRequestSchema, ExecuteResponse, ExecuteResponseSchema } from '@btb/shared';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/v1/execute', async (req, res) => {
  try {
    const parseResult = ExecuteRequestSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: `Validation Error: ${parseResult.error.message}`
      } as ExecuteResponse);
    }
    
    const request = parseResult.data;
    
    // Stub implementation for Phase 1
    // A mock generic API executor response
    if (request.resourceId === 'mainApi') {
      const mockResult: ExecuteResponse = {
        success: true,
        data: [
          { id: '1', name: 'Cloud Migration Strategy', amount: 120000, status: 'In Progress' },
          { id: '2', name: 'Enterprise Architecture Review', amount: 85000, status: 'Completed' },
          { id: '3', name: 'Q3 License Renewals', amount: 45000, status: 'Pending' }
        ]
      };
      
      // Simulate network latency
      await new Promise(r => setTimeout(r, 600));
      return res.json(mockResult);
    }
    
    // A mock Agent executor response
    if (request.resourceId === 'agentRunner') {
      const mockResult: ExecuteResponse = {
        success: true,
        data: {
          logs: [
            "[INFO] Initializing agent executor...",
            "[INFO] Gathering required context from API...",
            "[WARN] Rate limit warning on upstream service",
            "[INFO] Agent formulated response",
            "[INFO] Task completed successfully"
          ],
          result: "Analysis generated successfully."
        }
      };
      
      await new Promise(r => setTimeout(r, 1200));
      return res.json(mockResult);
    }

    // Default error for unknown resources
    return res.status(404).json({
      success: false,
      error: `Resource ${request.resourceId} not found or unsupported`
    } as ExecuteResponse);
    
  } catch (err: any) {
    console.error('Execution error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    } as ExecuteResponse);
  }
});

app.listen(port, () => {
  console.log(`[btb-backend] Server is running on port ${port}`);
});
