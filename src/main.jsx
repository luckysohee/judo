import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { installPerfTraceConsoleHelp } from "./utils/devPerfTrace.js";

installPerfTraceConsoleHelp();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
        <Analytics />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);