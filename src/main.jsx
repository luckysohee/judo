import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { installPerfTraceConsoleHelp } from "./utils/devPerfTrace.js";
import { bootstrapNativeShell } from "./lib/native/bootstrap.js";

installPerfTraceConsoleHelp();
void bootstrapNativeShell();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);