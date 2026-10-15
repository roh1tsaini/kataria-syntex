import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";

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
jest.mock("react-native-qrcode-svg", () => "QRCode");

const mockLookupIdentifier = jest.fn();
const mockRequestOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockLoginPassword = jest.fn();
const mockSignup = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("@kataria-syntex/app-core", () => ({
  useAuth: (selector: any) =>
    selector({
      status: "guest",
      lookupIdentifier: mockLookupIdentifier,
      requestOtp: mockRequestOtp,
      verifyOtp: mockVerifyOtp,
      loginPassword: mockLoginPassword,
      signup: mockSignup,
      startQrLogin: jest.fn().mockResolvedValue({
        code: "TEST-CODE",
        claimSecret: "sec",
        payload: "https://example.com/scan",
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      }),
      pollQrLogin: jest.fn().mockResolvedValue("pending"),
    }),
  friendlyError: (err: any) => String(err?.message || err),
  ApiError: class ApiError extends Error {
    code = "api_error";
  },
}));

const { AuthScreen } = require("@/screens/auth");

describe("AuthScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders sign in header and input", async () => {
    await render(<AuthScreen next={null} />);
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("+91 98765 43210 or you@gmail.com"),
    ).toBeTruthy();
  });

  it("submits identifier and moves to OTP step when account exists", async () => {
    mockLookupIdentifier.mockResolvedValueOnce({
      exists: true,
      hasPassword: true,
      registrationClosed: false,
    });
    mockRequestOtp.mockResolvedValueOnce(undefined);

    await render(<AuthScreen next={null} />);
    const input = screen.getByPlaceholderText(
      "+91 98765 43210 or you@gmail.com",
    );
    fireEvent.changeText(input, "user@example.com");

    const continueBtn = screen.getByLabelText("Continue sign in");
    await waitFor(() => {
      expect(continueBtn.props.accessibilityState.disabled).toBe(false);
    });

    fireEvent.press(continueBtn);

    await waitFor(() => {
      expect(mockLookupIdentifier).toHaveBeenCalledWith("user@example.com");
      expect(mockRequestOtp).toHaveBeenCalledWith("user@example.com");
      expect(screen.getByText("Verification")).toBeTruthy();
    });
  });

  it("switches to QR tab when pressed", async () => {
    await render(<AuthScreen next={null} />);
    const qrTab = screen.getByRole("tab", { name: /Scan QR/i });
    fireEvent.press(qrTab);
    await waitFor(() => {
      expect(screen.getByText("Scan with a signed-in device.")).toBeTruthy();
    });
  });
});
