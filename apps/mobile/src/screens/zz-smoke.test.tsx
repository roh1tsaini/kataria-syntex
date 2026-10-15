import { render, screen } from "@testing-library/react-native";

// One React copy for the whole test: the renderer lives at the repo root, the
// app's own react is nested under apps/mobile (version pin) — without this the
// hooks dispatcher is registered on one copy and read from the other.
jest.mock("react", () => jest.requireActual("../../../../node_modules/react"));
jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

test("smoke: primitives render under jest-expo", async () => {
  await render(
    <Card>
      <CardTitle>Sign in</CardTitle>
      <Button
        label="Continue"
        onPress={() => {}}
        accessibilityLabel="Continue"
      />
    </Card>,
  );
  expect(screen.getByText("Sign in")).toBeTruthy();
  expect(screen.getByText("Continue")).toBeTruthy();
});
