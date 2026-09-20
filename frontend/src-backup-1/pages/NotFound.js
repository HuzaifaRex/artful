import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container-artful py-32 text-center">
      <p className="font-serif text-7xl text-plum mb-4">404</p>
      <h1 className="section-title mb-4">Page not found</h1>
      <p className="text-ink-secondary mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  );
}
