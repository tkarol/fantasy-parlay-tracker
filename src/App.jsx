import React from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import Home from "./routes/Home";
import Dashboard from "./routes/Dashboard";
import CreateLeague from "./routes/CreateLeague";
import JoinLeague from "./routes/JoinLeague";
import League from "./routes/League";
import LeagueSettings from "./routes/LeagueSettings";
import FantasyParlayTracker from "./components/FantasyParlayTracker";
import NavBar from "./components/NavBar";

function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      <NavBar />
      {/* pt-4/pt-6 to give breathing room below sticky nav */}
      <div className="px-3 md:px-6 pt-4 md:pt-6">
        <Outlet />
      </div>
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
        {/* If you still link directly to the tracker view: */}
        <Route path="league/:leagueId/tracker" element={<FantasyParlayTracker />} />
      </Route>
    </Routes>
  );
}
