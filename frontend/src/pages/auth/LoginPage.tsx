import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    // Redirect to dashboard after successful login
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">AlgoTrade</h1>
          <p className="mt-2 text-sm text-gray-600">
            Algorithmic Trading Platform
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <LoginForm onSuccess={handleLoginSuccess} />
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Demo credentials for testing:
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Username: <code className="bg-gray-100 px-1 rounded">demo</code> | 
            Password: <code className="bg-gray-100 px-1 rounded">demo123</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;