import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      {({ email, signOut }) => <App email={email} onSignOut={signOut} />}
    </AuthGate>
  </StrictMode>
);
