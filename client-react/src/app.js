import { useState } from "react";
import AuthPage from "./authPage";
import ChatsPage from "./chatsPage";

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <AuthPage onAuth={(user) => setUser(user)} />;
  } else {
    return <ChatsPage user={user} onLogout={() => setUser(null)} />;
  }
}

export default App;
