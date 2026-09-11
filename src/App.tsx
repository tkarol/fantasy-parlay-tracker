import { Outlet, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import Home from "./routes/Home";
import Dashboard from "./routes/Dashboard";
import CreateLeague from "./routes/CreateLeague";
import JoinLeague from "./routes/JoinLeague";
import League from "./routes/League";
import LeagueSettings from "./routes/LeagueSettings";
import NotFound from "./routes/NotFound";

function Layout() {
  return (
    <div className="min-h-screen bg-surface-2">
      <NavBar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="create" element={<CreateLeague />} />
        <Route path="join" element={<JoinLeague />} />
        <Route path="league/:leagueId" element={<League />} />
        <Route path="league/:leagueId/settings" element={<LeagueSettings />} />
        {/* The old /tracker deep link now lands on the league itself. */}
        <Route path="league/:leagueId/tracker" element={<League />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
