import React, { useState, useEffect, useCallback } from 'react';
import withAdminAuth from '../../components/auth/withAdminAuth';
import Layout from '../../components/layout';

const ITEMS_PER_PAGE = 10; // Or fetch from settings
const ALLOWED_ROLES = ['User', 'Admin']; // Roles that can be assigned

function AdminUsersPageContent() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // For optimistic updates or tracking individual user changes
  const [updatingRoles, setUpdatingRoles] = useState({}); // { userId: boolean }

  const fetchUsers = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/list?page=${page}&limit=${ITEMS_PER_PAGE}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data.users || []);
      setTotalUsers(data.totalUsers || 0);
      setCurrentPage(data.currentPage || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(currentPage);
  }, [fetchUsers, currentPage]);

  const handleRoleChange = async (userId, newRole) => {
    if (!userId || !newRole) {
      setError('User ID or role is missing for update.');
      return;
    }
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
        return;
    }

    setUpdatingRoles(prev => ({ ...prev, [userId]: true }));
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to update role');
      }
      setMessage(`User ${userId} role updated to ${newRole}.`);
      // Optimistically update UI or re-fetch
      // For simplicity, find user and update their role in local state
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
    } catch (err) {
      console.error("Error updating role:", err);
      setError(err.message);
    } finally {
      setUpdatingRoles(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div>
      <h1>User Management</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      {isLoading ? (
        <p>Loading users...</p>
      ) : users.length === 0 && !error ? (
        <p>No users found.</p>
      ) : (
        <>
          <p>Total Users: {totalUsers}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>ID</th>
                <th style={tableHeaderStyle}>Email</th>
                <th style={tableHeaderStyle}>Name</th>
                <th style={tableHeaderStyle}>Current Role</th>
                <th style={tableHeaderStyle}>Change Role</th>
                <th style={tableHeaderStyle}>Registered</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={tableCellStyle}>{user.id}</td>
                  <td style={tableCellStyle}>{user.email}</td>
                  <td style={tableCellStyle}>{user.name || 'N/A'}</td>
                  <td style={tableCellStyle}>{user.role}</td>
                  <td style={tableCellStyle}>
                    <select
                      defaultValue={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={updatingRoles[user.id]}
                      style={{ padding: '0.25rem', marginRight: '0.5rem' }}
                    >
                      {ALLOWED_ROLES.map(roleOption => (
                        <option key={roleOption} value={roleOption}>
                          {roleOption}
                        </option>
                      ))}
                    </select>
                    {updatingRoles[user.id] && <small>Updating...</small>}
                  </td>
                  <td style={tableCellStyle}>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading}>
              Previous
            </button>
            <span style={{ margin: '0 1rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || isLoading}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const tableHeaderStyle = {
  borderBottom: '2px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  backgroundColor: '#f7f7f7',
};

const tableCellStyle = {
  borderBottom: '1px solid #eee',
  padding: '8px',
};


const ProtectedAdminUsersPage = () => {
  return (
    <Layout>
      <AdminUsersPageContent />
    </Layout>
  );
};

export default withAdminAuth(ProtectedAdminUsersPage);
