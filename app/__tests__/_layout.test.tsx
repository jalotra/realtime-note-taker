import { render } from "@testing-library/react-native";
import React from "react";

import RootLayout from "../_layout";

jest.mock("expo-router", () => ({
  Stack: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "stack" }, children),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("lucide-react-native", () => ({
  Lock: () => null,
}));

jest.mock("@expo-google-fonts/figtree", () => ({
  useFonts: () => [true],
  Figtree_400Regular: "Figtree_400Regular",
  Figtree_500Medium: "Figtree_500Medium",
  Figtree_600SemiBold: "Figtree_600SemiBold",
  Figtree_700Bold: "Figtree_700Bold",
}));

jest.mock("../../context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "auth-provider" }, children),
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    authenticate: jest.fn(),
    lock: jest.fn(),
  }),
}));

describe("RootLayout", () => {
  test("renders without crashing", () => {
    const { getByTestId } = render(<RootLayout />);
    expect(getByTestId("auth-provider")).toBeTruthy();
  });
});
