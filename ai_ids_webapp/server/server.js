const express = require("express");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const multer = require("multer");
const FormData = require("form-data");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const upload = multer({ storage: multer.memoryStorage() });

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = 4000;
const ML_SERVICE_URL = "http://127.0.0.1:5000";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

let history = [];
let stats = {
  total: 0,
  attacks: 0,
  normal: 0,
};

function addRecord(record) {
  history.unshift(record);
  history = history.slice(0, 200);

  stats.total += 1;
  if (record.prediction === "Attack") {
    stats.attacks += 1;
  } else {
    stats.normal += 1;
  }
}

app.get("/api/health", async (req, res) => {
  try {
    const mlHealth = await axios.get(`${ML_SERVICE_URL}/health`);
    res.json({ success: true, backend: "ok", ml: mlHealth.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/models", async (req, res) => {
  try {
    const metrics = await axios.get(`${ML_SERVICE_URL}/metrics`);
    res.json({ success: true, data: metrics.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/history", (req, res) => {
  res.json({ success: true, history, stats });
});

app.post("/api/predict", async (req, res) => {
  try {
    const { model, data } = req.body;

    const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
      model,
      data,
    });

    if (!response.data.success) {
      return res.status(400).json(response.data);
    }

    const results = response.data.results.map((item, index) => {
      const inputRow = Array.isArray(data) ? data[index] : data;
      const record = {
        id: `${Date.now()}-${index}`,
        timestamp: new Date().toISOString(),
        model: response.data.model,
        prediction: item.prediction,
        input: inputRow,
      };

      addRecord(record);

      if (record.prediction === "Attack") {
        io.emit("intrusion_alert", {
          message: "Potential intrusion detected",
          time: record.timestamp,
          model: record.model,
        });
      }

      io.emit("new_prediction", record);
      return record;
    });

    res.json({ success: true, results, stats });
  } catch (error) {
    const message = error.response?.data || error.message;
    res.status(500).json({ success: false, error: message });
  }
});

app.post("/api/predict-csv", upload.single("file"), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append("model", req.body.model || "");
    formData.append("file", req.file.buffer, req.file.originalname);

    const response = await axios.post(`${ML_SERVICE_URL}/predict-csv`, formData, {
      headers: formData.getHeaders(),
    });

    res.json(response.data);
  } catch (error) {
    const message = error.response?.data || error.message;
    res.status(500).json({ success: false, error: message });
  }
});

io.on("connection", (socket) => {
  socket.emit("history_data", { history, stats });
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
