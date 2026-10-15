import {
  act,
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

const mockRequestPermission = jest.fn();
let mockCameraGranted = false;
// Captures the live scan handler so a test can simulate a barcode arriving.
const mockCameraProps: {
  onBarcodeScanned?: (result: { data: string; type: string }) => void;
} = {};

jest.mock("expo-camera", () => {
  const { View } = require("react-native");
  return {
    CameraView: (props: {
      onBarcodeScanned?: (result: { data: string; type: string }) => void;
    }) => {
      mockCameraProps.onBarcodeScanned = props.onBarcodeScanned;
      return <View testID="camera-view" />;
    },
    useCameraPermissions: () => [
      {
        granted: mockCameraGranted,
        canAskAgain: true,
        expires: "never",
        status: mockCameraGranted ? "granted" : "denied",
      },
      mockRequestPermission,
    ],
  };
});

const mockRefreshDevices = jest.fn();
const mockDeleteDevice = jest.fn();
const mockApproveQrLogin = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

const mockDevices = [
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
  mockCameraGranted = false;
  mockCameraProps.onBarcodeScanned = undefined;
  mockRequestPermission.mockResolvedValue({ granted: false });
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

test("shows the login code contract and the scan toggle in the approve sheet", async () => {
  await render(<DevicesScreen />);
  await waitFor(() => expect(mockRefreshDevices).toHaveBeenCalled());
  await fireEvent.press(screen.getByText("Approve device"));

  expect(screen.getByText("Approve a device")).toBeTruthy();
  expect(
    screen.getByText(
      "Make sure the code matches the other device, then approve.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Login code")).toBeTruthy();
  expect(
    screen.getByText(
      "Open the login page on the other device and scan its QR code, or enter the code shown below it.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Approve login" })).toBeTruthy();
  expect(screen.getByLabelText("Scan QR with camera")).toBeTruthy();
  expect(screen.queryByTestId("camera-view")).toBeNull();
});

test("approves a typed device code and shows the in-sheet success", async () => {
  await render(<DevicesScreen />);
  await waitFor(() => expect(mockRefreshDevices).toHaveBeenCalled());
  await fireEvent.press(screen.getByText("Approve device"));
  await fireEvent.changeText(
    await screen.findByLabelText("Login code"),
    "pair-code",
  );
  const submit = screen.getByRole("button", { name: "Approve login" });
  await waitFor(() =>
    expect(submit.props.accessibilityState.disabled).toBe(false),
  );
  await fireEvent.press(submit);
  await waitFor(() =>
    expect(mockApproveQrLogin).toHaveBeenCalledWith("PAIR-CODE"),
  );
  expect(
    await screen.findByText("Approved. The other device is now logged in."),
  ).toBeTruthy();
  expect(screen.getByText("You can close this dialog.")).toBeTruthy();
  expect(mockToastSuccess).not.toHaveBeenCalled();
});

test("canonicalizes typed codes into dash groups before approving", async () => {
  await render(<DevicesScreen />);
  await waitFor(() => expect(mockRefreshDevices).toHaveBeenCalled());
  await fireEvent.press(screen.getByText("Approve device"));
  await fireEvent.changeText(
    await screen.findByLabelText("Login code"),
    "abcd1234efgh5678",
  );
  const submit = screen.getByRole("button", { name: "Approve login" });
  await waitFor(() =>
    expect(submit.props.accessibilityState.disabled).toBe(false),
  );
  await fireEvent.press(submit);
  await waitFor(() =>
    expect(mockApproveQrLogin).toHaveBeenCalledWith("ABCD-1234-EFGH-5678"),
  );
});

test("falls back to manual entry when camera permission is denied", async () => {
  await render(<DevicesScreen />);
  await waitFor(() => expect(mockRefreshDevices).toHaveBeenCalled());
  await fireEvent.press(screen.getByText("Approve device"));
  await fireEvent.press(screen.getByLabelText("Scan QR with camera"));

  expect(mockRequestPermission).toHaveBeenCalled();
  expect(
    await screen.findByText(
      "Camera unavailable. Enter the code manually instead.",
    ),
  ).toBeTruthy();
  expect(screen.queryByTestId("camera-view")).toBeNull();

  await fireEvent.changeText(
    await screen.findByLabelText("Login code"),
    "pair-code",
  );
  const submit = screen.getByRole("button", { name: "Approve login" });
  await waitFor(() =>
    expect(submit.props.accessibilityState.disabled).toBe(false),
  );
  await fireEvent.press(submit);
  await waitFor(() =>
    expect(mockApproveQrLogin).toHaveBeenCalledWith("PAIR-CODE"),
  );
});

test("submits only the first scanned code and stops the camera", async () => {
  mockCameraGranted = true;
  await render(<DevicesScreen />);
  await waitFor(() => expect(mockRefreshDevices).toHaveBeenCalled());
  await fireEvent.press(screen.getByText("Approve device"));
  await fireEvent.press(screen.getByLabelText("Scan QR with camera"));
  await screen.findByTestId("camera-view");

  await act(async () => {
    mockCameraProps.onBarcodeScanned?.({
      data: "https://app.katariasyntex.workers.dev/login/scan/abcd1234efgh5678",
      type: "qr",
    });
    // A barcode event arriving again before the camera tears down is ignored.
    mockCameraProps.onBarcodeScanned?.({
      data: "https://app.katariasyntex.workers.dev/login/scan/zzzz9999yyyy8888",
      type: "qr",
    });
  });

  expect(screen.queryByTestId("camera-view")).toBeNull();
  expect(mockApproveQrLogin).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(mockApproveQrLogin).toHaveBeenCalledWith("ABCD-1234-EFGH-5678"),
  );
  expect(
    await screen.findByText("Approved. The other device is now logged in."),
  ).toBeTruthy();
});
