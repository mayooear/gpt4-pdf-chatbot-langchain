import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // Corrected path again
import { getAllUsers } from '../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Forbidden: Access denied.' });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const { data: users, count, error } = await getAllUsers({ page, limit });

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ message: 'Failed to fetch users.', error: error.message });
    }

    return res.status(200).json({
      users,
      totalUsers: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error('API error fetching users:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.', error: error.message });
  }
}
