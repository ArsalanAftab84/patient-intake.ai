const express = require('express');
const cors = require('cors');
const patientRoutes = require('./routes/patientRoute');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/patients', patientRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});