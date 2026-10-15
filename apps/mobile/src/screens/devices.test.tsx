import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

jest.mock("react", () => jest.requireActual("../../../../node_modules/react"));
jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
jest.mock("@/components/ui/disclosure", () => {
  const { View } = require("react-native");
  return {
    MorphPanel: ({ open, children }: { open: boolean; children: unknown }) =>
      open ? <View>{children}</View> : null,
  };
});
jest.mock("@/components/ui/sheet", () => {
  const { Text, View } = require("react-native");
  return {
    Sheet: ({ open, children }: { open: boolean; children: unknown }) =>
      open ? <View>{children}</View> : null,
    SheetHeader: ({ children }: { children: unknown }) => (
      <View>{children}</View>
    ),
    SheetTitle: ({ children }: { children: unknown }) => (
      <Text>{children}</Text>
    ),
    SheetDescription: ({ children }: { children: unknown }) => (
      <Text>{children}</Text>
    ),
  };
});

const mockRefreshDevices = jest.fn();
const mockDeleteDevice = jest.fn();
const mockApproveQrLogin = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

let mockDevices = [
  {
    id: "other",
    label: "Office Chrome",
    platform: "web",
    userAgent: "Mozilla/5.0",
    lastSeenAt: "2026-10-14T10:00:00.000Z",
    isCurrent: false,
  },
  {
    id: "current",
    label: "My Android",
    platform: "android",
    userAgent: null,
    lastSeenAt: "2026-10-15T10:00:00.000Z",
    isCurrent: true,
  },
];

jest.mock("@kataria-syntex/app-core", () => ({
  useAuth: (selector: (state: object) => unknown) =>
    selector({
      devices: mockDevices,
      refreshDevices: mockRefreshDevices,
      deleteDevice: mockDeleteDevice,
      approveQrLogin: mockApproveQrLogin,
    }),
  friendlyError: () => "Could not load your devices.",
  toastSuccess: (...args: unknown[]) => mockToastSuccess(...args),
  toastError: (...args: unknown[]) => mockToastError(...args),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { DevicesScreen } from "@/screens/devices";

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshDevices.mockResolvedValue(undefined);
  mockDeleteDevice.mockResolvedValue(undefined);
  mockApproveQrLogin.mockResolvedValue({
    grantedSelf: false,
    grantedName: "Office Chrome",
  });
});

test("loads current device first and reveals technical details", async () => {
  await render(<DevicesScreen />);
  await waitFor(() => expect(mockRefreshDevices).toHaveBeenCalled());
  expect(screen.getByText("This device")).toBeTruthy();
  expect(screen.getByText(/Android app/)).toBeTruthy();
  expect(screen.getByText(/Web browser/)).toBeTruthy();
  expect(
    screen.getByLabelText("Technical details for Office Chrome"),
  ).toBeTruthy();
});

test("approves a typed device code", async () => {
  await render(<DevicesScreen />);
  await waitFor(() => expect(mockRefreshDevices).toHaveBeenCalled());
  fireEvent.press(screen.getByText("Approve device"));
  fireEvent.changeText(
    await screen.findByLabelText("Approval code"),
    "pair-code",
  );
  const approvalButtons = screen.getAllByRole("button", {
    name: "Approve device",
  });
  const submit = approvalButtons[approvalButtons.length - 1];
  await waitFor(() =>
    expect(submit.props.accessibilityState.disabled).toBe(false),
  );
  fireEvent.press(submit);
  await waitFor(() =>
    expect(mockApproveQrLogin).toHaveBeenCalledWith("pair-code"),
  );
  expect(mockToastSuccess).toHaveBeenCalledWith("Device approved.");
});
