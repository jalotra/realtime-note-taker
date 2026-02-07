import { render } from "@testing-library/react-native";
import React from "react";

import Index from "../index";

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) =>
    React.createElement("div", { "data-testid": "redirect", "data-href": href }),
}));

describe("Index Screen", () => {
  test("redirects to (app)", () => {
    const { getByTestId } = render(<Index />);
    const redirect = getByTestId("redirect");
    expect(redirect.props["data-href"]).toBe("/(app)");
  });
});
