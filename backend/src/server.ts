import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import planRoute from './routes/plan-llm';
import editRoute from './routes/edit';
import explainRoute from './routes/explain-llm';
import exportRoute from './routes/export';
import emailRoute from './routes/email-itinerary';
import debugRoute from './routes/debug';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/plan', planRoute);
app.use('/edit', editRoute);
app.use('/explain', explainRoute);
app.use('/export', exportRoute);
app.use('/email-itinerary', emailRoute);
app.use('/debug', debugRoute);

app.listen(PORT, () => {
  console.log(`Travel Planner Backend listening on http://localhost:${PORT}`);
});
