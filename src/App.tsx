import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { AccessGate } from "./components/AccessGate";
import { LeagueProvider } from "./providers/LeagueProvider";
import ThisWeek from "./routes/ThisWeek";
import Stats from "./routes/Stats";
import Admin from "./routes/Admin";

function Layout() {
  return (
    <div className="min-h-screen bg-surface-2">
      <NavBar />
      <main>
        <AccessGate>
          <Outlet />
        </AccessGate>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LeagueProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ThisWeek />} />
          <Route path="stats" element={<Stats />} />
          <Route path="admin" element={<Admin />} />

          {/*
            The app used to host many leagues. Those paths still exist in
            people's history and bookmarks, so they land on the one league
            rather than a dead end.
          */}
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="create" element={<Navigate to="/" replace />} />
          <Route path="join" element={<Navigate to="/" replace />} />
          <Route path="league/:leagueId" element={<Navigate to="/" replace />} />
          <Route path="league/:leagueId/tracker" element={<Navigate to="/" replace />} />
          <Route path="league/:leagueId/settings" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LeagueProvider>
  );
}
