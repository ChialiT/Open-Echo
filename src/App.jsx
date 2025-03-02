import { usePrivy } from "@privy-io/react-auth";
import Dashboard from "./components/Dashboard";

function App() {
  const { login, authenticated, ready } = usePrivy();

  if (!ready) {
    return <div className="text-center mt-20">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {authenticated ? (
        <Dashboard />
      ) : (
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-6">Open-Echo</h1>
          <button
            onClick={login}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Login with Privy
          </button>
        </div>
      )}
    </div>
  );
}

export default App;