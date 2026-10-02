import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function AdminDashboard() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const storedUser = localStorage.getItem("user");
  const admin = storedUser ? JSON.parse(storedUser) : null;

  // =========================================
  // FETCH ALL USERS
  // =========================================
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/admin/users");

      setUsers(response.data.users || []);
    } catch (err) {
      console.error("Fetch users error:", err);

      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        navigate("/login");
        return;
      }

      if (err.response?.status === 403) {
        setError("You do not have Admin access.");
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // =========================================
  // ACTIVATE USER
  // =========================================
  const activateUser = async (user) => {
    try {
      setActionLoading(user._id);
      setError("");
      setMessage("");

      const response = await API.put(
        `/admin/users/${user._id}/activate`
      );

      setMessage(response.data.message);

      await fetchUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to activate user."
      );
    } finally {
      setActionLoading("");
    }
  };

  // =========================================
  // DEACTIVATE USER
  // =========================================
  const deactivateUser = async (user) => {
    const confirmed = window.confirm(
      `Deactivate ${user.name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(user._id);
      setError("");
      setMessage("");

      const response = await API.put(
        `/admin/users/${user._id}/deactivate`
      );

      setMessage(response.data.message);

      await fetchUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to deactivate user."
      );
    } finally {
      setActionLoading("");
    }
  };

  // =========================================
  // LOGOUT
  // =========================================
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  // =========================================
  // USER GROUPS
  // =========================================
  const normalUsers = users.filter(
    (user) => user.role !== "ADMIN"
  );

  const pendingUsers = normalUsers.filter(
    (user) => user.status === "PENDING"
  );

  const activeUsers = normalUsers.filter(
    (user) => user.status === "ACTIVE"
  );

  const inactiveUsers = normalUsers.filter(
    (user) => user.status === "INACTIVE"
  );

  return (
    <div className="admin-page">

      {/* HEADER */}

      <header className="admin-header">
        <div>
          <h1>Harish Chat</h1>
          <p>Administration</p>
        </div>

        <div className="admin-header-right">
          <div className="admin-profile">
            <strong>
              {admin?.name || "Administrator"}
            </strong>

            <span>{admin?.email}</span>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="admin-container">

        {/* PAGE TITLE */}

        <div className="admin-title">
          <div>
            <h2>User Management</h2>

            <p>
              Approve and manage access to the
              chat portal.
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={fetchUsers}
          >
            Refresh
          </button>
        </div>

        {/* MESSAGES */}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {message && (
          <div className="success-message">
            {message}
          </div>
        )}

        {/* SUMMARY */}

        <div className="admin-stats">

          <div className="stat-card">
            <span>Total Users</span>
            <strong>{normalUsers.length}</strong>
          </div>

          <div className="stat-card pending-stat">
            <span>Pending</span>
            <strong>{pendingUsers.length}</strong>
          </div>

          <div className="stat-card active-stat">
            <span>Active</span>
            <strong>{activeUsers.length}</strong>
          </div>

          <div className="stat-card inactive-stat">
            <span>Inactive</span>
            <strong>{inactiveUsers.length}</strong>
          </div>

        </div>

        {loading ? (
          <div className="admin-loading">
            Loading users...
          </div>
        ) : (
          <>
            <UserSection
              title="Pending Approval"
              users={pendingUsers}
              emptyMessage="No users are waiting for approval."
              actionLoading={actionLoading}
              onActivate={activateUser}
              onDeactivate={deactivateUser}
            />

            <UserSection
              title="Active Users"
              users={activeUsers}
              emptyMessage="No active users."
              actionLoading={actionLoading}
              onActivate={activateUser}
              onDeactivate={deactivateUser}
            />

            <UserSection
              title="Inactive Users"
              users={inactiveUsers}
              emptyMessage="No inactive users."
              actionLoading={actionLoading}
              onActivate={activateUser}
              onDeactivate={deactivateUser}
            />
          </>
        )}
      </main>
    </div>
  );
}

// =========================================
// USER SECTION
// =========================================

function UserSection({
  title,
  users,
  emptyMessage,
  actionLoading,
  onActivate,
  onDeactivate,
}) {
  return (
    <section className="user-section">

      <div className="section-heading">
        <h3>{title}</h3>

        <span>{users.length}</span>
      </div>

      {users.length === 0 ? (
        <div className="empty-users">
          {emptyMessage}
        </div>
      ) : (
        <div className="user-table-wrapper">

          <table className="user-table">

            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>

              {users.map((user) => (
                <tr key={user._id}>

                  <td>
                    <div className="user-name-cell">
                      <div className="user-avatar">
                        {user.name
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>

                      <strong>{user.name}</strong>
                    </div>
                  </td>

                  <td>{user.email}</td>

                  <td>
                    <StatusBadge
                      status={user.status}
                    />
                  </td>

                  <td>
                    {user.createdAt
                      ? new Date(
                          user.createdAt
                        ).toLocaleDateString()
                      : "-"}
                  </td>

                  <td>

                    {user.status === "PENDING" && (
                      <button
                        className="activate-button"
                        disabled={
                          actionLoading === user._id
                        }
                        onClick={() =>
                          onActivate(user)
                        }
                      >
                        {actionLoading === user._id
                          ? "Processing..."
                          : "Approve"}
                      </button>
                    )}

                    {user.status === "ACTIVE" && (
                      <button
                        className="deactivate-button"
                        disabled={
                          actionLoading === user._id
                        }
                        onClick={() =>
                          onDeactivate(user)
                        }
                      >
                        {actionLoading === user._id
                          ? "Processing..."
                          : "Deactivate"}
                      </button>
                    )}

                    {user.status === "INACTIVE" && (
                      <button
                        className="activate-button"
                        disabled={
                          actionLoading === user._id
                        }
                        onClick={() =>
                          onActivate(user)
                        }
                      >
                        {actionLoading === user._id
                          ? "Processing..."
                          : "Activate"}
                      </button>
                    )}

                  </td>
                </tr>
              ))}

            </tbody>
          </table>

        </div>
      )}
    </section>
  );
}

// =========================================
// STATUS BADGE
// =========================================

function StatusBadge({ status }) {
  return (
    <span
      className={`status-badge ${status.toLowerCase()}`}
    >
      {status}
    </span>
  );
}

export default AdminDashboard;