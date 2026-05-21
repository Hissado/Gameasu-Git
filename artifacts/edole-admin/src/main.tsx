import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

setBaseUrl("");
setAuthTokenGetter(() => localStorage.getItem("auth_token"));

createRoot(document.getElementById("root")!).render(<App />);
