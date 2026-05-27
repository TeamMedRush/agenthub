import { render } from "preact";

import { AuthProvider } from "@contexts/auth-context";
import { HomePage } from "@routes/home";

function App() {
  return (
    <AuthProvider>
      <HomePage />
    </AuthProvider>
  );
}

const appDiv = document.getElementById("app")!;
render(<App />, appDiv);
appDiv.focus();

