import { Navigate } from "react-router-dom";

function ProtectedRoute({
  children,
  adminOnly = false,
}) {
  const token = localStorage.getItem("token");

  const storedUser = localStorage.getItem("user");

  let user = null;

  try {
    user = storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch {
    user = null;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (
    adminOnly &&
    user.role !== "ADMIN"
  ) {
    return <Navigate to="/chat" replace />;
  }

  return children;
}

export default ProtectedRoute;