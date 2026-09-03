import React from "react";
import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import Footer from "./components/Footer.jsx";
import Landing from "./pages/Landing.jsx";
import Console from "./pages/Console.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import Assistant from "./pages/Assistant.jsx";
import Architecture from "./pages/Architecture.jsx";
import { useSmoothScroll } from "./hooks/useSmoothScroll.js";

export default function App() {
  useSmoothScroll();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/console" element={<Console />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function NotFound() {
  return (
    <div className="container" style={{ padding: "120px 32px", textAlign: "center" }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Page not found</h1>
      <p style={{ color: "var(--text-tertiary)" }}>That route doesn't exist in Vasooli.</p>
    </div>
  );
}
