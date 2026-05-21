import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { ThemeProvider, preloadTheme } from "@/lib/theme";

setBaseUrl("");
setAuthTokenGetter(() => localStorage.getItem("auth_token"));

preloadTheme();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
