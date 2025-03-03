// src/pages/session.tsx

import { useSession } from 'next-auth/react';

const SessionPage = () => {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Laddar...</div>;
  }

  if (!session) {
    return <div>Ingen session aktiv.</div>;
  }

  return (
    <div>
      <h1>Session Information</h1>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </div>
  );
};

export default SessionPage;
