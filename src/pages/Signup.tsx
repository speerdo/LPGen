import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

function Signup() {
  const { signup } = useAuth();

  useEffect(() => {
    signup('', '');
  }, [signup]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Redirecting to signup...</h2>
      </div>
    </div>
  );
}

export default Signup; 
