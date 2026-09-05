import React from "react";
import ReactDOM from "react-dom/client";
import "./storagePolyfill.js"; // must load before App.jsx uses window.storage
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
