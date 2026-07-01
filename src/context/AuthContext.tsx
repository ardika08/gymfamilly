import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { authService } from '../services/api';
import type { LoginInput, RegisterInput, User } from '../types/models';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  restoreError: string;
  clearRestoreError: () => void;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState('');

  useEffect(() => {
    const hasSavedSession = authService.hasSession();

    authService
      .currentUser({ throwOnFailure: hasSavedSession })
      .then((currentUser) => {
        setUser(currentUser);
      })
      .catch((error) => {
        setUser(null);
        setRestoreError(
          error instanceof Error
            ? `${error.message} Token login sebelumnya tidak lagi valid atau server menolak sesi Anda.`
            : 'Sesi login tidak dapat dipulihkan. Silakan masuk ulang.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      restoreError,
      clearRestoreError() {
        setRestoreError('');
      },
      async login(input) {
        setRestoreError('');
        const nextUser = await authService.login(input);
        setUser(nextUser);
        return nextUser;
      },
      async register(input) {
        setRestoreError('');
        const nextUser = await authService.register(input);
        setUser(nextUser);
        return nextUser;
      },
      async logout() {
        await authService.logout();
        setUser(null);
        setRestoreError('');
      },
    }),
    [loading, restoreError, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  }

  return value;
};
