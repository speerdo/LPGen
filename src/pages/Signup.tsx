import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function Signup() {
  const { signUp } = useAuth();

  useEffect(() => {
    signUp('', '');
  }, [signUp]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Redirecting to signup...</h2>
      </div>
    </div>
  );
}

export default Signup; 
