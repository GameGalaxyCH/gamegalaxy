export const dynamic = 'force-dynamic';
import { prisma } from '../lib/prisma'; // Note: ../lib/db because we are in app/
import DashboardClient from './DashboardClient'; 

export default async function DashboardPage() {
  
  // 1. Get the total count of users
  const totalUsers = await prisma.user.count();

  // 2. Get the list of users (newest first)
  const recentUsers = await prisma.user.findMany({
    orderBy: {
      id: 'desc',
    },
    take: 10,
  });

  // 3. Send the data to the Client Component
  return (
    <DashboardClient 
      totalUsers={totalUsers} 
      recentUsers={recentUsers} 
    />
  );
}