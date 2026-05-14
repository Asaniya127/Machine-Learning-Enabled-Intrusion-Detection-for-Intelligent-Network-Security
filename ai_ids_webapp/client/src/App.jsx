import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./styles.css";

const API = "http://localhost:4000/api";
const socket = io("http://localhost:4000");

const initialForm = {
  duration: 0,
  protocol_type: "tcp",
  service: "http",
  flag: "SF",
  src_bytes: 181,
  dst_bytes: 5450,
  land: 0,
  wrong_fragment: 0,
  urgent: 0,
  hot: 0,
  num_failed_logins: 0,
  logged_in: 1,
  num_compromised: 0,
  root_shell: 0,
  su_attempted: 0,
  num_root: 0,
  num_file_creations: 0,
  num_shells: 0,
  num_access_files: 0,
  num_outbound_cmds: 0,
  is_host_login: 0,
  is_guest_login: 0,
  count: 9,
  srv_count: 9,
  serror_rate: 0,
  srv_serror_rate: 0,
  rerror_rate: 0,
  srv_rerror_rate: 0,
  same_srv_rate: 1,
  diff_srv_rate: 0,
  srv_diff_host_rate: 0,
  dst_host_count: 9,
  dst_host_srv_count: 9,
  dst_host_same_srv_rate: 1,
  dst_host_diff_srv_rate: 0,
  dst_host_same_src_port_rate: 0.11,
  dst_host_srv_diff_host_rate: 0,
  dst_host_serror_rate: 0,
  dst_host_srv_serror_rate: 0,
  dst_host_rerror_rate: 0,
  dst_host_srv_rerror_rate: 0,
};

function App() {
  const [formData, setFormData] = useState(initialForm);
  const [selectedModel, setSelectedModel] = useState("random_forest");
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, attacks: 0, normal: 0 });
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [status, setStatus] = useState("");

  const latestTen = useMemo(() => history.slice(0, 10), [history]);

  useEffect(() => {
    fetchModels();
    fetchHistory();

    socket.on("new_prediction", (record) => {
      setHistory((prev) => [record, ...prev].slice(0, 200));
    });

    socket.on("history_data", (data) => {
      setHistory(data.history || []);
      setStats(data.stats || { total: 0, attacks: 0, normal: 0 });
    });

    socket.on("intrusion_alert", (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 20));
    });

    return () => {
      socket.off("new_prediction");
      socket.off("history_data");
      socket.off("intrusion_alert");
    };
  }, []);

  const fetchModels = async () => {
    try {
      const res = await axios.get(`${API}/models`);
      setMetrics(res.data.data);
      setSelectedModel(res.data.data.best_model || "random_forest");
    } catch {
      setStatus("Could not load model metrics.");
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/history`);
      setHistory(res.data.history || []);
      setStats(res.data.stats || { total: 0, attacks: 0, normal: 0 });
    } catch {
      setStatus("Could not load prediction history.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const parsed = value === "" ? "" : isNaN(value) ? value : Number(value);

    setFormData((prev) => ({
      ...prev,
      [name]: parsed,
    }));
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    setStatus("Analyzing network traffic...");

    try {
      const res = await axios.post(`${API}/predict`, {
        model: selectedModel,
        data: formData,
      });

      setStats(res.data.stats);
      setStatus("Threat analysis completed.");
    } catch {
      setStatus("Prediction failed.");
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="hero-tag">AI POWERED SECURITY PLATFORM</p>

          <h1>Intrusion Detection Dashboard</h1>

          <p className="hero-subtitle">
            Real-time cyber threat detection and intelligent traffic analysis.
          </p>
        </div>

        <div className="hero-badge">
          <span>Best Model</span>
          <strong>{metrics?.best_model || "Loading..."}</strong>
        </div>
      </header>

      <section className="cards">
        <div className="stat-card">
          <h3>Total Traffic</h3>
          <p>{stats.total}</p>
        </div>

        <div className="stat-card danger-card">
          <h3>Detected Attacks</h3>
          <p>{stats.attacks}</p>
        </div>

        <div className="stat-card success-card">
          <h3>Safe Requests</h3>
          <p>{stats.normal}</p>
        </div>

        <div className="stat-card">
          <h3>Active Model</h3>
          <p>{selectedModel}</p>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Traffic Prediction</h2>
            <span>Manual Analysis</span>
          </div>

          <form onSubmit={handlePredict} className="form">
            <label>
              Select Detection Model

              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="logistic_regression">
                  Logistic Regression
                </option>

                <option value="linear_svm">
                  Linear SVM
                </option>

                <option value="random_forest">
                  Random Forest
                </option>
              </select>
            </label>

            <div className="form-grid">
              {Object.keys(initialForm).map((key) => (
                <label key={key}>
                  {key}

                  <input
                    name={key}
                    value={formData[key]}
                    onChange={handleChange}
                    type={
                      typeof initialForm[key] === "number"
                        ? "number"
                        : "text"
                    }
                    step="any"
                  />
                </label>
              ))}
            </div>

            <button type="submit" className="primary-btn">
              Run Threat Analysis
            </button>
          </form>
        </div>

        <div className="side-column">
          <div className="panel">
            <div className="panel-header">
              <h2>Live Threat Alerts</h2>
              <span>Real Time</span>
            </div>

            <div className="alerts">
              {alerts.length === 0 ? (
                <p className="muted">No threats detected.</p>
              ) : (
                alerts.map((alert, idx) => (
                  <div className="alert" key={idx}>
                    <strong>{alert.message}</strong>

                    <span>
                      {new Date(alert.time).toLocaleString()}
                    </span>

                    <small>
                      Detection Model: {alert.model}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Recent Detection Logs</h2>
          <span>Latest Requests</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Model</th>
                <th>Status</th>
                <th>Protocol</th>
                <th>Service</th>
                <th>Flag</th>
              </tr>
            </thead>

            <tbody>
              {latestTen.map((item) => (
                <tr key={item.id}>
                  <td>
                    {new Date(item.timestamp).toLocaleString()}
                  </td>

                  <td>{item.model}</td>

                  <td
                    className={
                      item.prediction === "Attack"
                        ? "text-danger"
                        : "text-safe"
                    }
                  >
                    {item.prediction}
                  </td>

                  <td>{item.input?.protocol_type}</td>
                  <td>{item.input?.service}</td>
                  <td>{item.input?.flag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {status && <footer className="status">{status}</footer>}
    </div>
  );
}

export default App;