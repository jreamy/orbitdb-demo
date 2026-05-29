import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { OrbitProvider } from "./provider.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <OrbitProvider>
    <StrictMode>
      <App />
    </StrictMode>
  </OrbitProvider>
);
