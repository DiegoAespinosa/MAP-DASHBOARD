import { Dashboard } from '@/components/dashboard';
import { getBoard } from '@/server/data';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const board = await getBoard();
  return <Dashboard board={board} />;
}
