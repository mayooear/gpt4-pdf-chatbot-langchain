import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // Adjusted path
import { updateUserRole, getUserById } from '../../../../lib/db'; // Adjusted path, added getUserById

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Forbidden: Access denied.' });
  }

  const { userId, newRole } = req.body;

  if (!userId || !newRole) {
    return res.status(400).json({ message: 'User ID and new role are required.' });
  }

  // Optional: Prevent admin from changing their own role through this specific UI action
  // if (session.user.id === userId) { // Note: session.user.id is the DB user ID from our callback
  //   return res.status(400).json({ message: "Admins cannot change their own role through this interface." });
  // }

  // Optional: Prevent changing role of the super admin or specific protected users
  // const targetUser = await getUserById(userId); // You might need to implement getUserById
  // if (targetUser && targetUser.data && targetUser.data.email === process.env.SUPER_ADMIN_EMAIL) {
  //    return res.status(403).json({ message: "This user's role cannot be changed." });
  // }


  // Validate newRole (optional, but good practice)
  const allowedRoles = ['User', 'Admin']; // Add other roles if they exist
  if (!allowedRoles.includes(newRole)) {
    return res.status(400).json({ message: `Invalid role: ${newRole}. Allowed roles are: ${allowedRoles.join(', ')}.`});
  }

  try {
    const { data: updatedUser, error } = await updateUserRole(userId, newRole);

    if (error) {
      console.error(`Error updating role for user ${userId}:`, error);
      return res.status(500).json({ message: 'Failed to update user role.', error: error.message });
    }

    if (!updatedUser) {
        return res.status(404).json({ message: 'User not found or not updated.'})
    }

    return res.status(200).json({ message: 'User role updated successfully.', user: updatedUser });
  } catch (error) {
    console.error('API error updating user role:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.', error: error.message });
  }
}

// Helper function getUserById (if not already in lib/db.js)
// You would typically add this to lib/db.js
// async function getUserById(userId) {
//   if (!userId) return { data: null, error: { message: 'User ID is required.' } };
//   return supabase.from('users').select('*').eq('id', userId).single();
// }
