import { useContext } from 'react';
import { AuthContext } from './authContextState';
export { AuthProvider } from './AuthProvider';

export const useAuth = () => useContext(AuthContext);
