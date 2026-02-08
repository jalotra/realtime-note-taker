import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Platform } from "react-native";

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  authenticate: () => Promise<void>;
  lock: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  authenticate: async () => {},
  lock: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const authenticate = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Note Taker",
        fallbackLabel: "Use passcode",
        disableDeviceFallback: false,
      });

      setIsAuthenticated(result.success);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const lock = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, authenticate, lock }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
