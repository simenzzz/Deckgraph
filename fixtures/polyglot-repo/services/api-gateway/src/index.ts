import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { router } from './routes';

const app = express();
app.use(cors());
app.use(helmet());
app.use('/api', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
