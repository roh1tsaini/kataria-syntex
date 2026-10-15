import { render, screen, fireEvent } from "@testing-library/react-native";

jest.mock("react", () => jest.requireActual("../../../../node_modules/react"));
jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

jest.mock("@kataria-syntex/app-core", () => ({
  useAuth: (selector: any) =>
    selector({
      user: { name: "Test User", phone: "+919876543210" },
      logout: mockLogout,
    }),
  setUpdateRequiredHandler: jest.fn(),
}));

const { SettingsScreen } = require("@/screens/settings");

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders user information and theme options", async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Test User")).toBeTruthy();
    expect(screen.getByText("+919876543210")).toBeTruthy();
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
  });

  it("navigates to devices screen on press", async () => {
    await render(<SettingsScreen />);
    const devicesButton = screen.getByLabelText("Manage signed-in devices");
    fireEvent.press(devicesButton);
    expect(mockPush).toHaveBeenCalledWith("/devices");
  });

  it("handles sign out", async () => {
    await render(<SettingsScreen />);
    const signOutBtn = screen.getByLabelText("Sign out of account");
    fireEvent.press(signOutBtn);
    expect(mockLogout).toHaveBeenCalled();
  });
});
